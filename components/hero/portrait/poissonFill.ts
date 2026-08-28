// Layer 2 (fill): a sparser, density-weighted point fill for the areas Layer 1's contours don't
// cover — the interior facial planes (forehead, cheeks, chin, temples), and everything in the
// subject mask outside the face oval (hair, neck, jacket). Face-interior density is dominated by
// the real photo's own multi-scale local contrast/gradient (see buildMultiScaleSignal below) —
// eyelids, eyebrows, nostrils, nose bridge, and lip contours draw more fill because they're real
// detail in the image, not because a landmark line says so. Landmark proximity (buildFeatureEmphasis)
// is kept only as a lightweight structural aid, not the dominant signal. The surrounding fill's
// density stays luminance-driven, same as before. Neither ever affects POSITION or shape —
// shape/region comes from the face-oval landmark polygon and the same background-color-distance
// subject mask already used for the body grid, both purely geometric/structural signals.
//
// Construction: weighted dart-throwing, the standard rejection-sampling construction for
// Poisson-disk-style blue-noise point sets with a spatially-varying target radius. It's the
// simpler cousin of Yuksel's weighted sample elimination (both target the same "minimum-distance,
// importance-weighted density" result) — sample elimination refines a large candidate pool down
// to an exact count via iterative removal; dart-throwing constructs the set directly by rejecting
// candidates too close to existing points, terminating on a failed-attempt budget rather than an
// exact count. Chosen for its much lower runtime cost (spatial-hash-backed, near-linear) at no
// meaningful quality cost for a fill layer, where an exact point count doesn't matter.
//
// Layer 1's own points are seeded into the same occupancy structure before either fill pass
// starts, so no fill candidate can land closer to an existing contour point than its own desired
// spacing allows — this is also what keeps the fill out of negative spaces too small to fit a
// fill point in at all (an emergent property of dart-throwing's minimum-distance rule, not a rule
// of its own), like the eye and mouth interiors already ringed tightly by contour.

import { PORTRAIT_LANDMARKS, PORTRAIT_LANDMARK_GROUPS } from "./portraitLandmarks";
import type { ContourPoint } from "./contourSampling";

export type FillPoint = { u: number; v: number; region: "face" | "body" };

type Occupant = { u: number; v: number };

class SpatialHash {
  private cellSize: number;
  private cells = new Map<string, Occupant[]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  insert(o: Occupant) {
    const cx = Math.floor(o.u / this.cellSize);
    const cy = Math.floor(o.v / this.cellSize);
    const key = `${cx}:${cy}`;
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(o);
    else this.cells.set(key, [o]);
  }

  // Rejects a candidate only against its OWN desired radius, not any existing occupant's — an
  // earlier version used the larger of the two, which made any sparse-desired candidate (e.g. a
  // bright forehead highlight wanting a big radius) treat every nearby contour point as if it too
  // demanded that same large clearance, excluding most of the interior before any fill could land.
  // Each point owning only its own personal space is the standard weighted-dart-throwing rule.
  hasNeighborWithin(u: number, v: number, minDist: number): boolean {
    const cx = Math.floor(u / this.cellSize);
    const cy = Math.floor(v / this.cellSize);
    const span = Math.max(1, Math.ceil(minDist / this.cellSize));
    for (let dy = -span; dy <= span; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        const bucket = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const o of bucket) {
          const d = Math.hypot(o.u - u, o.v - v);
          if (d < minDist) return true;
        }
      }
    }
    return false;
  }
}

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

// Inflates a polygon outward from its own centroid — used so the face fill reaches all the way
// to the jaw/hairline edge rather than stopping a hair short of the actual landmark contour.
function inflatePolygon(polygon: [number, number][], scale: number): [number, number][] {
  let cu = 0;
  let cv = 0;
  for (const [u, v] of polygon) {
    cu += u;
    cv += v;
  }
  cu /= polygon.length;
  cv /= polygon.length;
  return polygon.map(([u, v]) => [cu + (u - cu) * scale, cv + (v - cv) * scale] as [number, number]);
}

export type ImageSampler = {
  luminance: (u: number, v: number) => number;
  subjectMask: (u: number, v: number) => number;
};

