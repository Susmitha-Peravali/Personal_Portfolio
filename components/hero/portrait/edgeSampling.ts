// Builds particle placement data by finding high-gradient (edge) pixels in the portrait photo
// and weighting them toward the same dissolve boundary the face shader dissolves at — so the
// GPU particles read as "the edge resolving into dust," not a generic halo around the whole photo.

import { PORTRAIT_LANDMARKS, PORTRAIT_LANDMARK_GROUPS } from "./portraitLandmarks";
import { buildMultiScaleSignal } from "./poissonFill";

export type EdgeParticleData = {
  positions: Float32Array;
  seeds: Float32Array;
  sizes: Float32Array;
  orbits: Float32Array;
  mixes: Float32Array;
};

const SAMPLE_RES = 220;
const DISSOLVE_CENTER: [number, number] = [0.5, 0.42];
const Y_SCALE = 1.15;
// Bell curve around the shader's rim/dissolve band (r ~0.30-0.66, brightest ~0.45-0.60).
const BAND_CENTER = 0.52;
const BAND_WIDTH = 0.16;
const BG_THRESHOLD = 0.16;

function weightedSample<T>(items: T[], weights: number[], count: number): T[] {
  const cumulative: number[] = [];
  let sum = 0;
  for (const w of weights) {
    sum += w;
    cumulative.push(sum);
  }
  const result: T[] = [];
  if (sum <= 0) return result;
  for (let i = 0; i < count; i++) {
    const r = Math.random() * sum;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    result.push(items[lo]);
  }
  return result;
}

export function buildEdgeParticleData(
  image: HTMLImageElement | HTMLCanvasElement,
  bgColor: [number, number, number],
  count: number
): EdgeParticleData {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_RES;
  canvas.height = SAMPLE_RES;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const orbits = new Float32Array(count);
  const mixes = new Float32Array(count);

  if (!ctx) {
    return { positions, seeds, sizes, orbits, mixes };
  }

  ctx.drawImage(image, 0, 0, SAMPLE_RES, SAMPLE_RES);
  const { data } = ctx.getImageData(0, 0, SAMPLE_RES, SAMPLE_RES);

  const w = SAMPLE_RES;
  const h = SAMPLE_RES;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    lum[i] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  const [bgR, bgG, bgB] = bgColor;

  const candidateUv: [number, number][] = [];
  const candidateWeight: number[] = [];
  const candidateMix: number[] = [];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;

      // Sobel gradient magnitude on luminance.
      const gx =
        -lum[i - w - 1] + lum[i - w + 1] - 2 * lum[i - 1] + 2 * lum[i + 1] - lum[i + w - 1] + lum[i + w + 1];
      const gy =
        -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      const gradient = Math.sqrt(gx * gx + gy * gy);
      if (gradient < 0.08) continue;

      const px = data[i * 4] / 255;
      const py = data[i * 4 + 1] / 255;
      const pz = data[i * 4 + 2] / 255;
      const bgDist = Math.sqrt((px - bgR) ** 2 + (py - bgG) ** 2 + (pz - bgB) ** 2);
      const subjectMask = Math.min(1, Math.max(0, (bgDist - BG_THRESHOLD * 0.6) / (BG_THRESHOLD * 0.4)));
      if (subjectMask <= 0) continue;

      const u = x / w;
      const v = 1 - y / h;
      const cx = u - DISSOLVE_CENTER[0];
      const cy = (v - DISSOLVE_CENTER[1]) * Y_SCALE;
      const r = Math.sqrt(cx * cx + cy * cy);
      const band = Math.exp(-((r - BAND_CENTER) ** 2) / (2 * BAND_WIDTH * BAND_WIDTH));

      const weight = gradient * subjectMask * band;
      if (weight < 0.01) continue;

      candidateUv.push([u, v]);
      candidateWeight.push(weight);
      candidateMix.push(lum[i]);
    }
  }

  const indices = candidateUv.map((_, i) => i);
  const picked = weightedSample(indices, candidateWeight, count);

  for (let i = 0; i < count; i++) {
    const idx = picked[i];
    const [u, v] = idx !== undefined ? candidateUv[idx] : [0.5, 0.5];
    const mixVal = idx !== undefined ? candidateMix[idx] : 0.5;

    positions[i * 3] = (u - 0.5) * 2;
    positions[i * 3 + 1] = (v - 0.5) * 2;
    positions[i * 3 + 2] = 0.05 + Math.random() * 0.2;

    seeds[i] = Math.random();
    sizes[i] = 2.0 + Math.random() * 3.0;
    orbits[i] = 0.004 + Math.random() * 0.012;
    mixes[i] = mixVal;
  }

  return { positions, seeds, sizes, orbits, mixes };
}

