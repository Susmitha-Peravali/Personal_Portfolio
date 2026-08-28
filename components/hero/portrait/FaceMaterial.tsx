import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

// Compact 2D simplex noise (Ashima Arts / Ian McEwan, MIT) — used to give the edge-dissolve
// boundary an organic, drifting shape instead of a static radial cutoff.
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

export const FaceMaterialImpl = shaderMaterial(
  {
    uTexture: null as THREE.Texture | null,
    uBgColor: new THREE.Vector3(0.95, 0.94, 0.92),
    uAccent: new THREE.Vector3(0.941, 0.627, 0.0),
    uWarm: new THREE.Vector3(0.945, 0.929, 0.886),
    uTime: 0,
    uBgThreshold: 0.16,
  },
  // vertex shader
  `
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Gentle paraboloid bulge so a flat plane still has normal variation for the rim-glow term,
      // plus a subtle luminance-driven relief so brighter features (cheekbones, nose bridge) sit
      // fractionally forward — a believable dimensional feel without real facial geometry.
      vec2 centered = uv - 0.5;
      float r = length(centered);
      float bulge = max(0.0, 1.0 - r * 1.7);
      float lum = dot(texture2D(uTexture, uv).rgb, vec3(0.299, 0.587, 0.114));
      float breathe = sin(uTime * 0.6) * 0.006;
      pos.z += bulge * 0.14 + lum * 0.05 + breathe * bulge;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // fragment shader
  `
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec3 uBgColor;
    uniform vec3 uAccent;
    uniform vec3 uWarm;
    uniform float uTime;
    uniform float uBgThreshold;
    ${NOISE_GLSL}

    void main() {
      vec4 tex = texture2D(uTexture, vUv);
      float bgDist = distance(tex.rgb, uBgColor);
      float subjectMask = smoothstep(uBgThreshold * 0.6, uBgThreshold, bgDist);

      float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
      // Push midtones toward the accent color and reserve the bright uWarm endpoint for genuine
      // highlights — a plain linear mix reaches near-uWarm too easily (uWarm is a near-white
      // token in dark theme), flattening large mid-luminance areas like the blazer into a washed,
      // low-contrast fill instead of a shaded duotone.
      float t = pow(lum, 1.6);
      vec3 color = mix(uAccent, uWarm, t);

      // Organic edge dissolve: radial falloff perturbed by drifting simplex noise, so the
      // boundary looks like it's resolving into energy rather than a static vignette cutoff.
      vec2 centered = vUv - vec2(0.5, 0.42);
      centered.y *= 1.15;
      float r = length(centered);
      float n = snoise(vUv * 5.0 + uTime * 0.05) * 0.09;
      float dissolve = 1.0 - smoothstep(0.36 + n, 0.62 + n, r);

      // Rim brightening toward the dissolve boundary — a cheap stand-in for view-angle Fresnel
      // on a geometry that's nearly flat; reads as an "energy edge" glow.
      float rim = smoothstep(0.30, 0.60, r) * (1.0 - smoothstep(0.55, 0.66, r));
      color += uAccent * rim * 0.55;

      // Faint drifting scanlines — a subtle projected-signal cue, kept light enough not to
      // fight the duotone shading underneath.
      float scan = sin(vUv.y * 240.0 - uTime * 1.4);
      color -= vec3(max(0.0, scan) * 0.035);

      float alpha = subjectMask * dissolve * tex.a;
      gl_FragColor = vec4(color, alpha);
    }
  `
);

export type FaceMaterialInstance = InstanceType<typeof FaceMaterialImpl> & {
  uTexture: THREE.Texture | null;
  uBgColor: THREE.Vector3;
  uAccent: THREE.Vector3;
  uWarm: THREE.Vector3;
  uTime: number;
  uBgThreshold: number;
};
