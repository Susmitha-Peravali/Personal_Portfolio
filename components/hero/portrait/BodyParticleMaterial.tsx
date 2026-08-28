import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

export const BodyParticleMaterialImpl = shaderMaterial(
  {
    uPositionTexture: null as THREE.Texture | null,
    uVelocityTexture: null as THREE.Texture | null,
    uColorTexture: null as THREE.Texture | null,
    uPixelRatio: 1,
    uSize: 3.0,
    // Debug mode: hard 1px points, binary presence, flat color, no falloff/glow/opacity variation
    // — isolates the raw point placement from every rendering-side variable (size, blending,
    // brightness, opacity) so it can be judged on its own.
    uDebugMode: 0,
    uDebugColor: new THREE.Vector3(0, 0, 0),
    // Particleization experiment: strips hue only, keeps every other rendering variable (soft
    // falloff, per-particle size/brightness, opacity, depth occlusion) exactly as the normal path
    // already computes them — distinct from uDebugMode, which also strips size/falloff/opacity to
    // isolate placement. This isolates "does the particle texture itself read convincingly" from
    // color, independent of whether structure alone (uDebugMode) already does.
    uMonochrome: 0,
    // Color-stage experiment: a theme-aware luminance floor/ceiling, applied only to the color
    // path (monochrome is untouched — that baseline stays locked exactly as approved). Dark theme
    // needs the floor (dark amber like the jacket was reading too close to the near-black
    // backdrop's own luminance); light theme needs the ceiling (bright amber highlights were too
    // close to the light backdrop's luminance). Hue-preserving and monotonic — only pixels outside
    // [floor, ceiling] get rescaled toward it, everything already inside is untouched, so this
    // adds contrast at the extremes without flattening the mid-tone shading that already works.
    uColorFloor: 0,
    uColorCeiling: 1,
    // Facial-completeness experiment: the eye/mouth negative-space regions carry real photo color
    // (iris/sclera, lip volume) at reduced but non-zero presence — that reduced band reads clearly
    // in dark theme but, like the rest of the face before uColorFloor existed, is too faint against
    // a light backdrop. Same fix, same place: a theme-aware floor, applied only to that specific
    // presence band (not full-presence face particles, not fully-absent background), so light
    // theme gets the same lift dark theme already has without touching the color path above.
    uFeatureAlphaFloor: 0,
  },
  // vertex shader
  `
    uniform sampler2D uPositionTexture;
    uniform sampler2D uVelocityTexture;
    uniform sampler2D uColorTexture;
    uniform float uPixelRatio;
    uniform float uSize;
    uniform float uDebugMode;
    attribute vec2 reference;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSettle;

    void main() {
      vec4 simPos = texture2D(uPositionTexture, reference);
      vec4 vel = texture2D(uVelocityTexture, reference);
      vec4 col = texture2D(uColorTexture, reference);
      vColor = col.rgb;
      vAlpha = simPos.w;
      float sizeMult = col.a;

      // Velocity-driven brightness: particles at rest hold a soft baseline glow, particles
      // actively resettling (from the breathing pulse or noise wander) flare brighter — dynamic
      // brightness tied to motion instead of a fixed cap, so the form reads as alive rather than
      // painted on.
      float speed = length(vel.xyz);
      vSettle = clamp(speed * 18.0, 0.82, 1.28);

      vec4 mvPosition = modelViewMatrix * vec4(simPos.xyz, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      float debugSize = 1.5 * uPixelRatio;
      float normalSize = uSize * uPixelRatio * sizeMult;
      gl_PointSize = mix(normalSize, debugSize, uDebugMode);
    }
  `,
  // fragment shader
  `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSettle;
    uniform float uDebugMode;
    uniform vec3 uDebugColor;
    uniform float uMonochrome;
    uniform float uColorFloor;
    uniform float uColorCeiling;
    uniform float uFeatureAlphaFloor;

    void main() {
      if (uDebugMode > 0.5) {
        // Binary presence only — no soft falloff, no opacity variation, no blending-driven
        // brightness. A particle either exists here (drawn, fully opaque, flat color) or it
        // doesn't (discarded).
        if (vAlpha < 0.3) discard;
        gl_FragColor = vec4(uDebugColor, 1.0);
        return;
      }

      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      float circle = smoothstep(0.5, 0.0, d);
      circle *= circle;

      float alpha = circle * vAlpha * vSettle;

      // Theme-aware lift for the eye/mouth suppressed-presence band specifically (vAlpha roughly
      // 0.15-0.4 — full-presence face particles and fully-absent background particles are both
      // well outside this band, so they're untouched). Zero in dark theme / monochrome, where this
      // band already reads correctly.
      if (uFeatureAlphaFloor > 0.0 && vAlpha > 0.05 && vAlpha < 0.5) {
        alpha = max(alpha, uFeatureAlphaFloor * circle * vSettle);
      }

      if (alpha < 0.01) discard;

      // Desaturate only — the same per-particle lightness that already carries real photographic
      // shading (including the local-contrast enhancement), just with hue removed. Every other
      // signal (falloff, alpha, size, depth occlusion via the standard depth test) is identical to
      // the color path.
      vec3 outColor = vColor;
      if (uMonochrome > 0.5) {
        float gray = dot(vColor, vec3(0.299, 0.587, 0.114));
        outColor = vec3(gray);
      } else {
        // Rescale toward [uColorFloor, uColorCeiling] only when outside it — a pixel already
        // inside the range keeps its exact computed color, so this is pure contrast recovery at
        // the extremes, not a global brightness/contrast remap.
        float luma = dot(outColor, vec3(0.299, 0.587, 0.114));
        float target = clamp(luma, uColorFloor, uColorCeiling);
        if (luma > 0.001) {
          outColor *= target / luma;
        }
      }
      gl_FragColor = vec4(outColor, alpha);
    }
  `
);

export type BodyParticleMaterialInstance = InstanceType<typeof BodyParticleMaterialImpl> & {
  uPositionTexture: THREE.Texture | null;
  uVelocityTexture: THREE.Texture | null;
  uColorTexture: THREE.Texture | null;
  uPixelRatio: number;
  uSize: number;
  uDebugMode: number;
  uDebugColor: THREE.Vector3;
  uMonochrome: number;
  uColorFloor: number;
  uColorCeiling: number;
  uFeatureAlphaFloor: number;
};
