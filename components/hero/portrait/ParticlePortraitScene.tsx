"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { BodyParticles } from "./BodyParticles";
import { BackgroundScrim } from "./BackgroundScrim";
import { EyeDetailParticles } from "./EyeDetailParticles";

// Production wiring for the approved dense-grid particle portrait — the result of the full
// identity/color/facial-completeness investigation carried out in the (now-removed) sandbox route.
// Locked configuration only, no diagnostic toggles: dense grid at 1.6x point size (identity
// checkpoint), color stage (theme-aware floor/ceiling, hue/saturation restoration, local-contrast
// boost), the approved eye-contour lever and nose warp/density correction (both part of the main
// grid), and the supplemental eye-detail patch (native-resolution sampling, alpha=0.5, margin-blend
// falloff) for iris/pupil/sclera structure. The eye-detail patch's known residual — it still reads
// as very slightly distinct from the surrounding face at close inspection, per the last diagnosis in
// this investigation — is a known, accepted limitation, not an oversight; removing it would trade
// away the only version of this portrait where the eyes are actually recognizable.
//
// Explicitly NOT included: the rim/edge dissolve layer (EdgeParticles) — rejected by the user as a
// dominant, competing halo — and any bloom/post-processing, since the effects pipeline was never
// resumed after the facial-completeness investigation took over.

type RGB = [number, number, number];

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

function SceneContents({ src }: { src: string }) {
  const loaded = usePortraitTexture(src);
  if (!loaded) return null;
  return (
    <>
      <BackgroundScrim />
      <BodyParticles
        texture={loaded.texture}
        bgColor={loaded.bgColor}
        pointSizeSpacingMult={1.6}
        suppressEyeInterior
      />
      <EyeDetailParticles texture={loaded.texture} />
    </>
  );
}

export function ParticlePortraitScene({ src }: { src: string }) {
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
