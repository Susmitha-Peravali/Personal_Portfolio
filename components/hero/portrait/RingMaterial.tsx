import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

// A flat annulus with angular brightness pulses animated over time, standing in for a rotating
// energy ring without needing real mesh rotation to read as "in motion" under an orthographic
// camera (spinning a plain-colored ring around its own normal axis would otherwise be invisible).
export const RingMaterialImpl = shaderMaterial(
  {
    uColor: new THREE.Vector3(0.941, 0.627, 0.0),
    uTime: 0,
    uSpeed: 1,
    uPulses: 3,
    uOpacity: 0.35,
  },
  // vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // fragment shader
  `
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uPulses;
    uniform float uOpacity;

    void main() {
      // RingGeometry UV: angle wraps around U, radius maps to V.
      float angle = vUv.x * 6.28318;
      float pulse = 0.5 + 0.5 * sin(angle * uPulses - uTime * uSpeed);
      float edgeFade = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));

      float alpha = (0.25 + 0.75 * pulse) * edgeFade * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `
);

export type RingMaterialInstance = InstanceType<typeof RingMaterialImpl> & {
  uColor: THREE.Vector3;
  uTime: number;
  uSpeed: number;
  uPulses: number;
  uOpacity: number;
};