export function buildImageSampler(
  image: HTMLImageElement | HTMLCanvasElement,
  bgColor: [number, number, number],
  res = 256
): ImageSampler {
  const canvas = document.createElement("canvas");
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const [bgR, bgG, bgB] = bgColor;

  if (!ctx) {
    return { luminance: () => 0.5, subjectMask: () => 0 };
  }

  ctx.drawImage(image, 0, 0, res, res);
  const { data } = ctx.getImageData(0, 0, res, res);

  const sampleAt = (u: number, v: number) => {
    const x = Math.min(res - 1, Math.max(0, Math.round(u * (res - 1))));
    const y = Math.min(res - 1, Math.max(0, Math.round(v * (res - 1))));
    const i = (y * res + x) * 4;
    return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255] as const;
  };

  return {
    luminance: (u, v) => {
      const [r, g, b] = sampleAt(u, v);
      return r * 0.299 + g * 0.587 + b * 0.114;
    },
    subjectMask: (u, v) => {
      const [r, g, b] = sampleAt(u, v);
      const bgDist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
      return Math.min(1, Math.max(0, (bgDist - 0.35) / 0.2));
    },
  };
}

// Multi-scale local contrast + gradient field — the fill's primary density/color signal. Two
// related queries, both derived from the same real image data, never from landmarks:
//   magnitude(u,v)    0..1, unsigned — "how much real detail is here." Drives WHERE the fill
//                      concentrates: eyelids, eyebrows, nostrils, nose bridge, and lip contours
//                      score high because they're real edges/texture in the photo, not because a
//                      landmark line says so.
//   signedDetail(u,v)  can be negative — the fine-scale unsharp residual. Drives per-point color
//                      contrast (an eyelid crease reads darker, a nose-bridge highlight reads
//                      brighter), the same technique already used for the dense-grid checkpoint.
// Combines a Sobel gradient pass with two-scale unsharp detail (fine + coarse blur radius) so both
// hard edges (a lip line) and softer shading transitions (a cheek-to-jaw plane change) register —
// a single scale either misses the soft transitions or turns fine detail to noise.
export type MultiScaleSignal = {
  magnitude: (u: number, v: number) => number;
  signedDetail: (u: number, v: number) => number;
};

