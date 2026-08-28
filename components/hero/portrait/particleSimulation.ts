import * as THREE from "three";
import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import type { BodyParticleGrid } from "./edgeSampling";

// Compact 2D simplex noise (Ashima Arts / Ian McEwan, MIT) — sampled on three different axis
// pairs below to fake a cheap 3D "curl-ish" wander field without a true curl-noise implementation.
const NOISE_GLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

const VELOCITY_SHADER = `
  uniform float uDelta;
  uniform float uTime;
  uniform sampler2D uTargetTexture;
  ${NOISE_GLSL}

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    vec4 target = texture2D(uTargetTexture, uv);

    // A slow, coherent pulse applied to every particle's target in unison — this is the actual
    // "breathing": the whole form gently advances/recedes together, distinct from the independent
    // per-particle noise below. Amplitude halved (0.014 -> 0.008) from the value tuned for the
    // original, much larger/softer Checkpoint-A-era particles — at the current tight 1.6x grain,
    // the old value read as noticeably more motion than intended; re-verify before increasing.
    float breathe = sin(uTime * 0.45) * 0.008;
    vec3 breatheTarget = target.xyz + vec3(0.0, 0.0, breathe);

    // Spring force back toward the (breathing) photo-derived target position — this is what keeps
    // the simulation recognizable instead of drifting into an unrecognizable cloud. Stiffened
    // (6 -> 9) so particles track their targets more tightly than before. Went to 16 first, but
    // that combined with a large frame delta (e.g. a slow device, or a tab-switch stall) pushed
    // the explicit-Euler integration past its stability margin and the simulation visibly
    // diverged — 9 plus the delta clamp in BodyParticles.tsx is a safer margin.
    vec3 toTarget = breatheTarget - pos.xyz;
    vec3 spring = toTarget * 9.0;

    // Cheap pseudo-3D wander: sample 2D noise on three axis pairs. Independent per-particle
    // turbulence — deliberately gentle, organic texture rather than the coordinated breathing above.
    // Amplitude cut to under a quarter of the original (0.035 -> 0.008, roughly one grid-pitch at
    // the current 240x240/1.6x density) — the original was tuned against much larger, softer,
    // heavily-overlapping particles that could absorb that much drift invisibly; today's tight,
    // discrete grain cannot, so this starts conservative pending direct visual verification.
    vec3 noiseCoord = pos.xyz * 1.6 + uTime * 0.12;
    vec3 wander = vec3(
      snoise(noiseCoord.xy),
      snoise(noiseCoord.yz + 17.3),
      snoise(noiseCoord.zx + 42.1)
    ) * 0.008;

    // More damping (0.88 -> 0.8) to match the stiffer spring — settles quickly instead of
    // oscillating around the target.
    vec3 newVel = (vel.xyz + (spring + wander) * uDelta) * 0.8;
    gl_FragColor = vec4(newVel, 1.0);
  }
`;

const POSITION_SHADER = `
  uniform float uDelta;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    // Carry the subject alpha mask (baked into position.w at init) through unchanged — it never
    // needs to be simulated, only the xyz position does.
    gl_FragColor = vec4(pos.xyz + vel.xyz * uDelta, pos.w);
  }
`;

export type ParticleSimulation = {
  gpuCompute: GPUComputationRenderer;
  positionVariable: Variable;
  velocityVariable: Variable;
  targetTexture: THREE.DataTexture;
};

export function createParticleSimulation(
  renderer: THREE.WebGLRenderer,
  grid: BodyParticleGrid
): ParticleSimulation {
  const { width, height, positions } = grid;
  const gpuCompute = new GPUComputationRenderer(width, height, renderer);

  const dtPosition = gpuCompute.createTexture();
  (dtPosition.image.data as Float32Array).set(positions);

  const dtVelocity = gpuCompute.createTexture();

  const targetTexture = gpuCompute.createTexture();
  (targetTexture.image.data as Float32Array).set(positions);

  const positionVariable = gpuCompute.addVariable("texturePosition", POSITION_SHADER, dtPosition);
  const velocityVariable = gpuCompute.addVariable("textureVelocity", VELOCITY_SHADER, dtVelocity);

  gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
  gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

  positionVariable.material.uniforms.uDelta = { value: 0 };
  velocityVariable.material.uniforms.uDelta = { value: 0 };
  velocityVariable.material.uniforms.uTime = { value: 0 };
  velocityVariable.material.uniforms.uTargetTexture = { value: targetTexture };

  const error = gpuCompute.init();
  if (error) {
    console.error(error);
  }

  return { gpuCompute, positionVariable, velocityVariable, targetTexture };
}
