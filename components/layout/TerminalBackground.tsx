"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mix: number; // 0 = accent color, 1 = ink color
};

type RGB = [number, number, number];

function readThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  const parse = (name: string): RGB => {
    const parts = styles.getPropertyValue(name).trim().split(/\s+/).map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  return { accent: parse("--color-accent-primary"), ink: parse("--color-ink-primary") };
}

const MAX_DIST = 200;
const MOUSE_RADIUS = 220;

export function TerminalBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const colorsRef = useRef<{ accent: RGB; ink: RGB }>({
    accent: [240, 160, 0],
    ink: [241, 237, 226],
  });
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    colorsRef.current = readThemeColors();
    function onThemeChange() {
      colorsRef.current = readThemeColors();
    }
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let animationId: number;

    function makeNodes() {
      const count = Math.min(70, Math.floor((width * height) / 20000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.5 + 1.2,
        mix: Math.random(),
      }));
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeNodes();
    }

    function colorAt(mix: number, alpha: number) {
      const { accent, ink } = colorsRef.current;
      const r = accent[0] + (ink[0] - accent[0]) * mix;
      const g = accent[1] + (ink[1] - accent[1]) * mix;
      const b = accent[2] + (ink[2] - accent[2]) * mix;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      if (!reducedMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
          n.x = Math.min(Math.max(n.x, 0), width);
          n.y = Math.min(Math.max(n.y, 0), height);

          const dx = mx - n.x;
          const dy = my - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS && dist > 1) {
            const pull = (1 - dist / MOUSE_RADIUS) * 0.6;
            n.x += (dx / dist) * pull;
            n.y += (dy / dist) * pull;
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > MAX_DIST) continue;

          const nearMouse =
            Math.hypot(mx - a.x, my - a.y) < MOUSE_RADIUS ||
            Math.hypot(mx - b.x, my - b.y) < MOUSE_RADIUS;

          const baseAlpha = (1 - dist / MAX_DIST) * (nearMouse ? 0.9 : 0.4);
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.strokeStyle = colorAt((a.mix + b.mix) / 2, baseAlpha);
          ctx!.lineWidth = nearMouse ? 1.3 : 0.8;
          ctx!.stroke();
        }
      }

      for (const n of nodes) {
        const nodeColor = colorAt(n.mix, 0.9);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = nodeColor;
        ctx!.shadowColor = nodeColor;
        ctx!.shadowBlur = 6;
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(draw);
    }

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    }
    function handleMouseLeave() {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    }

    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseleave", handleMouseLeave);
    }
    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, [reducedMotion]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-bg-primary" />

      {/* ambient amber glow washes */}
      <div className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-accent-primary/[0.07] blur-[140px] animate-drift-a" />
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] rounded-full bg-accent-primary/[0.05] blur-[140px] animate-drift-b" />

      <canvas ref={canvasRef} className="absolute inset-0 opacity-90" />

      {/* vignette to keep content readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgb(var(--color-bg-primary) / 0) 40%, rgb(var(--color-bg-primary) / 0.6) 100%)",
        }}
      />
    </div>
  );
}
