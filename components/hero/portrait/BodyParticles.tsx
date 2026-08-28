"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { buildBodyParticleGrid, type BodyParticleGrid } from "./edgeSampling";
import { buildContourGrid } from "./contourSampling";
import { buildLayeredPortraitGrid } from "./layeredSampling";
import { createParticleSimulation, type ParticleSimulation } from "./particleSimulation";
import { BodyParticleMaterialImpl, type BodyParticleMaterialInstance } from "./BodyParticleMaterial";

// Desktop tier — adaptive tiering (mobile/mid-range) lands later. Bumped from 180x180 (32,400)
// to match the particle count the Codrops reference implementation uses (320x180 = 57,600) for its
// per-pixel image reconstruction — tested directly because the de-gated grid experiment showed
// silhouette/hair reads correctly but small feature regions (eyes, nose, mouth) weren't getting
// enough samples to resolve crisply at the lower count.
export const DESKTOP_GRID_WIDTH = 240;
export const DESKTOP_GRID_HEIGHT = 240; // 57,600 particles

export function buildReferenceGeometry(width: number, height: number) {
  const geo = new THREE.BufferGeometry();
  const count = width * height;
  const positions = new Float32Array(count * 3); // dummy; real position comes from the sim texture
  const reference = new Float32Array(count * 2);

  let p = 0;
  let r = 0;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      positions[p++] = 0;
      positions[p++] = 0;
      positions[p++] = 0;
      reference[r++] = (i + 0.5) / width;
      reference[r++] = (j + 0.5) / height;
    }
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("reference", new THREE.BufferAttribute(reference, 2));
  return geo;
}

