"use client";

import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { fadeUp, flipIn, slideIn } from "./variants";
import { usePrefersReducedMotion } from "./useReducedMotion";

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

export function RevealOnScroll({
  children,
  index = 0,
  className,
  variant = "fade",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  variant?: "fade" | "slide-left" | "slide-right" | "flip";
}) {
  const reducedMotion = usePrefersReducedMotion();

  const variants = reducedMotion
    ? reducedVariants
    : variant === "slide-left"
      ? slideIn("left")
      : variant === "slide-right"
        ? slideIn("right")
        : variant === "flip"
          ? flipIn
          : fadeUp;

  return (
    <motion.div
      className={className}
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      style={variant === "flip" && !reducedMotion ? { transformPerspective: 1000 } : undefined}
    >
      {children}
    </motion.div>
  );
}
