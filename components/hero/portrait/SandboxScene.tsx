"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { BodyParticles } from "./BodyParticles";
import { BackgroundScrim } from "./BackgroundScrim";
import { EdgeParticles } from "./EdgeParticles";
import { EyeDetailParticles } from "./EyeDetailParticles";

// Fixed amber palette for the sandbox — live theme-color wiring (dark/light uAccent/uWarm swap)
// is scoped for Checkpoint D, not yet.
const SANDBOX_ACCENT: RGB = [0.941, 0.627, 0.0];
const SANDBOX_WARM: RGB = [0.86, 0.78, 0.6];

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

// Fully opaque backdrop for debug mode — covers the background network entirely so raw point
// placement can be judged with zero interference from anything behind it.
function DebugBackdrop() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const geometry = new THREE.PlaneGeometry(2.4, 2.4);
  return <mesh geometry={geometry} material={material} position={[0, 0, -0.6]} />;
}

function SceneContents({
  src,
  staticPreview,
  showRimLayer,
  debugMode,
  contourOnly,
  includeFill,
  faceFillBaseSpacingOverride,
  monochrome,
  pointSizeSpacingMult,
  eyeDetailExperiment,
}: {
  src: string;
  staticPreview: boolean;
  showRimLayer: boolean;
  debugMode: boolean;
  contourOnly: boolean;
  includeFill: boolean;
  faceFillBaseSpacingOverride?: number;
  monochrome?: boolean;
  pointSizeSpacingMult?: number;
  eyeDetailExperiment?: boolean;
}) {
  const loaded = usePortraitTexture(src);
  if (!loaded) return null;
  return (
    <>
      {debugMode ? <DebugBackdrop /> : <BackgroundScrim />}
      <BodyParticles
        texture={loaded.texture}
        bgColor={loaded.bgColor}
        staticPreview={staticPreview}
        debugMode={debugMode}
        contourOnly={contourOnly}
        includeFill={includeFill}
        faceFillBaseSpacingOverride={faceFillBaseSpacingOverride}
        monochrome={monochrome}
        pointSizeSpacingMult={pointSizeSpacingMult}
        suppressEyeInterior={eyeDetailExperiment}
      />
      {/* Structural resolution experiment (diagnostic, off by default) — see eyeDetailSampling.ts.
          A separate, higher-density particle patch covering just the eyes, replacing (not adding
          to) the main grid's own eye particles, which are hidden via suppressEyeInterior above. */}
      {eyeDetailExperiment && !debugMode && !contourOnly && <EyeDetailParticles texture={loaded.texture} />}
      {/* Rejected effect experiment: this ring-shaped dissolve-boundary layer (from the earliest
          Checkpoint A/B era) reads as a large, dominant halo that competes with the portrait
          rather than supporting it — kept here only for archival/toggle-off comparison, default
          off, not part of the approved color baseline or a candidate for the next effect pass. */}
      {showRimLayer && !debugMode && !contourOnly && (
        <EdgeParticles
          texture={loaded.texture}
          bgColor={loaded.bgColor}
          accent={SANDBOX_ACCENT}
          warm={SANDBOX_WARM}
        />
      )}
    </>
  );
}

// Pausing before Checkpoint C to fix the base sampling: static preview mode (no simulation, no
// rim layer) isolates the particle placement/tone strategy from every animation confound.
export function SandboxPortraitScene({
  src,
  staticPreview = false,
  showRimLayer = true,
  debugMode = false,
  contourOnly = false,
  includeFill = false,
  faceFillBaseSpacingOverride,
  monochrome,
  pointSizeSpacingMult,
  eyeDetailExperiment,
}: {
  src: string;
  staticPreview?: boolean;
  showRimLayer?: boolean;
  debugMode?: boolean;
  contourOnly?: boolean;
  includeFill?: boolean;
  faceFillBaseSpacingOverride?: number;
  monochrome?: boolean;
  pointSizeSpacingMult?: number;
  eyeDetailExperiment?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Canvas
      orthographic
      camera={{ zoom: 260, position: [0, 0, 5], near: 0.1, far: 10 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
      frameloop={staticPreview || contourOnly || reducedMotion ? "demand" : "always"}
      style={{ background: "transparent" }}
    >
      <SceneContents
        src={src}
        staticPreview={staticPreview}
        showRimLayer={showRimLayer}
        debugMode={debugMode}
        contourOnly={contourOnly}
        includeFill={includeFill}
        faceFillBaseSpacingOverride={faceFillBaseSpacingOverride}
        eyeDetailExperiment={eyeDetailExperiment}
        monochrome={monochrome}
        pointSizeSpacingMult={pointSizeSpacingMult}
      />
    </Canvas>
  );
}