function sobelMagnitude(lum: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -lum[i - w - 1] + lum[i - w + 1] - 2 * lum[i - 1] + 2 * lum[i + 1] - lum[i + w - 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

// Separable box blur — duplicated locally rather than imported, matching this codebase's existing
// pattern of small shared helpers (e.g. hslToRgb) living independently in each file that needs one.
function boxBlurField(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / size;
      sum += src[y * w + Math.min(w - 1, x + radius + 1)] - src[y * w + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
  return out;
}

export function buildMultiScaleSignal(image: HTMLImageElement | HTMLCanvasElement, res = 256): MultiScaleSignal {
  const canvas = document.createElement("canvas");
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { magnitude: () => 0, signedDetail: () => 0 };

  ctx.drawImage(image, 0, 0, res, res);
  const { data } = ctx.getImageData(0, 0, res, res);
  const lum = new Float32Array(res * res);
  for (let i = 0; i < res * res; i++) {
    lum[i] = (data[i * 4] / 255) * 0.299 + (data[i * 4 + 1] / 255) * 0.587 + (data[i * 4 + 2] / 255) * 0.114;
  }

  const grad = sobelMagnitude(lum, res, res);
  const blurFine = boxBlurField(lum, res, res, 2);
  const blurCoarse = boxBlurField(lum, res, res, 6);
  const detailFine = new Float32Array(res * res);
  const combined = new Float32Array(res * res);
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < res * res; i++) {
    detailFine[i] = lum[i] - blurFine[i];
    const detailCoarse = lum[i] - blurCoarse[i];
    const v = grad[i] + Math.abs(detailFine[i]) * 1.2 + Math.abs(detailCoarse) * 0.6;
    combined[i] = v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const range = Math.max(1e-6, maxV - minV);
  for (let i = 0; i < res * res; i++) combined[i] = (combined[i] - minV) / range;

  const idxAt = (u: number, v: number) => {
    const x = Math.min(res - 1, Math.max(0, Math.round(u * (res - 1))));
    const y = Math.min(res - 1, Math.max(0, Math.round(v * (res - 1))));
    return y * res + x;
  };

  return {
    magnitude: (u, v) => combined[idxAt(u, v)],
    signedDetail: (u, v) => detailFine[idxAt(u, v)],
  };
}

function dartThrow(opts: {
  region: "face" | "body";
  contains: (u: number, v: number) => boolean;
  baseSpacing: number;
  densityAt: (u: number, v: number) => number; // 0..1, higher = denser (smaller radius)
  minSpacingScale: number;
  maxSpacingScale: number;
  occupancy: SpatialHash;
  bounds: { uMin: number; uMax: number; vMin: number; vMax: number };
  maxAttempts: number;
}): FillPoint[] {
  const { region, contains, baseSpacing, densityAt, minSpacingScale, maxSpacingScale, occupancy, bounds, maxAttempts } =
    opts;
  const out: FillPoint[] = [];
  let attempts = 0;
  let misses = 0;
  // Dense pre-seeded occupants (Layer 1's contour clearance) mean a large share of early random
  // draws land in an excluded halo before the fill has placed anything of its own — the
  // consecutive-miss budget has to be generous enough to sample through that, or dart-throwing
  // quits while most of the open interior is still empty (this is exactly what happened at the
  // first pass: an 8% missBudget cut the face fill off at ~18 points).
  const missBudget = Math.max(2000, maxAttempts * 0.9);

  while (attempts < maxAttempts && misses < missBudget) {
    attempts++;
    const u = bounds.uMin + Math.random() * (bounds.uMax - bounds.uMin);
    const v = bounds.vMin + Math.random() * (bounds.vMax - bounds.vMin);
    if (!contains(u, v)) {
      misses++;
      continue;
    }

    const density = densityAt(u, v);
    const spacingScale = maxSpacingScale - density * (maxSpacingScale - minSpacingScale);
    const r = baseSpacing * spacingScale;

    if (occupancy.hasNeighborWithin(u, v, r)) {
      misses++;
      continue;
    }

    occupancy.insert({ u, v });
    out.push({ u, v, region });
    misses = 0;
  }

  return out;
}

const FACE_OVAL_INFLATE = 1.05;
// The face oval's own bounding box is small (roughly a quarter of the frame) and already carries
// seven separate contour lines (oval, 2 brows, 2 eyes, nose, lips) threading through it — each
// occupying its own personal-space radius. A spacing tuned for a whole-image fill (the first pass
// used 0.024, sized more for the wider body/jacket area) left too little room in the gaps between
// those lines for more than a handful of points. This is deliberately close to Layer 1's own
// spacing, not a large multiple of it — visual sparseness relative to Layer 1 comes from the fill
// being area-filling (2D) against Layer 1's line-following (1D), not from a coarser point spacing.
const FACE_FILL_BASE_SPACING = 0.011;
const FACE_FILL_MIN_SCALE = 0.5;
const FACE_FILL_MAX_SCALE = 1.4;
const FACE_FILL_MAX_ATTEMPTS = 60000;

// Everything in the subject mask outside the face oval — hair (crown, sides, any strands beside
// or over the shoulders), neck, and jacket. An earlier version bounded this to v >= the oval's own
// bottom edge (chin level) on the theory that it was "the body region"; that silently excluded
// the entire hair mass, which sits mostly ABOVE and BESIDE the oval, not below it — hair was never
// sampled by either pass. Hair and jacket are visually similar here (both near-black), and hair
// genuinely does drape over the jacket in the photo, so one region covering the full subject mask
// outside the oval — rather than an artificial hair/jacket split by height — matches reality.
const BODY_FILL_BASE_SPACING = 0.018;
const BODY_FILL_MIN_SCALE = 0.7;
const BODY_FILL_MAX_SCALE = 1.7;
const BODY_FILL_MAX_ATTEMPTS = 130000;

// Feature-aware emphasis field: density driven by proximity to real anatomical structure
// (detected landmarks), not by how the region happens to be lit. A uniform tonal fill can't tell
// "the eye socket" from "a shadow that happened to fall on the forehead" — this can, because it's
// built directly from Layer 1's own grouped contour points rather than pixel statistics. The
// forehead reads sparser not because of an explicit forehead rule, but because it's simply far
// from every emphasis source below — an emergent result of the same kind the project has
// converged on for every other structural decision so far.
type EmphasisSource = { points: { u: number; v: number }[]; radius: number; weight: number };

function nearestDist(points: { u: number; v: number }[], u: number, v: number): number {
  let best = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.u - u, p.v - v);
    if (d < best) best = d;
  }
  return best;
}

function gaussianFalloff(d: number, radius: number): number {
  if (!Number.isFinite(d)) return 0;
  return Math.exp(-(d * d) / (2 * radius * radius));
}

function buildFeatureEmphasis(layer1Points: ContourPoint[]): (u: number, v: number) => number {
  const byGroup = (name: string) => layer1Points.filter((p) => p.group === name).map((p) => ({ u: p.u, v: p.v }));

  const eyeSocket = [...byGroup("leftEyebrow"), ...byGroup("rightEyebrow"), ...byGroup("leftEye"), ...byGroup("rightEye")];
  const nose = byGroup("nose");
  const mouth = byGroup("lips");
  const oval = byGroup("faceOval");

  // Jaw/chin: oval points below the mouth entirely. Cheek: oval points spanning roughly nose-tip
  // to mouth-bottom level (the lateral edge where the cheekbone meets the jaw) — both thresholds
  // read directly off this photo's own detected landmarks, not assumed proportions.
  const noseTipV = nose.reduce((m, p) => Math.max(m, p.v), 0);
  const mouthTopV = mouth.reduce((m, p) => Math.min(m, p.v), 1);
  const mouthBottomV = mouth.reduce((m, p) => Math.max(m, p.v), 0);

  const jawArc = oval.filter((p) => p.v > mouthBottomV);
  const cheekArc = oval.filter((p) => p.v > noseTipV && p.v <= mouthBottomV);

  // Jaw and cheek use noticeably tighter radii than eyes/nose/mouth — those two are drawn from
  // the face-oval boundary itself, which runs the full width and height of the lower face, so a
  // radius sized like the other features' would blanket almost the entire lower half rather than
  // reading as a transition band near the actual edge.
  const sources: EmphasisSource[] = [
    { points: eyeSocket, radius: 0.04, weight: 1.0 },
    { points: nose, radius: 0.035, weight: 0.95 },
    { points: mouth, radius: 0.04, weight: 0.9 },
    { points: jawArc, radius: 0.02, weight: 0.75 },
    { points: cheekArc, radius: 0.022, weight: 0.6 },
  ];

  return (u, v) => {
    // Max, not sum — overlapping falloffs (e.g. the zone between nose and mouth, or between eye
    // and cheek arc) shouldn't stack past what any single feature already implies, which is what
    // was flattening most of the face interior into a uniform "everything is emphasized" result.
    let e = 0;
    for (const s of sources) {
      if (s.points.length === 0) continue;
      e = Math.max(e, s.weight * gaussianFalloff(nearestDist(s.points, u, v), s.radius));
    }
    return e;
  };
}

function faceDensityAt(
  sampler: ImageSampler,
  signal: MultiScaleSignal,
  emphasisAt: (u: number, v: number) => number,
  u: number,
  v: number
): number {
  const l = sampler.luminance(u, v);
  const darkness = Math.max(0, 1 - l);
  const contrast = signal.magnitude(u, v);
  const emphasis = emphasisAt(u, v);
  // Multi-scale image contrast/gradient is now the dominant density term — this is what makes
  // eyelids, eyebrows, nostrils, nose bridge, and lip contours draw more fill particles, because
  // they're real detail the photo actually has, not because a landmark line says so. Landmark
  // emphasis is reduced to a lightweight structural aid (0.68 -> 0.15) rather than removed
  // outright, per the explicit instruction: don't increase landmark influence, but it can still
  // help stabilize the small failure-prone regions. Darkness stays as a secondary shading-massing
  // term, same role it always had.
  return Math.min(1, 0.06 + 0.55 * contrast + 0.24 * darkness + 0.15 * emphasis);
}

function bodyDensityAt(sampler: ImageSampler, u: number, v: number): number {
  const l = sampler.luminance(u, v);
  return Math.min(1, Math.max(0, 1 - l) * 0.5 + 0.35);
}

// Experiment: the eye interior has been pure negative space up to now (an emergent effect of
// dart-throwing's minimum-distance rule against Layer 1's own densely-packed eye contour — no
// candidate can fit near the center of a region that small once its own personal-space radius is
// accounted for). That was the right fix for the historical "eyes as oversized glowing blobs"
// failure, but it also means the render contains literally zero information about iris, pupil, or
// catchlight — not weak, absent. This is a narrow, separate, tightly-capped fill pass restricted
// to the eye interior polygons, testing whether restoring a small amount of real image-driven
// detail there — not a return to dense clustering — moves recognizability. Same density signal
// (multi-scale contrast + darkness) as the rest of the face fill, so a genuinely dark, high-
// contrast pupil/iris naturally draws more of this small budget than the surrounding sclera does.
// Deliberately coarser spacing and a small attempt budget keep this from ever becoming a blob
// again; sharing the same occupancy structure as everything else means these points still can't
// crowd the eyelid line itself, preserving the crisp contour that already reads well.
const EYE_INTERIOR_BASE_SPACING = 0.008;
const EYE_INTERIOR_MIN_SCALE = 0.6;
const EYE_INTERIOR_MAX_SCALE = 1.3;
const EYE_INTERIOR_MAX_ATTEMPTS = 4000;

function eyeInteriorDensityAt(sampler: ImageSampler, signal: MultiScaleSignal, u: number, v: number): number {
  const l = sampler.luminance(u, v);
  const darkness = Math.max(0, 1 - l);
  const contrast = signal.magnitude(u, v);
  return Math.min(1, 0.1 + 0.5 * contrast + 0.4 * darkness);
}

export function buildFillPoints(
  image: HTMLImageElement | HTMLCanvasElement,
  bgColor: [number, number, number],
  layer1Points: ContourPoint[],
  signal: MultiScaleSignal = buildMultiScaleSignal(image),
  // Diagnostic-only override for the face-fill point budget, isolated to exactly this one
  // variable — the density-sweep experiment. Everything else (density formula, min/max spacing
  // scale, eye-interior handling, body fill) stays exactly as it already is at every step.
  faceFillBaseSpacingOverride?: number
): FillPoint[] {
  const sampler = buildImageSampler(image, bgColor);
  const faceFillSpacing = faceFillBaseSpacingOverride ?? FACE_FILL_BASE_SPACING;

  const ovalRaw: [number, number][] = PORTRAIT_LANDMARK_GROUPS.faceOval.map((idx) => {
    const [x, y] = PORTRAIT_LANDMARKS[idx];
    return [x, y];
  });
  const ovalInflated = inflatePolygon(ovalRaw, FACE_OVAL_INFLATE);

  let ovalUMin = 1;
  let ovalUMax = 0;
  let ovalVMin = 1;
  let ovalVMax = 0;
  for (const [u, v] of ovalInflated) {
    ovalUMin = Math.min(ovalUMin, u);
    ovalUMax = Math.max(ovalUMax, u);
    ovalVMin = Math.min(ovalVMin, v);
    ovalVMax = Math.max(ovalVMax, v);
  }

  const occupancy = new SpatialHash(0.01);
  for (const p of layer1Points) {
    occupancy.insert({ u: p.u, v: p.v });
  }

  const emphasisAt = buildFeatureEmphasis(layer1Points);

  // A denser target spacing needs proportionally more dart-throwing attempts to actually reach
  // its own natural saturation point (more, smaller gaps to find) — this scales the attempt
  // budget to keep each density step properly saturated, not artificially starved by a fixed
  // budget tuned for the original spacing. Mechanical, not a density-formula or weight change.
  const faceMaxAttempts = Math.round(FACE_FILL_MAX_ATTEMPTS * (FACE_FILL_BASE_SPACING / faceFillSpacing) ** 2);

  const faceFill = dartThrow({
    region: "face",
    contains: (u, v) => pointInPolygon(u, v, ovalInflated),
    baseSpacing: faceFillSpacing,
    densityAt: (u, v) => faceDensityAt(sampler, signal, emphasisAt, u, v),
    minSpacingScale: FACE_FILL_MIN_SCALE,
    maxSpacingScale: FACE_FILL_MAX_SCALE,
    occupancy,
    bounds: { uMin: ovalUMin, uMax: ovalUMax, vMin: ovalVMin, vMax: ovalVMax },
    maxAttempts: faceMaxAttempts,
  });

  const bodyFill = dartThrow({
    region: "body",
    contains: (u, v) => sampler.subjectMask(u, v) > 0.5 && !pointInPolygon(u, v, ovalInflated),
    baseSpacing: BODY_FILL_BASE_SPACING,
    densityAt: (u, v) => bodyDensityAt(sampler, u, v),
    minSpacingScale: BODY_FILL_MIN_SCALE,
    maxSpacingScale: BODY_FILL_MAX_SCALE,
    occupancy,
    bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
    maxAttempts: BODY_FILL_MAX_ATTEMPTS,
  });

  const eyeInteriorFill: FillPoint[] = [];
  for (const group of ["leftEye", "rightEye"] as const) {
    const poly: [number, number][] = PORTRAIT_LANDMARK_GROUPS[group].map((idx) => {
      const [x, y] = PORTRAIT_LANDMARKS[idx];
      return [x, y];
    });
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
    eyeInteriorFill.push(
      ...dartThrow({
        region: "face",
        contains: (u, v) => pointInPolygon(u, v, poly),
        baseSpacing: EYE_INTERIOR_BASE_SPACING,
        densityAt: (u, v) => eyeInteriorDensityAt(sampler, signal, u, v),
        minSpacingScale: EYE_INTERIOR_MIN_SCALE,
        maxSpacingScale: EYE_INTERIOR_MAX_SCALE,
        occupancy,
        bounds: { uMin, uMax, vMin, vMax },
        maxAttempts: EYE_INTERIOR_MAX_ATTEMPTS,
      })
    );
  }

  return [...faceFill, ...bodyFill, ...eyeInteriorFill];
}