// --- Whole-subject dense grid, for the GPU-simulated body reconstruction ---
//
// Unlike the edge-band sampler above (sparse, weighted toward the dissolve boundary), this
// produces one sample per texel of a fixed width x height grid, suitable for baking into the
// DataTextures a GPUComputationRenderer simulation reads from. Every particle in the simulation
// corresponds to exactly one texel here, so the grid size *is* the particle count.

export type BodyParticleGrid = {
  width: number;
  height: number;
  // RGBA per texel: xyz = target position in plane-local space, w = subject alpha mask (0 = background)
  positions: Float32Array;
  // RGBA per texel: rgb = amber-hue-shifted color (source luminance preserved, per-particle
  // brightness variation pre-multiplied in), a = per-particle size multiplier
  colors: Float32Array;
};

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

// Shortest-path hue blend (hue is circular, 0..1) — used to nudge the fixed amber hue toward the
// source photo's own real hue at each particle, rather than jumping the long way around the wheel.
function blendHueShortest(base: number, target: number, t: number): number {
  let diff = target - base;
  diff -= Math.round(diff);
  return (((base + diff * t) % 1) + 1) % 1;
}

// Facial-completeness experiment: every particle so far has used a single fixed hue/saturation,
// varying only by lightness — discarding real chroma information the photo actually has (lips are
// genuinely more saturated/reddish than surrounding skin; sclera differs from iris). This restores
// a SMALL amount of that real hue/saturation, blended into the amber base rather than replacing it,
// so the aesthetic stays amber-dominant while features with real color difference get a chance to
// read as distinct from flat skin — a different information channel from local contrast, not
// another brightness/contrast push.
const HUE_BLEND_STRENGTH = 0.16;
const SATURATION_BLEND_STRENGTH = 0.35;

const FACE_CENTER: [number, number] = [0.5, 0.38];
// Local position jitter, in grid cells — enough to break the visible lattice, small enough
// relative to feature sizes that it can't cross a real edge (hairline, jaw) and blur the shape.
const POSITION_JITTER_CELLS = 1.1;

// Experiment (evidence-based, see the plan): every prior version of this grid applied a semantic
// importance gate — a tonal-presence curve, an anatomical zone-weight map, a density-remapping
// warp — that suppressed or repositioned real mid-tone image content based on a guess about which
// regions "matter." The one real reference implementation examined in detail (Codrops' particle-
// image tutorial) does none of that: position is a direct per-pixel/uniform grid, and its only
// filter is a trivial near-black performance cutoff, never a semantic weighting. This version
// removes all of that gating — uniform grid, mask-only presence (background exclusion, which is
// geometry, not a guess) — to test directly whether the gating itself was the recognizability gap.

// Minimal landmark aid, added after two independent experiments (this dense grid, and the
// separate L3 stippling attempt) both hit the same wall: real per-pixel luminance alone doesn't
// give the eyes, nose, and mouth enough contrast to read as shapes once rendered as small
// independent particles — even with placement, mask, and size all verified correct. This isn't a
// return to landmark-primary sampling; landmarks are used for exactly two narrow things, matching
// what's actually true about a face rather than guessing at broader "importance":
//  1. The eye and mouth interiors are genuine anatomical voids — carving real negative space there
//     gives a hard presence contrast (particles vs. none) that color/luminance alone can't, the
//     same mechanism that made those features legible in the landmark-contour work.
//  2. A mild darkening right along the nose's own detected line nudges definition into a real edge
//     the photo has, without touching anything else — position, color, and density everywhere else
//     stay exactly as the image-driven pipeline already produces them.
function pointInPolygon(u: number, v: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ui, vi] = polygon[i];
    const [uj, vj] = polygon[j];
    const intersects = vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui;
    if (intersects) inside = !inside;
  }
  return inside;
}

