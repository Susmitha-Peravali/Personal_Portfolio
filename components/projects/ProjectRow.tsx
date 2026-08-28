"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/data/projects";
import { Badge } from "@/components/ui/Badge";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";

export function ProjectRow({ project, index }: { project: Project; index: number }) {
  const reversed = index % 2 === 1;
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.04, 1, 1.04]);

  return (
    <div
      ref={ref}
      className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center py-16 md:py-24 border-t border-line first:border-t-0 ${
        reversed ? "md:[&>*:first-child]:order-2" : ""
      }`}
    >
      <Link
        href={`/projects/${project.slug}`}
        className="glass group relative block rounded-2xl overflow-hidden"
      >
        <motion.div style={reducedMotion ? undefined : { scale }} className="relative aspect-[8/5]">
          <Image
            src={project.cover}
            alt={`${project.name} cover artwork`}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>

      <div>
        <span className="eyebrow">{project.category}</span>
        <h3 className="font-display text-2xl sm:text-3xl mt-3 mb-4 text-ink-primary">
          {project.name}
        </h3>
        <p className="text-ink-secondary leading-relaxed mb-6 max-w-md font-sans">{project.summary}</p>
        <div className="flex flex-wrap gap-2 mb-7">
          {project.stack.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
        <Link
          href={`/projects/${project.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-primary hover:text-accent-primary transition-colors"
        >
          View case study
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
}
