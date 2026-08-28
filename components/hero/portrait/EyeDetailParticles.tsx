"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useTheme } from "@/components/theme/ThemeProvider";
import { buildEyeDetailGrid } from "./eyeDetailSampling";
import { buildReferenceGeometry } from "./BodyParticles";
import { BodyParticleMaterialImpl, type BodyParticleMaterialInstance } from "./BodyParticleMaterial";

// Diagnostic-only (see eyeDetailSampling.ts): a small, separate, high-local-density particle patch
// covering just the eyes, layered on top of the main locked grid — whose own eye-region particles
// are hidden via BodyParticles' suppressEyeInterior prop so this isn't fighting a duplicate
// underneath it. No simulation, static positions only; this is scaffolding to test one hypothesis
// (is the eye legibility problem spatial resolution?), not a proposed permanent layer.
export function EyeDetailParticles({ texture }: { texture: THREE.Texture }) {
  const { gl, invalidate } = useThree();
  const { theme } = useTheme();

  const grid = useMemo(() => buildEyeDetailGrid(texture.image as HTMLImageElement, 240), [texture]);

  const material = useMemo(() => {
    const m = new BodyParticleMaterialImpl() as unknown as BodyParticleMaterialInstance;
    m.transparent = true;
    m.depthWrite = false;
    m.uPixelRatio = Math.min(gl.getPixelRatio(), 2);
    // Point-size-parity experiment — TRIED AND REVERTED. Measured that at pixelRatio=1, this patch's
    // dots render at 1.5-2.2px versus the main grid's own 2.6-3.8px (uSize 3.467, spacingPx*1.6) —
    // ~1.7x smaller in absolute screen size. Set uSize=3.467 to match the main grid exactly and
    // tested at normal viewing size in both themes: this was a clear regression, not an improvement
    // — the eyes went from reading as fine/smooth back to a visible glow/solid patch in both themes,
    // because EYE_ALPHA_SCALE=0.5 was calibrated for the old, smaller uSize's overlap ratio and
    // doesn't hold once size increases. Diagnostic conclusion: size and alpha are coupled in this
    // architecture — one cannot be fixed in isolation without retuning the other, which is out of
    // scope this round. Reverted to the original 2.0.
    m.uSize = 2.0;
    m.uDebugColor.set(0, 0, 0);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => {
    // Dark-theme floor-lowering experiment (0.34 -> 0.18, isolating the pupil/iris from the hard
    // clamp) was TRIED AND REVERTED. The mechanism was real (uColorFloor is a hard clamp, not a
    // soft compression — any particle below it gets rescaled to land at exactly the floor value,
    // which does flatten anything below it toward a shared target), and a direct pixel comparison
    // (identical seed, only this value changed) showed a small, real increase in local contrast
    // (std deviation 19.79 -> 20.38 in a matched crop). But it wasn't clearly visible at normal
    // viewing size in either the full frame or matched natural-scale crops — reverted rather than
    // trying another value, per the one-experiment constraint. Floor/ceiling match the main grid's
    // values exactly, as validated in the prior round.
    if (theme === "dark") {
      material.uColorFloor = 0.34;
      material.uColorCeiling = 1.0;
    } else {
      material.uColorFloor = 0.0;
      material.uColorCeiling = 0.8;
    }
    invalidate();
  }, [material, theme, invalidate]);

  useEffect(() => {
    const colorTexture = new THREE.DataTexture(grid.colors, grid.width, grid.height, THREE.RGBAFormat, THREE.FloatType);
    colorTexture.needsUpdate = true;
    material.uColorTexture = colorTexture;
    invalidate();
    return () => colorTexture.dispose();
  }, [grid, material, invalidate]);

  useEffect(() => {
    const positionTexture = new THREE.DataTexture(
      grid.positions,
      grid.width,
      grid.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    positionTexture.needsUpdate = true;
    const zeroVelocity = new Float32Array(grid.width * grid.height * 4);
    const velocityTexture = new THREE.DataTexture(
      zeroVelocity,
      grid.width,
      grid.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    velocityTexture.needsUpdate = true;
    material.uPositionTexture = positionTexture;
    material.uVelocityTexture = velocityTexture;
    invalidate();
    return () => {
      positionTexture.dispose();
      velocityTexture.dispose();
    };
  }, [grid, material, invalidate]);

  const geometry = useMemo(() => buildReferenceGeometry(grid.width, grid.height), [grid]);

  if (grid.width === 0) return null;

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