function groupPolygon(name: keyof typeof PORTRAIT_LANDMARK_GROUPS): [number, number][] {
  return PORTRAIT_LANDMARK_GROUPS[name].map((idx) => {
    const [x, y] = PORTRAIT_LANDMARKS[idx];
    return [x, y] as [number, number];
  });
}

const LEFT_EYE_POLY = groupPolygon("leftEye");
const RIGHT_EYE_POLY = groupPolygon("rightEye");
const LIPS_POLY = groupPolygon("lips");

// Eye-patch double-coverage "fix" — TRIED AND REVERTED. Measured that 75.5% of EyeDetailParticles'
// own particles (by area) sit outside the tight eye polygon, in the lid/brow/cheek margin, where
// this grid's own normal particles also render — a real, second layer of coverage stacking in that
// margin. Widening this grid's suppression to match the eye patch's full padded box was meant to
// remove that stacking, but it introduced a worse, clearly visible artifact: the eye patch's own
// alpha feathers to 0 at that same box edge, so with this grid also vacated there, NEITHER system
// rendered in a ring right around each eye — a visible dark gap, worse than the double-coverage it
// replaced (which was, incidentally, the thing filling that transition smoothly). Reverted
// immediately per instruction; the double-coverage margin remains, undiagnosed further this round.

const NOSE_POINTS = groupPolygon("nose");
const NOSE_LINE_RADIUS = 0.012;
// Multiple color/contrast-only passes (higher-resolution sampling, uniform boost, nose-specific
// boost, broad multi-scale boost, chroma restoration) confirmed the nose's real detail exists but
// established a genuine ceiling: coloring existing particles better cannot fix a shape that
// doesn't have enough particles in its own footprint to trace in the first place. This is the one
// lever that actually changes that — see NOSE_WARP_* below — a small, local, purely image-derived
// reallocation of the existing fixed grid, not an addition to it.

function nearestDistToNose(u: number, v: number): number {
  let best = Infinity;
  for (const [nu, nv] of NOSE_POINTS) {
    const d = Math.hypot(nu - u, nv - v);
    if (d < best) best = d;
  }
  return best;
}

// Nose-region particle reallocation: pulls existing grid cells within a small radius smoothly
// toward the nose's own centroid, giving that footprint more of the fixed particle budget without
// changing the total count. Deliberately different in kind from the piecewise density warp removed
// earlier in this project — that used discrete control points across the WHOLE frame, driven by
// guessed "importance," and both of those properties (frame-wide scope, guessed weighting) are what
// caused the original tearing/distortion failures. This is: (a) local — a smooth radial falloff to
// exactly zero at NOSE_WARP_RADIUS, so cells outside it are provably untouched, no frame-wide
// redistribution; (b) justified by measured information density (the nose's own detected landmark
// centroid), not a guess; (c) small in magnitude. Position and every source-sample lookup below use
// the SAME warped coordinate, so content still renders at its true location — nothing tears, only
// local density (how many grid cells land near the nose vs. just outside it) changes.
const NOSE_CENTER: [number, number] = (() => {
  let cu = 0;
  let cv = 0;
  for (const [u, v] of NOSE_POINTS) {
    cu += u;
    cv += v;
  }
  return [cu / NOSE_POINTS.length, cv / NOSE_POINTS.length];
})();
const NOSE_WARP_RADIUS = 0.055;
const NOSE_WARP_STRENGTH = 0.4;

