"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { RingMaterialImpl, type RingMaterialInstance } from "./RingMaterial";

type RGB = [number, number, number];

function Ring({
  accent,
  radius,
  width,
  tiltX,
  tiltZ,
  speed,
  pulses,
  opacity,
  driftSpeed,
}: {
  accent: RGB;
  radius: number;
  width: number;
  tiltX: number;
  tiltZ: number;
  speed: number;
  pulses: number;
  opacity: number;
  driftSpeed: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<THREE.Group>(null);

  const material = useMemo(() => {
    const m = new RingMaterialImpl() as unknown as RingMaterialInstance;
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.side = THREE.DoubleSide;
    m.uColor.set(...accent);
    m.uSpeed = speed;
    m.uPulses = pulses;
    m.uOpacity = opacity;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geometry = useMemo(() => new THREE.RingGeometry(radius - width, radius, 96), [radius, width]);

  useFrame((_, delta) => {
    if (!reducedMotion) {
      material.uTime += delta;
      if (groupRef.current) groupRef.current.rotation.z += delta * driftSpeed;
    }
  });

  return (
    <group ref={groupRef} rotation={[tiltX, 0, tiltZ]}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

export function OrbitRings({ accent }: { accent: RGB }) {
  return (
    <>
      <Ring
        accent={accent}
        radius={0.78}
        width={0.016}
        tiltX={1.32}
        tiltZ={0.15}
        speed={0.9}
        pulses={3}
        opacity={0.45}
        driftSpeed={0.05}
      />
      <Ring
        accent={accent}
        radius={0.86}
        width={0.011}
        tiltX={1.15}
        tiltZ={-0.35}
        speed={-0.6}
        pulses={5}
        opacity={0.3}
        driftSpeed={-0.035}
      />
    </>
  );
}
