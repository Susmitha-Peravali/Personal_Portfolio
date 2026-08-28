"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { FaceMaterialImpl, type FaceMaterialInstance } from "./FaceMaterial";
import { EdgeParticles } from "./EdgeParticles";
import { OrbitRings } from "./OrbitRings";

type RGB = [number, number, number];

function readThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  const isLight = document.documentElement.dataset.theme === "light";
  const parse = (name: string): RGB => {
    const parts = styles.getPropertyValue(name).trim().split(/\s+/).map(Number);
    return [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255];
  };
  return {
    isLight,
    accent: parse("--color-accent-primary"),
    // Solid shader fill needs a dedicated highlight color rather than reusing text-color tokens —
    // ink-secondary read as muddy in light mode, and raw ink-primary is near-white in dark mode
    // (fine for text, but flattens a filled duotone toward blown white). Both themes get a custom
    // warm-gold endpoint tuned for a filled render instead.
    warm: isLight ? ([0.878, 0.71, 0.478] as RGB) : ([0.86, 0.78, 0.6] as RGB),
  };
}

function useThemeColors() {
  const [colors, setColors] = useState(readThemeColors);
  useEffect(() => {
    function onThemeChange() {
      setColors(readThemeColors());
    }
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);
  return colors;
}

function sampleBackgroundColor(image: HTMLImageElement): RGB {
  const c = document.createElement("canvas");
  c.width = image.naturalWidth || image.width;
  c.height = image.naturalHeight || image.height;
  const ctx = c.getContext("2d");
  if (!ctx) return [0.95, 0.94, 0.92];
  ctx.drawImage(image, 0, 0, c.width, c.height);
  const corners = [
    ctx.getImageData(0, 0, 1, 1).data,
    ctx.getImageData(c.width - 1, 0, 1, 1).data,
    ctx.getImageData(0, c.height - 1, 1, 1).data,
    ctx.getImageData(c.width - 1, c.height - 1, 1, 1).data,
  ];
  const avg = (i: number) => corners.reduce((s, px) => s + px[i], 0) / 4 / 255;
  return [avg(0), avg(1), avg(2)];
}

function usePortraitTexture(src: string) {
  const [state, setState] = useState<{ texture: THREE.Texture; bgColor: RGB } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(src, (tex) => {
      if (cancelled) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const bgColor = sampleBackgroundColor(tex.image as HTMLImageElement);
      setState({ texture: tex, bgColor });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return state;
}

function FacePlane({
  texture,
  bgColor,
  accent,
  warm,
}: {
  texture: THREE.Texture;
  bgColor: RGB;
  accent: RGB;
  warm: RGB;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const material = useMemo(() => {
    const m = new FaceMaterialImpl() as unknown as FaceMaterialInstance;
    m.transparent = true;
    m.side = THREE.DoubleSide;
    m.uTexture = texture;
    m.uBgColor.set(...bgColor);
    m.uAccent.set(...accent);
    m.uWarm.set(...warm);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  useEffect(() => {
    material.uAccent.set(...accent);
    material.uWarm.set(...warm);
  }, [material, accent, warm]);

  useFrame((_, delta) => {
    if (!reducedMotion) {
      material.uTime += delta;
    }
  });

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2, 128, 128), []);

  return <mesh geometry={geometry} material={material} />;
}

// Subtle "looking at you" response to cursor position — gives the projection a sense of depth
// and presence rather than a static flat image, damped so it never feels like tracking/snapping.
function ParallaxGroup({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (reducedMotion || !groupRef.current) return;
    const targetY = pointer.x * 0.12;
    const targetX = -pointer.y * 0.08;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.06);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.06);
  });

  return <group ref={groupRef}>{children}</group>;
}

function SceneContents({ src }: { src: string }) {
  const loaded = usePortraitTexture(src);
  const { accent, warm, isLight } = useThemeColors();

  if (!loaded) return null;

  return (
    <>
      <ParallaxGroup>
        <FacePlane texture={loaded.texture} bgColor={loaded.bgColor} accent={accent} warm={warm} />
        <EdgeParticles texture={loaded.texture} bgColor={loaded.bgColor} accent={accent} warm={warm} />
        <OrbitRings accent={accent} />
      </ParallaxGroup>
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={isLight ? 0.8 : 0.75}
          luminanceSmoothing={0.1}
          intensity={isLight ? 0.15 : 0.2}
          radius={0.15}
        />
      </EffectComposer>
    </>
  );
}

export function PortraitScene({ src }: { src: string }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Canvas
      orthographic
      camera={{ zoom: 260, position: [0, 0, 5], near: 0.1, far: 10 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
      frameloop={reducedMotion ? "demand" : "always"}
      style={{ background: "transparent" }}
    >
      <SceneContents src={src} />
    </Canvas>
  );
}
