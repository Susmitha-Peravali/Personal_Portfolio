import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

export const ParticleMaterialImpl = shaderMaterial(
  {
    uAccent: new THREE.Vector3(0.941, 0.627, 0.0),
    uWarm: new THREE.Vector3(0.945, 0.929, 0.886),
    uTime: 0,
    uPixelRatio: 1,
  },
  // vertex shader
  `
    attribute float aSeed;
    attribute float aSize;
    attribute float aOrbit;
    attribute float aMix;
    varying float vMix;
    varying float vSeed;
    uniform float uTime;
    uniform float uPixelRatio;

    void main() {
      vMix = aMix;
      vSeed = aSeed;

      vec3 pos = position;
      // Small per-particle orbit/drift so the edge dust feels alive rather than static.
      pos.x += sin(uTime * 0.5 + aSeed * 6.28) * aOrbit;
      pos.y += cos(uTime * 0.4 + aSeed * 9.42) * aOrbit;
      pos.z += sin(uTime * 0.7 + aSeed * 3.14) * aOrbit * 0.6;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Gentle per-particle twinkle in size.
      float twinkle = 0.75 + 0.25 * sin(uTime * 1.6 + aSeed * 12.0);
      gl_PointSize = aSize * uPixelRatio * twinkle;
    }
  `,
  // fragment shader
  `
    varying float vMix;
    varying float vSeed;
    uniform vec3 uAccent;
    uniform vec3 uWarm;

    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      float alpha = smoothstep(0.5, 0.0, d);
      alpha *= alpha;
      // Dozens of these additively overlap in dense edge zones — cap per-particle contribution
      // well below 1 so overlap reads as scattered dust, not a flat-clipped wash of white.
      alpha *= 0.32;

      vec3 color = mix(uAccent, uWarm, vMix);
      gl_FragColor = vec4(color, alpha);
    }
  `
);

export type ParticleMaterialInstance = InstanceType<typeof ParticleMaterialImpl> & {
  uAccent: THREE.Vector3;
  uWarm: THREE.Vector3;
  uTime: number;
  uPixelRatio: number;
};