export function BodyParticles({
  texture,
  bgColor,
  width = DESKTOP_GRID_WIDTH,
  height = DESKTOP_GRID_HEIGHT,
  staticPreview = false,
  debugMode = false,
  contourOnly = false,
  includeFill = false,
  faceFillBaseSpacingOverride,
  monochrome = false,
  pointSizeSpacingMult,
  suppressEyeInterior = false,
}: {
  texture: THREE.Texture;
  bgColor: [number, number, number];
  width?: number;
  height?: number;
  // When true: skip the GPU simulation entirely and render particles exactly at their
  // photo-derived target positions, with no motion. For isolating and judging the base sampling
  // strategy on its own, without simulation-induced flicker/drift as a confound.
  staticPreview?: boolean;
  // When true: hard 1px points, binary presence, flat color, no blending/falloff/glow — isolates
  // the raw point placement from every rendering-side variable.
  debugMode?: boolean;
  // Checkpoint L2 verification only: render Layer 1 (landmark contour points) alone, in place of
  // the whole-image grid — no fill, no tone. Always static (contour points aren't simulated yet).
  contourOnly?: boolean;
  // Checkpoint L3: only meaningful when contourOnly is also true — adds Layer 2 (Poisson-disk
  // fill) around Layer 1's contours instead of rendering the contours alone.
  includeFill?: boolean;
  // Diagnostic-only: face-fill point budget for the density-sweep experiment. Undefined = current
  // unchanged behavior.
  faceFillBaseSpacingOverride?: number;
  // Particleization experiment: strips hue only, keeps size/falloff/opacity/depth exactly as the
  // color path computes them.
  monochrome?: boolean;
  // Particleization experiment: dense-grid point diameter as a multiple of grid pitch. Undefined
  // = current default (2.2x). Lower = more visible gap between particles.
  pointSizeSpacingMult?: number;
  // Structural eye-resolution experiment (diagnostic, off by default): hides this grid's own
  // low-res eye particles so a separate, higher-density patch (EyeDetailParticles) can render in
  // their place without doubling up. See eyeDetailSampling.ts.
  suppressEyeInterior?: boolean;
}) {
  const { gl, invalidate } = useThree();
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [sim, setSim] = useState<ParticleSimulation | null>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const isStatic = staticPreview || contourOnly;

  const grid: BodyParticleGrid = useMemo(() => {
    if (contourOnly) {
      return includeFill
        ? buildLayeredPortraitGrid(texture.image as HTMLImageElement, bgColor, faceFillBaseSpacingOverride)
        : buildContourGrid();
    }
    return buildBodyParticleGrid(texture.image as HTMLImageElement, bgColor, width, height, {
      suppressEyeInterior,
    });
  }, [texture, bgColor, width, height, contourOnly, includeFill, faceFillBaseSpacingOverride, suppressEyeInterior]);

  useEffect(() => {
    if (isStatic) return;
    const simulation = createParticleSimulation(gl, grid);
    setSim(simulation);
    return () => {
      simulation.gpuCompute.dispose();
    };
  }, [gl, grid, isStatic]);

  const material = useMemo(() => {
    const m = new BodyParticleMaterialImpl() as unknown as BodyParticleMaterialInstance;
    m.transparent = true;
    m.depthWrite = false;
    m.uSize = 5.5;
    m.uPixelRatio = Math.min(gl.getPixelRatio(), 2);
    m.uDebugColor.set(0, 0, 0);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => {
    material.uDebugMode = debugMode ? 1 : 0;
    invalidate();
  }, [material, debugMode, invalidate]);

  useEffect(() => {
    material.uMonochrome = monochrome ? 1 : 0;
    invalidate();
  }, [material, monochrome, invalidate]);

  useEffect(() => {
    // Theme-aware contrast recovery for the color path only — the monochrome baseline (uMonochrome
    // branch in the shader) never reads these, so it stays exactly as approved. Dark theme's
    // near-black backdrop needs a floor (dark amber areas like the jacket were reading too close
    // to the background's own luminance); light theme's pale backdrop needs a ceiling (bright
    // highlights were too close to it). APPROVED as the locked color baseline — do not push these
    // further without a new explicit comparison against this exact state.
    if (theme === "dark") {
      material.uColorFloor = 0.34;
      material.uColorCeiling = 1.0;
      material.uFeatureAlphaFloor = 0.0;
    } else {
      material.uColorFloor = 0.0;
      material.uColorCeiling = 0.8;
      // Facial-completeness experiment: dark theme already shows real eye/mouth interior detail
      // at the reduced suppression level; light theme doesn't without this lift — same pattern as
      // the color floor/ceiling above, same fix shape, scoped to that specific presence band only.
      material.uFeatureAlphaFloor = 0.5;
    }
    invalidate();
  }, [material, theme, invalidate]);

  useEffect(() => {
    // The dense whole-image grid (grid.height > 1) packs particles far more tightly than L3's
    // contour/fill set (packed 1-row, height === 1) — at the fixed size tuned for L3, particles in
    // the dense grid overlap heavily enough that their soft, alpha-blended circles wash local
    // contrast into a flat glow instead of resolving individual features (confirmed directly: the
    // same source photo read as a nearly featureless blob at this density with the L3-tuned size).
    // Sizing to roughly match the grid's own pitch keeps particles distinct rather than fused.
    if (grid.height > 1) {
      // Matching diameter exactly to grid pitch (1x) left particles barely touching — sparse and
      // faint, since each is also a soft circular falloff, not a hard-edged square. Some deliberate
      // overlap between neighbors is what gives continuous tonal coverage (the same reason
      // real stippling/halftone dots overlap their neighbors' radius rather than just kissing it).
      const spacingPx = (2 / grid.width) * 260; // world-unit spacing at the sandbox's orthographic zoom
      const mult = pointSizeSpacingMult ?? 2.2;
      material.uSize = Math.max(2, (spacingPx * mult) / material.uPixelRatio);
    } else {
      material.uSize = 5.5;
    }
    invalidate();
  }, [material, grid, invalidate, pointSizeSpacingMult]);

  useEffect(() => {
    const colorTexture = new THREE.DataTexture(
      grid.colors,
      grid.width,
      grid.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    colorTexture.needsUpdate = true;
    material.uColorTexture = colorTexture;
    invalidate();
    return () => colorTexture.dispose();
  }, [grid, material, invalidate]);

  // Static preview (and contour-only): render directly from the target position data, with a
  // zero-velocity texture (velocity-driven opacity then just sits at its calm floor) — no
  // simulation, no motion.
  useEffect(() => {
    if (!isStatic) return;
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
    // frameloop="demand" only re-renders when R3F detects a reason to — an imperative mutation
    // like this (not a React-tracked prop/state change) is otherwise invisible to it, leaving the
    // canvas frozen on the pre-texture (empty) frame until something unrelated happens to trigger
    // a render. invalidate() explicitly requests the frame this update actually needs.
    invalidate();
    return () => {
      positionTexture.dispose();
      velocityTexture.dispose();
    };
  }, [isStatic, grid, material, invalidate]);

  // Reference geometry must match the grid's own shape, not the requested width/height props —
  // contourOnly's grid is a 1-row texture sized to however many contour points there are, not the
  // whole-image grid dimensions.
  const geometry = useMemo(() => buildReferenceGeometry(grid.width, grid.height), [grid]);

  useFrame((_, delta) => {
    if (isStatic || !sim) return;
    if (!reducedMotion) {
      // Clamp the simulation timestep. Explicit-Euler spring integration (as used in the
      // velocity shader) is only stable for bounded dt — a tab switch, GPU stall, or just a slow
      // device can produce a large delta that, combined with a stiff spring, makes the simulation
      // diverge (particles fly apart instead of settling). Capping dt at a 30fps-equivalent step
      // means a real stall produces a brief pause, never runaway divergence.
      const simDelta = Math.min(delta, 1 / 30);
      sim.velocityVariable.material.uniforms.uDelta.value = simDelta;
      sim.velocityVariable.material.uniforms.uTime.value += simDelta;
      sim.positionVariable.material.uniforms.uDelta.value = simDelta;
      sim.gpuCompute.compute();
    }
    material.uPositionTexture = sim.gpuCompute.getCurrentRenderTarget(sim.positionVariable).texture;
    material.uVelocityTexture = sim.gpuCompute.getCurrentRenderTarget(sim.velocityVariable).texture;
  });

  if (!isStatic && !sim) return null;

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
