// Diagnostic experiment (explicitly authorized, temporary): after multiple color-only levers for
// eye legibility all failed to survive down to normal viewing size (see edgeSampling.ts's "TRIED
// AND REVERTED" comments for iris/pupil and eyebrow-separation), the next hypothesis to test is
// spatial — are the eyes illegible because there simply aren't enough particles in that tiny
// footprint to trace their shape, independent of what color those particles carry? This builds a
// small, separate, high-local-density particle patch covering just the two eyes (plus a small lid
// margin), meant to render ADDITIONALLY alongside the main locked 1.6x grid, which stays completely
// untouched everywhere outside the eye regions. See suppressEyeInterior in edgeSampling.ts (opt-in,
// off by default) for the one change needed there: fully hiding the main grid's own low-res eye
// particles so this patch isn't fighting a duplicate underneath it.
//
// Structural color-computation test (this revision): before assuming density was the remaining
// blocker, traced the full source -> color pipeline. Found two real bottlenecks, both inherited
// unchanged from the main grid (tuned for whole-face scale, never re-tuned for something this
// small): (1) the old COLOR_RES=512 canvas gives only ~29x12 real source pixels across the eye's
// own bounding box, while this patch already samples ~91x39 particles from that same region — many
// particles were rounding onto the identical source pixel, unable to differ; (2) the local-contrast
// blur radius (6px at 512-res) is nearly half the eye's own 29px width there, smearing sclera/iris/
// pupil boundaries together before any "detail" signal was even computed. This revision replaces
// both: color now comes from a direct bilinear sample of a canvas drawn at the source image's own
// native resolution (no downsampling, no blur, no derived contrast boost), and all randomness
// (jitter, size, previously brightness) is seeded so before/after comparisons are reproducible
// rather than confounded by a different random layout on every reload.
//
// This is diagnostic scaffolding, not a proposed permanent architecture. If direct high-fidelity
// source sampling still doesn't resolve recognizable eyes, the conclusion is that the current
// particle count is the genuine remaining blocker, not signal loss in the color computation.

import { PORTRAIT_LANDMARKS, PORTRAIT_LANDMARK_GROUPS } from "./portraitLandmarks";
import type { BodyParticleGrid } from "./edgeSampling";

const AMBER_HUE = 40 / 360;
const AMBER_SATURATION = 0.85;
const HUE_BLEND_STRENGTH = 0.16;
const SATURATION_BLEND_STRENGTH = 0.35;
// How many times finer than the main grid's own pitch (1/239 in UV) this patch samples at, within
// the eye regions only. 4x linear = 16x the particle density in that footprint — "small, controlled"
// in absolute terms (a few thousand particles total, negligible next to the main grid's ~57,600),
// but a large local multiple, which is the point of the test. Frozen at this value per the current
// test's scope — density is not being changed here.
const DENSITY_MULT = 4;
// Padding around each eye's own landmark bounding box, as a fraction of its size — enough to cover
// the lid margin without reaching into the brow or cheek.
const PADDING = 0.35;
// Fraction of the padded box's own size, at each edge, over which this patch's alpha feathers from
// full strength down to 0 — blends into the surrounding sparse main-grid particles instead of
// presenting a hard rectangular cutout against them.
const BOUNDARY_FEATHER = 0.3;
// Fixed seed so jitter/size variation is identical across separate builds/page loads — needed for a
// fair, confound-free before/after comparison (an earlier round's pixel-level comparison was
// unreliable specifically because Math.random() produced a different particle layout each time).
const RNG_SEED = 1337;
// Overlap-driven glow correction. Measured directly, not guessed: this patch's diameter-to-pitch
// ratio is uSize(2.0) / (finePitch-in-screen-px, ~0.544) ~= 3.68x, versus the main grid's own
// locked, extensively-validated ratio of 1.6x (point size / grid pitch, see BodyParticles.tsx).
// Area coverage under circular overlap scales roughly with the square of that ratio, so at the same
// per-particle alpha this patch composites ~(3.68/1.6)^2 ~= 5.3x more overlapping layers per unit
// area than the main grid — under standard "over" alpha blending (neither shader uses additive
// blending; confirmed by reading both materials), that much overlap converges toward solid/opaque
// coverage, while the main grid's lighter overlap leaves visible black between particles. That
// difference — not a brighter color value per particle — is what reads as "glowing" rather than
// "grainy amber particles like the rest of the face." EYE_ALPHA_SCALE compensates by the inverse of
// that squared ratio (~0.19, rounded), reducing per-particle opacity so the same particles, at the
// same size/density/position, stop converging to solid coverage. This does not touch size, density,
// position, or color/luminance computation — pure compositing correction.
// The squared-ratio estimate (0.19) was the starting point but empirically overcorrected in testing
// — glow was gone but the eyes became barely visible, structure compromised. 0.5 is the next, more
// moderate value being tested.
const EYE_ALPHA_SCALE = 0.5;
// Layer-integration correction (main grid is never suppressed now — that approach was tried and
// reverted, since it created a visible dark ring where both layers vacated the same margin at once).
// Measured directly: 75.5% of this patch's own particles (by area) sit outside the real eye-opening
// polygon, in the lid/brow/cheek margin — the existing edgeAlpha feather (keyed to the padded box's
// outer edge, ~0.028 out) only starts winding down well past that real boundary, so most of that
// 75.5% still carries substantial alpha while ALSO sitting on top of the main grid's own full,
// never-suppressed coverage there — two layers stacking. This adds a second, tighter falloff keyed
// to the real eye polygon itself (not the padded box) — full strength (1) anywhere inside the actual
// eye, smoothly toward 0 within MARGIN_FALLOFF_RADIUS of stepping outside it. Multiplies against the
// existing edgeAlpha rather than replacing it — same falloff shape (smoothstepLocal) already used
// throughout this codebase, just a second, tighter application. Because the main grid is present the
// entire time (never vacated), this factor reaching 0 in the deep margin does not create a gap — it
// just means the eye patch stops contributing there, leaving the main grid's own single-layer
// coverage as the only thing rendering, exactly matching the rest of the face.
const MARGIN_FALLOFF_RADIUS = 0.008;