function smoothstepLocal(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Shared local-warp primitive: pulls (u, v) smoothly toward `center` within `radius`, exactly zero
// displacement at and beyond the radius edge. warpTowardNose below is this same math, unchanged.
function warpTowardPoint(
  u: number,
  v: number,
  center: [number, number],
  radius: number,
  strength: number
): [number, number] {
  const dx = u - center[0];
  const dy = v - center[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= radius) return [u, v];
  const falloff = smoothstepLocal(radius, 0, dist);
  const pull = strength * falloff;
  return [u - dx * pull, v - dy * pull];
}

function warpTowardNose(u: number, v: number): [number, number] {
  return warpTowardPoint(u, v, NOSE_CENTER, NOSE_WARP_RADIUS, NOSE_WARP_STRENGTH);
}

// Density-consistency correction (compositing only — does not touch position, color, or luminance).
// Measured directly (not assumed): warpTowardNose locally compresses particle spacing, and area
// density under that compression peaks at ~2.72x the baseline grid density right at NOSE_CENTER
// (verified by comparing the warped spacing of two originally-adjacent grid cells against their
// original mainPitch spacing, at increasing distance from center). That local over-density — same
// per-particle alpha and point size as the rest of the grid, just packed closer together — is what
// composites toward visibly more opaque/"brighter" coverage than the surrounding uniform-density
// face, the same mechanism identified for the eye-detail patch (see eyeDetailSampling.ts), just
// smaller in magnitude here since the warp only redistributes the existing fixed grid rather than
// adding particles. A direct luminance check (nose center ~188 vs. surrounding cheek ~173, source
// photo) confirms the underlying brightness values themselves are only modestly different — a real,
// small highlight, not a distortion — so the fix targets coverage, not color. Reuses the warp's own
// falloff shape (peaks at the same center, zero at the same radius) since that falloff is literally
// what creates the density peak, rather than inventing an unrelated new shape.
const NOSE_DENSITY_ALPHA_SCALE = 0.7;

function noseDensityAlphaCompensation(u: number, v: number): number {
  const dx = u - NOSE_CENTER[0];
  const dy = v - NOSE_CENTER[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= NOSE_WARP_RADIUS) return 1;
  const falloff = smoothstepLocal(NOSE_WARP_RADIUS, 0, dist);
  return 1 - (1 - NOSE_DENSITY_ALPHA_SCALE) * falloff;
}

// Eye investigation, lever 1 of 2 — APPROVED, now the baseline (eyelid/eye-contour definition,
// tested before iris/pupil separation per explicit priority). A prior attempt at iris/pupil
// separation via a position warp (pulling grid cells toward each iris center, same mechanism as
// warpTowardNose) was implemented, verified tear-free, but judged too subtle at normal viewing size
// and reverted rather than kept as an unconfirmed change — see git history, not left in as dead code.
//
// This lever instead targets eyelid/eye-opening SHAPE, not interior detail: the eye polygon is
// currently used only to suppress interior alpha (m *= 0.32 below) — nothing marks the lid line
// itself, unlike the nose, which has NOSE_LINE_RADIUS darkening its real contour. Same mechanism,
// applied to the eye's own real landmark contour (LEFT_EYE_POLY/RIGHT_EYE_POLY vertices) instead of
// the nose polyline — a soft darkening right at the real eyelid edge the photo has, independent of
// polygon-membership (so it wraps both upper and lower lid), giving the eye-opening a defined
// boundary instead of relying on the interior-alpha step alone to imply its shape. Radius is much
// smaller than NOSE_LINE_RADIUS (0.012) because the entire eye is much smaller than the nose
// (~5.7 grid cells tall at 240 res) — sized to roughly one grid cell so it reads as a thin rim, not
// a fill.
const EYE_LINE_RADIUS = 0.006;

function nearestDistToEyeContour(u: number, v: number): number {
  let best = Infinity;
  for (const [pu, pv] of LEFT_EYE_POLY) {
    const d = Math.hypot(pu - u, pv - v);
    if (d < best) best = d;
  }
  for (const [pu, pv] of RIGHT_EYE_POLY) {
    const d = Math.hypot(pu - u, pv - v);
    if (d < best) best = d;
  }
  return best;
}

// Eyebrow-to-eye separation — TRIED AND REVERTED. A pure color lever (no particle moves): brighten
// only the narrow real strip close to both the eyebrow's own landmark contour and the eye's,
// product-of-two-Gaussians so it peaks in the ~0.011-wide gap between them, not on either line. At
// 4-6x zoom the separating band was visible; at the actual normal-viewing-size frame (900px, no
// zoom — the real bar) it was not reliably distinguishable from the pre-change baseline. Same
// failure mode as the reverted iris/pupil levers: the region is too small relative to the locked
// particle density and 1.6x point-size overlap for a fine color-only signal to survive down to true
// viewing scale. See git history for the reverted implementation.

// Eye investigation, lever 2 of 2 (iris/pupil separation) — TRIED AND REVERTED. Two independent
// mechanisms were tested: a position warp (pulling grid cells toward each iris center) and, after
// that was reverted as too subtle, a pure color/lightness lever (letting the real, uncompressed
// per-particle luminance show through near each iris center instead of the shared face-wide
// lightness mapping — no particle moves at all). Both read as only marginally different from the
// eye-contour-only baseline at normal viewing size. Direct measurement of the lightness formula
// ruled out the original hypothesis (that the shared mapping was "compressing away" the contrast —
// it's close to affine, so it wasn't). The real constraint is spatial: the entire eye interior is
// only ~53 grid cells, and at the locked 1.6x point size those particles' overlapping soft circles
// spatially blend adjacent colors together before the eye can resolve them as a ring, regardless of
// how much per-particle contrast the color computation assigns. Same shape of ceiling the nose hit —
// documented as a known limitation of the current particle resolution, not left in as a subtle,
// unconfirmed change. See git history for both reverted attempts.

// Separable box blur — used only to derive a local-contrast signal (src - blur(src)), never to
// blur what's actually rendered.
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
    }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / size;
      const addX = Math.min(w - 1, x + radius + 1);
      const subX = Math.max(0, x - radius);
      sum += src[y * w + addX] - src[y * w + subX];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      const addY = Math.min(h - 1, y + radius + 1);
      const subY = Math.max(0, y - radius);
      sum += tmp[addY * w + x] - tmp[subY * w + x];
    }
  }

  return out;
}

