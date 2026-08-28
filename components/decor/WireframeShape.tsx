"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";

type Vec3 = [number, number, number];

const SHAPES: Record<"cube" | "octahedron" | "tetrahedron", { vertices: Vec3[]; edges: [number, number][] }> = {
  cube: {
    vertices: [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
  },
  octahedron: {
    vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    edges: [
      [0, 4], [4, 1], [1, 5], [5, 0],
      [2, 0], [2, 4], [2, 1], [2, 5],
      [3, 0], [3, 4], [3, 1], [3, 5],
    ],
  },
  tetrahedron: {
    vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
  },
};

const FOCAL = 3;

export function WireframeShape({
  shape,
  size = 160,
  className,
}: {
  shape: "cube" | "octahedron" | "tetrahedron";
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const colorRef = useRef<[number, number, number]>([240, 160, 0]);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    function readColor() {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent-primary")
        .trim()
        .split(/\s+/)
        .map(Number);
      colorRef.current = [raw[0] ?? 240, raw[1] ?? 160, raw[2] ?? 0];
    }
    readColor();
    window.addEventListener("themechange", readColor);
    return () => window.removeEventListener("themechange", readColor);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { vertices, edges } = SHAPES[shape];
    let angleX = 0.4;
    let angleY = 0.6;
    let offsetX = 0;
    let offsetY = 0;
    let animationId: number;

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    }

    function project(v: Vec3): { x: number; y: number; scale: number } {
      const cosY = Math.cos(angleY + offsetY);
      const sinY = Math.sin(angleY + offsetY);
      const cosX = Math.cos(angleX + offsetX);
      const sinX = Math.sin(angleX + offsetX);

      const x1 = v[0] * cosY + v[2] * sinY;
      const z1 = -v[0] * sinY + v[2] * cosY;
      const y1 = v[1];

      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      const scale = FOCAL / (FOCAL + z2);
      const radius = size * 0.32;
      return { x: size / 2 + x1 * scale * radius, y: size / 2 + y2 * scale * radius, scale };
    }

    function draw() {
      ctx!.clearRect(0, 0, size, size);

      if (!reducedMotion) {
        angleX += 0.0035;
        angleY += 0.005;

        const rect = canvas!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouseRef.current.x - cx;
        const dy = mouseRef.current.y - cy;
        const dist = Math.hypot(dx, dy);
        const proximity = 400;
        const targetOffsetX = dist < proximity ? (dy / proximity) * 0.6 : 0;
        const targetOffsetY = dist < proximity ? (dx / proximity) * 0.6 : 0;
        offsetX += (targetOffsetX - offsetX) * 0.05;
        offsetY += (targetOffsetY - offsetY) * 0.05;
      }

      const projected = vertices.map(project);
      const [r, g, b] = colorRef.current;

      for (const [a, bIdx] of edges) {
        const pa = projected[a];
        const pb = projected[bIdx];
        const depth = (pa.scale + pb.scale) / 2;
        const alpha = Math.min(0.9, Math.max(0.15, (depth - 0.6) * 1.4));
        ctx!.beginPath();
        ctx!.moveTo(pa.x, pa.y);
        ctx!.lineTo(pb.x, pb.y);
        ctx!.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx!.lineWidth = Math.max(0.6, depth * 1.3);
        ctx!.stroke();
      }

      for (const p of projected) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, Math.max(1, p.scale * 2), 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.9, p.scale)})`;
        ctx!.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    if (!reducedMotion) window.addEventListener("mousemove", handleMouseMove);
    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [shape, size, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    />
  );
}