function pointInPolygon(u: number, v: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i];
    const [uj, vj] = poly[j];
    const intersects = vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui;
    if (intersects) inside = !inside;
  }
  return inside;
}

function marginFactor(u: number, v: number, poly: [number, number][]): number {
  if (pointInPolygon(u, v, poly)) return 1;
  let best = Infinity;
  for (const [pu, pv] of poly) {
    const d = Math.hypot(pu - u, pv - v);
    if (d < best) best = d;
  }
  return 1 - smoothstepLocal(0, MARGIN_FALLOFF_RADIUS, best);
}
// Aesthetic-integration refinement (soft-knee highlight compression, threshold 0.55 / ratio 0.45)
// was tried and REVERTED — the mechanism itself was correct and safe (only touched luminance above
// the threshold, leaving the iris/pupil untouched), but the effect was too gentle to visibly change
// the "glowing patch" impression at normal viewing size (peak luminance in a direct pixel comparison
// dropped only ~7%, no perceptible difference in either theme). Rather than keep tuning brightness,
// this reverts to the direct bilinear/native-resolution mapping validated as the first genuinely
// recognizable-eyes result in this investigation — see git history for the reverted attempt.

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstepLocal(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

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

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function blendHueShortest(base: number, target: number, t: number): number {
  let diff = target - base;
  diff -= Math.round(diff);
  return (((base + diff * t) % 1) + 1) % 1;
}

function groupPolygon(name: keyof typeof PORTRAIT_LANDMARK_GROUPS): [number, number][] {
  return PORTRAIT_LANDMARK_GROUPS[name].map((idx) => {
    const [x, y] = PORTRAIT_LANDMARKS[idx];
    return [x, y] as [number, number];
  });
}

const LEFT_EYE_POLY = groupPolygon("leftEye");
const RIGHT_EYE_POLY = groupPolygon("rightEye");

function paddedBBox(poly: [number, number][]) {
  let uMin = 1;
  let uMax = 0;
  let vMin = 1;
  let vMax = 0;
  for (const [u, v] of poly) {
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  }
  const w = uMax - uMin;
  const h = vMax - vMin;
  return {
    uMin: uMin - w * PADDING,
    uMax: uMax + w * PADDING,
    vMin: vMin - h * PADDING,
    vMax: vMax + h * PADDING,
  };
}

// Bilinear sample of a raw RGBA byte buffer at fractional pixel coordinates — the direct,
// unprocessed source signal (no downsampling to a shared low-res canvas, no blur-based contrast
// boost). u/v are normalized [0,1] image-UV coordinates.
function bilinearSampleRGB(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  u: number,
  v: number
): [number, number, number] {
  const fx = Math.min(w - 1, Math.max(0, u * (w - 1)));
  const fy = Math.min(h - 1, Math.max(0, v * (h - 1)));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const idx = (x: number, y: number) => (y * w + x) * 4;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const sample = (c: number) => {
    const v00 = data[idx(x0, y0) + c];
    const v10 = data[idx(x1, y0) + c];
    const v01 = data[idx(x0, y1) + c];
    const v11 = data[idx(x1, y1) + c];
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty) / 255;
  };
  return [sample(0), sample(1), sample(2)];
}