// Local-contrast boost: real facial shading (cheekbone shadow, jaw line, brow ridge, nasolabial
// fold) is present in the source luminance but subtle in an evenly-lit studio photo, and gets
// diluted further by the straight linear brightness mapping below. Unsharp-mask-style local
// contrast — comparing each pixel to a small-radius blur of itself and amplifying the difference —
// makes that real, already-present shading read clearly without inventing anything or moving a
// single particle. Radius is small (local detail only, not a global tone remap).
const LOCAL_CONTRAST_RADIUS = 3;
const LOCAL_CONTRAST_BOOST = 1.8;

// Color-sampling resolution, decoupled from the particle grid's own resolution (still exactly
// `width x height`, unchanged — positions, mask, and depth relief all keep reading from that).
// Measured directly (not assumed) that this was the nose/nostril bottleneck: at the grid's working
// resolution, the nose's own landmark bounding box covers only ~17x23 = 391 samples, and Sobel
// gradient magnitude in that box is comparable-to-stronger at higher resolution, not weaker —
// meaning the real local contrast is genuinely there in the source photo, just under-sampled at
// 240 to resolve as distinct sub-features (separate nostrils, a clear bridge line) rather than one
// generalized "somewhat higher contrast" patch. Raising only the resolution COLOR is read from —
// not point count, not point size, not any other region's treatment — targets exactly that gap.
const COLOR_SAMPLE_RES = 512;

