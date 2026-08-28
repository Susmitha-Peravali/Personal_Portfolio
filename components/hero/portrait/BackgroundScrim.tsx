"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

type RGB = [number, number, number];

// A soft radial fade, rendered behind the particle body, tinted to match the page's own
// background color. Its job is purely a depth cue: without it, the background network's lines
// cross directly through gaps between particles at full strength, reading as if the network sits
// on the same plane as the portrait rather than behind it. Dimming toward the true page
// background color right behind the portrait makes it recede instead.
const ScrimMaterialImpl = shaderMaterial(
  { uColor: new THREE.Vector3(0.04, 0.035, 0.03), uOpacity: 0.2 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c) / 0.5;
      float alpha = (1.0 - smoothstep(0.1, 0.85, r)) * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `
);

function readBgPrimary(): RGB {
  const styles = getComputedStyle(document.documentElement);
  const parts = styles.getPropertyValue("--color-bg-primary").trim().split(/\s+/).map(Number);
  return [(parts[0] ?? 10) / 255, (parts[1] ?? 10) / 255, (parts[2] ?? 10) / 255];
}

export function BackgroundScrim() {
  const [color, setColor] = useState<RGB>([0.04, 0.035, 0.03]);

  useEffect(() => {
    setColor(readBgPrimary());
    function onThemeChange() {
      setColor(readBgPrimary());
    }
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  const material = useMemo(() => {
    const m = new ScrimMaterialImpl();
    m.transparent = true;
    m.depthWrite = false;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (material as unknown as { uColor: THREE.Vector3 }).uColor.set(...color);
  }, [material, color]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  return <mesh geometry={geometry} material={material} position={[0, 0, -0.5]} />;
}
