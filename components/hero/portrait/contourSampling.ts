// Layer 1 (structure): places particles directly on the detected facial contour geometry, rather
// than inferring feature shape from image statistics. An eye reads as an eye because its outline
// literally is the eye contour MediaPipe detected in this photo — not because particles happened
// to cluster where tone or gradient suggested "eye-like." See the plan file for the reasoning
// behind this replacing the previous edge/tone-driven sampling entirely.

import {
  PORTRAIT_LANDMARKS,
  PORTRAIT_LANDMARK_GROUPS,
  PORTRAIT_CLOSED_GROUPS,
} from "./portraitLandmarks";

export type ContourPoint = {
  // Plane-local UV, standard image convention: u right, v DOWN (top-left origin) — same
  // convention as PORTRAIT_LANDMARKS itself. Callers flip to world-space the same way
  // edgeSampling.ts already does for the raw photo.
  u: number;
  v: number;
  group: string;
};

function contourLength(points: [number, number][], closed: boolean): number {
  let total = 0;
  const n = points.length;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

// Resamples a closed or open polyline at even arc-length intervals — the source landmark points
// themselves aren't evenly spaced (MediaPipe places more of them where its own model needed
// precision, not where we want visual density), so walking the raw points directly would give an
// uneven, occasionally gappy line. This walks the true path length instead.
function resampleAlongPath(points: [number, number][], closed: boolean, spacing: number): [number, number][] {
  const n = points.length;
  const segments = closed ? n : n - 1;
  const total = contourLength(points, closed);
  if (total < 1e-6 || segments <= 0) return points.slice();

  const count = Math.max(2, Math.round(total / spacing));
  const out: [number, number][] = [];

  let segIdx = 0;
  let segStart = points[0];
  let segEnd = points[1 % n];
  let segLen = Math.hypot(segEnd[0] - segStart[0], segEnd[1] - segStart[1]);
  let accumulated = 0;
  let distanceIntoSeg = 0;

  for (let i = 0; i < count; i++) {
    const targetDist = (i / count) * total;
    while (accumulated + segLen < targetDist && segIdx < segments - 1) {
      accumulated += segLen;
      segIdx++;
      segStart = points[segIdx % n];
      segEnd = points[(segIdx + 1) % n];
      segLen = Math.hypot(segEnd[0] - segStart[0], segEnd[1] - segStart[1]);
    }
    distanceIntoSeg = segLen > 1e-6 ? (targetDist - accumulated) / segLen : 0;
    const u = segStart[0] + (segEnd[0] - segStart[0]) * distanceIntoSeg;
    const v = segStart[1] + (segEnd[1] - segStart[1]) * distanceIntoSeg;
    out.push([u, v]);
  }

  return out;
}

// Target spacing between resampled points, in normalized UV units, per feature group — smaller
// spacing on the finer features (eyes, lips) so they stay crisp at a smaller absolute size than
// the face oval.
const GROUP_SPACING: Record<string, number> = {
  faceOval: 0.008,
  leftEyebrow: 0.005,
  rightEyebrow: 0.005,
  leftEye: 0.0035,
  rightEye: 0.0035,
  nose: 0.005,
  lips: 0.004,
};

// Small local jitter, in UV units, applied AFTER resampling — enough to break the perfectly even
// mechanical spacing so the contour reads as organic dust tracing a shape rather than a drafted
// line, without ever displacing a point far enough to blur which feature it belongs to.
const JITTER = 0.0015;

export function buildContourPoints(): ContourPoint[] {
  const out: ContourPoint[] = [];

  for (const [group, indices] of Object.entries(PORTRAIT_LANDMARK_GROUPS)) {
    const closed = PORTRAIT_CLOSED_GROUPS.has(group as keyof typeof PORTRAIT_LANDMARK_GROUPS);
    const points: [number, number][] = indices.map((idx) => {
      const [x, y] = PORTRAIT_LANDMARKS[idx];
      return [x, y];
    });
    const spacing = GROUP_SPACING[group] ?? 0.006;
    const resampled = resampleAlongPath(points, closed, spacing);

    for (const [u, v] of resampled) {
      out.push({
        u: u + (Math.random() - 0.5) * JITTER,
        v: v + (Math.random() - 0.5) * JITTER,
        group,
      });
    }
  }

  return out;
}

// Checkpoint L2 verification only: packs the contour points into the same {width, height,
// positions, colors} shape BodyParticles.tsx already knows how to render (one particle per
// texel, RGBA position with w = presence, RGBA color) so the existing static/debug rendering
// path can be reused as-is — a 1-row texture is well within any GPU's max-texture-width limit at
// these point counts (low hundreds).
export function buildContourGrid(): { width: number; height: number; positions: Float32Array; colors: Float32Array } {
  const points = buildContourPoints();
  const count = Math.max(1, points.length);
  const positions = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);

  points.forEach((p, i) => {
    const worldX = (p.u - 0.5) * 2;
    const worldY = (0.5 - p.v) * 2;
    positions[i * 4] = worldX;
    positions[i * 4 + 1] = worldY;
    positions[i * 4 + 2] = 0;
    positions[i * 4 + 3] = 1; // always present — a real detected contour point

    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = 1; // size multiplier
  });

  return { width: count, height: 1, positions, colors };
}