export function buildBodyParticleGrid(
  image: HTMLImageElement | HTMLCanvasElement,
  bgColor: [number, number, number],
  width: number,
  height: number,
  options?: {
    // Structural resolution experiment (see eyeDetailSampling.ts) — opt-in, off by default so the
    // approved baseline is byte-identical unless explicitly testing this. When true, fully hides
    // this grid's own low-res eye-interior particles (instead of the approved 0.32 partial
    // suppression) so a separate, higher-density supplemental patch can own that footprint without
    // fighting a duplicate underneath it. Nothing else about this grid changes.
    suppressEyeInterior?: boolean;
  }
): BodyParticleGrid {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const positions = new Float32Array(width * height * 4);
  const colors = new Float32Array(width * height * 4);

  if (!ctx) {
    return { width, height, positions, colors };
  }

  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const w = width;
  const h = height;

  const [bgR, bgG, bgB] = bgColor;

  const lum = new Float32Array(w * h);
  const bgDist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    lum[i] = r * 0.299 + g * 0.587 + b * 0.114;
    bgDist[i] = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
  }
  const blurredLum = boxBlur(lum, w, h, LOCAL_CONTRAST_RADIUS);

  // Separate, higher-resolution luminance field for color only — see COLOR_SAMPLE_RES above for
  // why. Radius is scaled up proportionally so it represents the same physical extent as
  // LOCAL_CONTRAST_RADIUS does at the grid's own resolution, not a tighter or looser one.
  const colorRes = COLOR_SAMPLE_RES;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = colorRes;
  colorCanvas.height = colorRes;
  const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
  let colorLum = lum;
  let colorBlurred = blurredLum;
  let colorRGB: Uint8ClampedArray | null = null;
  if (colorCtx) {
    colorCtx.drawImage(image, 0, 0, colorRes, colorRes);
    const { data: colorData } = colorCtx.getImageData(0, 0, colorRes, colorRes);
    colorRGB = colorData;
    colorLum = new Float32Array(colorRes * colorRes);
    for (let i = 0; i < colorLum.length; i++) {
      colorLum[i] =
        (colorData[i * 4] / 255) * 0.299 + (colorData[i * 4 + 1] / 255) * 0.587 + (colorData[i * 4 + 2] / 255) * 0.114;
    }
    const colorContrastRadius = Math.max(1, Math.round(LOCAL_CONTRAST_RADIUS * (colorRes / w)));
    colorBlurred = boxBlur(colorLum, colorRes, colorRes, colorContrastRadius);
  }

  // Facial-completeness pass: the single-scale unsharp above (colorLum - colorBlurred) is one
  // fixed radius, uniformly boosted everywhere — it doesn't distinguish "this is a real edge"
  // (eyebrow line, eyelid crease, nostril rim, lip line, cheekbone transition) from "this is just
  // mid-tone noise." buildMultiScaleSignal — Sobel gradient + two-scale unsharp, combined and
  // normalized — already does exactly that distinction, already validated (it drives L3's fill
  // density in poissonFill.ts). Reusing it here rather than inventing a new signal: still purely
  // image-derived, no landmarks, no position/density/point-size change, no new algorithm.
  const edgeSignal = buildMultiScaleSignal(image, colorRes);

  // Border-flood-fill subject mask, not a raw per-pixel color-distance threshold. A bright
  // forehead or nose-bridge highlight can sit colorimetrically close to a light studio backdrop —
  // a plain threshold reads that as "background" and punches a hole in the middle of the face
  // (confirmed directly: the same gap appeared in the flat, colorless debug render, so it was a
  // presence bug, not a rendering one). Flooding inward from the frame border, gated by color
  // similarity, only marks pixels "background" if they're actually *connected* to the real
  // background region — a bright highlight fully enclosed by hair/skin has no such path, so it
  // stays part of the subject regardless of its own color. Purely geometric/connectivity-based,
  // no semantic judgment about which pixels matter.
  const BG_FLOOD_THRESHOLD = 0.3;
  const isBackground = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0;
  let qTail = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const idx = y * w + x;
      if (!isBackground[idx]) {
        isBackground[idx] = 1;
        queue[qTail++] = idx;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const idx = y * w + x;
      if (!isBackground[idx]) {
        isBackground[idx] = 1;
        queue[qTail++] = idx;
      }
    }
  }
  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % w;
    const y = (idx / w) | 0;
    const neighbors =
      x > 0 ? [idx - 1] : [];
    if (x < w - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - w);
    if (y < h - 1) neighbors.push(idx + w);
    for (const nIdx of neighbors) {
      if (!isBackground[nIdx] && bgDist[nIdx] < BG_FLOOD_THRESHOLD) {
        isBackground[nIdx] = 1;
        queue[qTail++] = nIdx;
      }
    }
  }

  const mask = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = isBackground[i] ? 0 : 1;
  }

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      // Uniform grid — no frame-wide density remap. Position and source-sample use the exact same
      // coordinate, so content always renders at its true screen location. The one exception is a
      // small, local, zero-at-the-edge pull toward the nose (see warpTowardNose) — cells outside
      // NOSE_WARP_RADIUS are returned completely unchanged, so this only reallocates within that
      // small footprint, not across the frame.
      const [gridU, gridVTopDown] = warpTowardNose(i / (width - 1), j / (height - 1));
      const baseU = gridU;
      const baseV = 1 - gridVTopDown;

      // Small local jitter — enough to break the visible lattice, bounded well within a feature's
      // own size so it can't blur real edges together.
      const jitterU = (Math.random() - 0.5) * (POSITION_JITTER_CELLS / width);
      const jitterV = (Math.random() - 0.5) * (POSITION_JITTER_CELLS / height);
      const u = Math.min(1, Math.max(0, baseU + jitterU));
      const v = Math.min(1, Math.max(0, baseV + jitterV));

      // Sample the source photo at the un-jittered grid coordinate.
      const srcX = Math.min(w - 1, Math.max(0, Math.round(gridU * (w - 1))));
      const srcY = Math.min(h - 1, Math.max(0, Math.round(gridVTopDown * (h - 1))));
      const srcIdx = srcY * w + srcX;
      const l = lum[srcIdx];

      // Presence is gated by the subject mask (background exclusion — geometry, not a guess about
      // which facial regions matter), plus a hard carve for the eye and mouth interiors — genuine
      // anatomical voids, not a guess about importance. Landmark coordinates are in the same
      // v-down convention as gridVTopDown, so this compares directly without a flip.
      let m = mask[srcIdx];
      const inEyeInterior =
        pointInPolygon(gridU, gridVTopDown, LEFT_EYE_POLY) || pointInPolygon(gridU, gridVTopDown, RIGHT_EYE_POLY);
      if (inEyeInterior || pointInPolygon(gridU, gridVTopDown, LIPS_POLY)) {
        // Facial-completeness experiment: every particle in this region already carries real
        // photo color (iris/sclera differentiation, lip highlight/shadow/volume) — the color
        // computation below never checks polygon membership, only presence does. The original
        // 0.08 was a blanket suppression to prevent the historical "eyes as blobs" failure, but it
        // discards that real interior detail regardless of what's actually there. Raised toward a
        // value that still keeps presence clearly lower than the surrounding face (so the negative-
        // space read isn't lost) while letting real content become visible rather than invisible.
        // 0.32, not 0.3 — the debug-mode discard threshold (BodyParticleMaterial.tsx) is also 0.3,
        // and float32 rounding through the texture pipeline landed on the wrong side of that exact
        // comparison, discarding nearly all of these particles in debug view specifically (confirmed
        // via the raw-debug render; the actual color render was unaffected). Clear margin avoids it.
        // suppressEyeInterior (structural resolution experiment) only overrides the EYE case, fully
        // hiding this grid's own eye particles for the supplemental patch to own — lips are always
        // the approved 0.32, untouched by this option.
        m = inEyeInterior && options?.suppressEyeInterior ? 0 : m * 0.32;
      }
      // Density-consistency correction (see noseDensityAlphaCompensation above) — compensates the
      // local over-coverage warpTowardNose creates, without touching the warp itself, position, or
      // color. No-op (returns 1) everywhere outside the already-warped nose radius.
      m *= noseDensityAlphaCompensation(gridU, gridVTopDown);

      const dstIdx = (j * width + i) * 4;

      // Depth, three layers so facial structure reads as genuinely dimensional rather than a flat
      // plane with grain on top:
      //  1. A broad paraboloid dome centered on the face — the head/face projects gently toward
      //     the viewer at its center and recedes toward the silhouette, like true relief.
      //  2. Luminance-driven fine relief — bright features (nose bridge, cheekbones) sit slightly
      //     forward, shadowed areas (eye sockets, under the jaw) sit slightly back.
      //  3. A small random jitter for organic texture, kept subordinate to the structured terms.
      const domeDx = baseU - FACE_CENTER[0];
      const domeDy = (1 - baseV - FACE_CENTER[1]) * 1.15;
      const domeR = Math.sqrt(domeDx * domeDx + domeDy * domeDy);
      const dome = Math.max(0, 1 - domeR * 1.7) * 0.14;
      const relief = (l - 0.5) * 0.22 + dome;
      const depthJitter = (Math.random() - 0.5) * 0.02;

      positions[dstIdx] = (u - 0.5) * 2;
      positions[dstIdx + 1] = (v - 0.5) * 2;
      positions[dstIdx + 2] = relief + depthJitter;
      positions[dstIdx + 3] = m;

      // Hue-shift to amber while keeping the source pixel's own local-contrast-enhanced luminance
      // as lightness — this is what preserves fold/shadow detail (dark fabric stays dark amber,
      // highlights stay bright amber) instead of collapsing everything through a 2-color duotone
      // gradient. Positions (including relief/depth above) are frozen and still use raw `l` from
      // the grid's own resolution — only the color lookup below reads from the higher-resolution
      // field, per the explicit instruction to expose existing detail without resampling anything.
      const colorX = Math.min(colorRes - 1, Math.max(0, Math.round(gridU * (colorRes - 1))));
      const colorY = Math.min(colorRes - 1, Math.max(0, Math.round(gridVTopDown * (colorRes - 1))));
      const colorIdx = colorY * colorRes + colorX;
      const lColor = colorLum[colorIdx];
      const detail = lColor - colorBlurred[colorIdx];
      // Boost strength now follows real image structure (Sobel + multi-scale contrast magnitude,
      // 0..1) instead of being flat everywhere — up to double at genuine edges (eyebrow line,
      // eyelid crease, nostril rim, lip line, cheekbone transition), unchanged at flat mid-tone
      // areas. Applies across the whole face, not one feature, and follows wherever the photo
      // actually has structure, not a fixed region.
      const edgeMag = edgeSignal.magnitude(gridU, gridVTopDown);
      const contrastBoost = LOCAL_CONTRAST_BOOST * (1 + edgeMag);
      const lEnhanced = Math.min(1, Math.max(0, lColor + detail * contrastBoost));
      // Mild darkening right along the nose's own detected line — a soft nudge toward a real edge
      // this photo has, not a fabricated one. Falls off within ~1cm-scale UV distance, so it can't
      // bleed into the cheeks or forehead.
      const noseFalloff = Math.exp(-(nearestDistToNose(gridU, gridVTopDown) ** 2) / (2 * NOSE_LINE_RADIUS * NOSE_LINE_RADIUS));
      // Eyelid/eye-contour definition (lever 1, see EYE_LINE_RADIUS above) — a soft darkening right
      // along the eye's own real contour, independent of whether this particle is inside or outside
      // the eye polygon, so it reinforces both lids as a visible boundary rather than relying on the
      // interior-alpha step alone to imply the eye's shape.
      const eyeContourFalloff = Math.exp(
        (-(nearestDistToEyeContour(gridU, gridVTopDown) ** 2)) / (2 * EYE_LINE_RADIUS * EYE_LINE_RADIUS)
      );
      const lightness = (0.12 + lEnhanced * 0.72) * (1 - noseFalloff * 0.3) * (1 - eyeContourFalloff * 0.4);
      // Blend a small amount of the source pixel's own real hue/saturation into the fixed amber
      // base — lips reading more saturated/reddish than skin, sclera differing from iris, are real
      // distinguishing information this pipeline discarded entirely until now. Kept deliberately
      // small (16%/35% blend) so the amber character stays dominant; this is a color-channel
      // restoration, not another contrast/brightness push.
      let hue = AMBER_HUE;
      let saturation = AMBER_SATURATION;
      if (colorRGB) {
        const [realH, realS] = rgbToHsl(
          colorRGB[colorIdx * 4] / 255,
          colorRGB[colorIdx * 4 + 1] / 255,
          colorRGB[colorIdx * 4 + 2] / 255
        );
        // Hue is numerically unstable near zero saturation — a near-black or near-gray pixel (like
        // most of the hair) has an essentially random hue reading, since tiny channel differences
        // produce wildly different angles once there's almost no real color to measure. Scaling the
        // blend by the source's own saturation means a colorless pixel contributes ~0 hue shift
        // (stays pure amber) instead of injecting that noise — confirmed as a real artifact (stray
        // green/red flecks in the hair) before this fix, not a hypothetical one.
        hue = blendHueShortest(AMBER_HUE, realH, HUE_BLEND_STRENGTH * realS);
        saturation = Math.min(1, Math.max(0, AMBER_SATURATION * (1 - SATURATION_BLEND_STRENGTH) + realS * SATURATION_BLEND_STRENGTH * 1.3));
      }
      const [ar, ag, ab] = hslToRgb(hue, saturation, lightness);
      // Brightness variation: a tight per-particle random flicker — tightened from ±15% to ±8% so
      // it doesn't compete with the local-contrast signal now doing real work; the wider range was
      // comparable in magnitude to the actual shading it needs to let through clearly.
      const brightnessMult = 0.92 + Math.random() * 0.16;
      colors[dstIdx] = ar * brightnessMult;
      colors[dstIdx + 1] = ag * brightnessMult;
      colors[dstIdx + 2] = ab * brightnessMult;
      // Size variation: random per-particle only.
      colors[dstIdx + 3] = 0.75 + Math.random() * 0.35;
    }
  }

  return { width, height, positions, colors };
}
