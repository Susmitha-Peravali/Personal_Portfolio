"use client";

import { createElement, useRef, type JSX } from "react";
import { gsap } from "gsap";
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";

gsap.registerPlugin(ScrambleTextPlugin);

export function DecryptText({
  text,
  as = "span",
  className,
}: {
  text: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  function handleEnter() {
    if (reducedMotion || !ref.current) return;
    gsap.to(ref.current, {
      duration: 0.6,
      scrambleText: {
        text,
        chars: "upperCase",
        speed: 0.4,
        revealDelay: 0.1,
      },
      ease: "none",
    });
  }

  return createElement(
    as,
    {
      ref: (node: HTMLElement | null) => {
        ref.current = node;
      },
      className,
      onMouseEnter: handleEnter,
    },
    text
  );
}