export function buildEyeDetailGrid(
  image: HTMLImageElement | HTMLCanvasElement,
  mainGridWidth: number
): BodyParticleGrid {
  // Native-resolution canvas — no downsampling before sampling, so every particle can access
  // genuinely distinct source detail rather than several particles rounding onto the same
  // low-res pixel (the COLOR_RES=512 bottleneck this revision removes).
  const iw = "naturalWidth" in image && image.naturalWidth ? image.naturalWidth : image.width;
  const ih = "naturalHeight" in image && image.naturalHeight ? image.naturalHeight : image.height;
  const canvas = document.createElement("canvas");
  canvas.width = iw;
  canvas.height = ih;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return { width: 0, height: 1, positions: new Float32Array(0), colors: new Float32Array(0) };
  }

  ctx.drawImage(image, 0, 0, iw, ih);
  const { data } = ctx.getImageData(0, 0, iw, ih);

  const rand = mulberry32(RNG_SEED);
  const mainPitch = 1 / (mainGridWidth - 1);
  const finePitch = mainPitch / DENSITY_MULT;

  const points: { u: number; v: number; edgeAlpha: number }[] = [];
  for (const [poly, box] of [
    [LEFT_EYE_POLY, paddedBBox(LEFT_EYE_POLY)],
    [RIGHT_EYE_POLY, paddedBBox(RIGHT_EYE_POLY)],
  ] as [[number, number][], ReturnType<typeof paddedBBox>][]) {
    const boxW = box.uMax - box.uMin;
    const boxH = box.vMax - box.vMin;
    const featherU = boxW * BOUNDARY_FEATHER;
    const featherV = boxH * BOUNDARY_FEATHER;
    const cols = Math.max(2, Math.round(boxW / finePitch));
    const rows = Math.max(2, Math.round(boxH / finePitch));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = box.uMin + ((c + 0.5) / cols) * boxW;
        const v = box.vMin + ((r + 0.5) / rows) * boxH;
        const au = smoothstepLocal(0, featherU, Math.min(u - box.uMin, box.uMax - u));
        const av = smoothstepLocal(0, featherV, Math.min(v - box.vMin, box.vMax - v));
        points.push({ u, v, edgeAlpha: au * av * marginFactor(u, v, poly) });
      }
    }
  }

  const n = points.length;
  const positions = new Float32Array(n * 4);
  const colors = new Float32Array(n * 4);

  for (let i = 0; i < n; i++) {
    const { u, v, edgeAlpha } = points[i];
    if (edgeAlpha <= 0.001) continue;
    // Seeded jitter — same role as before (breaks the visible lattice), now deterministic.
    const ju = Math.min(1, Math.max(0, u + (rand() - 0.5) * finePitch * 1.1));
    const jv = Math.min(1, Math.max(0, v + (rand() - 0.5) * finePitch * 1.1));

    const dstIdx = i * 4;
    positions[dstIdx] = (ju - 0.5) * 2;
    positions[dstIdx + 1] = (1 - jv - 0.5) * 2;
    positions[dstIdx + 2] = 0;
    positions[dstIdx + 3] = edgeAlpha * EYE_ALPHA_SCALE;

    // Direct bilinear sample at this particle's own (un-jittered) source coordinate — no shared
    // low-res canvas, no blur, no derived "detail"/contrast-boost term. Whatever spatial structure
    // shows up here is exactly what the source image itself contains at this location.
    const [r, g, b] = bilinearSampleRGB(data, iw, ih, u, v);
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    const lightness = 0.12 + l * 0.72;

    const [realH, realS] = rgbToHsl(r, g, b);
    const hue = blendHueShortest(AMBER_HUE, realH, HUE_BLEND_STRENGTH * realS);
    const saturation = Math.min(
      1,
      Math.max(0, AMBER_SATURATION * (1 - SATURATION_BLEND_STRENGTH) + realS * SATURATION_BLEND_STRENGTH * 1.3)
    );
    const [ar, ag, ab] = hslToRgb(hue, saturation, lightness);
    // Texture-consistency correction: measured directly (both visually and via local pixel
    // variance) that the eye patch reads as noticeably smoother/less grainy than the immediately
    // surrounding cheek/forehead — not a brightness-level difference, a statistical-texture one.
    // Traced to a real code-level gap: the main grid applies a +/-8% random per-particle brightness
    // multiplier (brightnessMult in edgeSampling.ts) that gives it its organic grain; this patch had
    // none (removed in an earlier, unrelated test that needed to isolate direct source sampling from
    // random noise as a confound — not a permanent constraint). Restoring the exact same range here,
    // seeded for determinism. This is pure per-particle noise layered on top of the real
    // source-derived color — it does not touch the underlying sclera/iris/pupil luminance values or
    // their structure, only adds the same independent flicker every other particle in the portrait
    // already has.
    const brightnessMult = 0.92 + rand() * 0.16;
    colors[dstIdx] = ar * brightnessMult;
    colors[dstIdx + 1] = ag * brightnessMult;
    colors[dstIdx + 2] = ab * brightnessMult;
    // Size variation kept (not "brightness"), now seeded for determinism.
    colors[dstIdx + 3] = 0.75 + rand() * 0.35;
  }

  return { width: n, height: 1, positions, colors };
}
