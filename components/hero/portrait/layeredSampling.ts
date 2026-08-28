// Checkpoint L3: combines Layer 1 (landmark contours) and Layer 2 (Poisson-disk fill) into the
// single {width, height, positions, colors} shape BodyParticles.tsx already knows how to render
// (one particle per texel, packed into a 1-row texture — see contourSampling.ts's buildContourGrid
// for why a 1-row texture is fine at these point counts). Color is computed now, from the actual
// photo pixel at each point, even though Checkpoint L3 itself is still judged in raw debug mode
// (flat dots, color texture ignored) — so Checkpoint L4 (reintroducing color) needs no new sampling
// work, just a flag flip.

import { buildContourPoints, type ContourPoint } from "./contourSampling";
import { buildFillPoints, buildImageSampler, buildMultiScaleSignal } from "./poissonFill";
import type { BodyParticleGrid } from "./edgeSampling";

const AMBER_HUE = 40 / 360;
const AMBER_SATURATION = 0.85;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
}

export function buildLayeredPortraitGrid(
  image: HTMLImageElement | HTMLCanvasElement,
  bgColor: [number, number, number],
  // Diagnostic-only: overrides the face-fill point budget for the density-sweep experiment.
  // Undefined means "current behavior, unchanged" — every other density-step call passes an
  // explicit spacing so the baseline stays exactly reproducible.
  faceFillBaseSpacingOverride?: number
): BodyParticleGrid {
  const layer1: ContourPoint[] = buildContourPoints();
  const signal = buildMultiScaleSignal(image);
  const fill = buildFillPoints(image, bgColor, layer1, signal, faceFillBaseSpacingOverride);
  const sampler = buildImageSampler(image, bgColor);

  const all: { u: number; v: number; isFill: boolean }[] = [
    ...layer1.map((p) => ({ u: p.u, v: p.v, isFill: false })),
    ...fill.map((p) => ({ u: p.u, v: p.v, isFill: true })),
  ];

  const count = Math.max(1, all.length);
  const positions = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);

  all.forEach((p, i) => {
    const worldX = (p.u - 0.5) * 2;
    const worldY = (0.5 - p.v) * 2;
    positions[i * 4] = worldX;
    positions[i * 4 + 1] = worldY;
    positions[i * 4 + 2] = 0;
    positions[i * 4 + 3] = 1;

    const l = sampler.luminance(p.u, p.v);
    let lightness = 0.12 + l * 0.72;
    if (p.isFill) {
      // Multi-scale local contrast pushes each fill point's own brightness toward the real edge
      // it sits near — an eyelid crease reads darker, a nose-bridge highlight reads brighter — the
      // same unsharp-mask idea already used for the dense-grid checkpoint, scoped to the fill
      // layer specifically since that's what should be carrying the image's own detail here.
      // Contour points keep straight luminance; they're not what this change is about.
      const detail = signal.signedDetail(p.u, p.v);
      lightness = Math.min(1, Math.max(0, lightness + detail * 1.3));
    }
    const [ar, ag, ab] = hslToRgb(AMBER_HUE, AMBER_SATURATION, lightness);
    // Reversed from the original bias (contour 1.05/1.1, fill 0.8/0.8), which kept the landmark
    // mesh visually dominant over the photo-derived fill. The fill now renders at full brightness/
    // size and the contour recedes — landmarks still anchor structure and guarantee negative space,
    // but the portrait should read as driven by the photograph, not by the mesh sitting on top of
    // it. Rendering-only change: no position/placement touched.
    const brightnessMult = p.isFill ? 1.0 : 0.75;
    const sizeMult = p.isFill ? 1.0 : 0.8;
    colors[i * 4] = ar * brightnessMult;
    colors[i * 4 + 1] = ag * brightnessMult;
    colors[i * 4 + 2] = ab * brightnessMult;
    colors[i * 4 + 3] = sizeMult;
  });

  return { width: count, height: 1, positions, colors };
}
