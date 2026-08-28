"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { ParticleMaterialImpl, type ParticleMaterialInstance } from "./ParticleMaterial";
import { buildEdgeParticleData } from "./edgeSampling";

const PARTICLE_COUNT = 900;

export function EdgeParticles({
  texture,
  bgColor,
  accent,
  warm,
}: {
  texture: THREE.Texture;
  bgColor: [number, number, number];
  accent: [number, number, number];
  warm: [number, number, number];
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { gl } = useThree();

  const material = useMemo(() => {
    const m = new ParticleMaterialImpl() as unknown as ParticleMaterialInstance;
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.uAccent.set(...accent);
    m.uWarm.set(...warm);
    m.uPixelRatio = Math.min(gl.getPixelRatio(), 2);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    material.uAccent.set(...accent);
    material.uWarm.set(...warm);
  }, [material, accent, warm]);

  const geometry = useMemo(() => {
    const image = texture.image as HTMLImageElement;
    const data = buildEdgeParticleData(image, bgColor, PARTICLE_COUNT);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(data.seeds, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(data.sizes, 1));
    geo.setAttribute("aOrbit", new THREE.BufferAttribute(data.orbits, 1));
    geo.setAttribute("aMix", new THREE.BufferAttribute(data.mixes, 1));
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (!reducedMotion) {
      material.uTime += delta;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
