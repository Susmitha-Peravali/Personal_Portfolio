"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Code2, Layout, Server, Database, BrainCircuit, Wrench, type LucideIcon } from "lucide-react";
import type { SkillCategory } from "@/lib/data/profile";
import { cn } from "@/lib/utils";
import { TechIcon } from "./techIcons";
import { SkillDetailPanel } from "./SkillDetailPanel";

const COLS = 3;
const COL_X = [16.67, 50, 83.33]; // % of stage
const ROW_Y = [30, 74]; // % of stage
const CARD_WIDTH = 27; // % of stage, fixed — never changes on hover, avoids collision

// One glance-able icon per category so the grid reads as a labeled system rather than a plain
// text list — matches the category ids in lib/data/profile.ts.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  languages: Code2,
  frontend: Layout,
  backend: Server,
  databases: Database,
  "ai-ml": BrainCircuit,
  "tools-devops": Wrench,
};

// How many tech icons show in the at-rest preview strip before collapsing into "+N" — keeps every
// card's resting height consistent regardless of how many items a category actually has.
const PREVIEW_COUNT = 4;

function useCanHover() {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover)").matches);
  }, []);
  return canHover;
}

function cardPosition(i: number) {
  return { x: COL_X[i % COLS], y: ROW_Y[Math.floor(i / COLS)] };
}

export function SkillsEcosystem({ categories }: { categories: SkillCategory[] }) {
  const [openCategory, setOpenCategory] = useState<SkillCategory | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const canHover = useCanHover();

  // Connect adjacent cards: within each row, and between the two rows in the same column.
  const connections: [number, number][] = [];
  for (let row = 0; row < Math.ceil(categories.length / COLS); row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const a = row * COLS + col;
      const b = row * COLS + col + 1;
      if (a < categories.length && b < categories.length) connections.push([a, b]);
    }
  }
  for (let col = 0; col < COLS; col++) {
    const a = col;
    const b = col + COLS;
    if (a < categories.length && b < categories.length) connections.push([a, b]);
  }

  return (
    <div>
      <div className="relative mx-auto w-full min-h-[460px] sm:min-h-[500px] md:min-h-[540px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
          {connections.map(([a, b]) => {
            const pa = cardPosition(a);
            const pb = cardPosition(b);
            const isNear = hoveredId === categories[a].id || hoveredId === categories[b].id;
            return (
              <line
                key={`${categories[a].id}-${categories[b].id}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                className={cn(
                  "transition-all duration-300",
                  // Slightly more visible at rest than before — the "ecosystem" the heading
                  // promises should read as a connected network on first glance, not only on hover.
                  isNear ? "stroke-accent-primary/45" : "stroke-accent-primary/18"
                )}
                strokeWidth={isNear ? 0.35 : 0.22}
              />
            );
          })}
        </svg>

        {categories.map((category, i) => {
          const p = cardPosition(i);
          const isHovered = canHover && hoveredId === category.id;
          const Icon = CATEGORY_ICONS[category.id] ?? Code2;
          const previewItems = category.items.slice(0, PREVIEW_COUNT);
          const remaining = category.items.length - previewItems.length;

          return (
            <motion.div
              key={category.id}
              style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${CARD_WIDTH}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 glass rounded-2xl cursor-pointer transition-shadow duration-300 hover:scale-[1.02]",
                isHovered && "z-20 shadow-[0_0_32px_-6px_rgb(var(--color-accent-primary)/0.5)] border-accent-primary/50"
              )}
              onMouseEnter={() => canHover && setHoveredId(category.id)}
              onMouseLeave={() => canHover && setHoveredId(null)}
              onClick={() => setOpenCategory(category)}
              role="button"
              tabIndex={0}
              aria-label={`${category.label} skill category, ${category.items.length} skills`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenCategory(category);
                }
              }}
              onFocus={() => canHover && setHoveredId(category.id)}
              onBlur={() => canHover && setHoveredId(null)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-primary/10 text-accent-primary shrink-0">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <p className="font-mono text-xs sm:text-sm text-ink-primary font-medium truncate">
                      {category.label}
                    </p>
                  </div>
                  <span className="font-mono text-[0.65rem] text-ink-muted shrink-0">
                    {category.items.length}
                  </span>
                </div>

                {isHovered ? (
                  <motion.ul
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                    className="mt-3 space-y-1.5"
                  >
                    {category.items.map((item) => (
                      <motion.li
                        key={item}
                        variants={{
                          hidden: { opacity: 0, x: -6 },
                          visible: { opacity: 1, x: 0 },
                        }}
                        className="flex items-center gap-1.5 text-[0.7rem] text-ink-secondary"
                      >
                        <TechIcon tech={item} className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                        <span className="truncate">{item}</span>
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  // At-rest preview — a row of the category's own tech icons, so the card already
                  // reads as populated content instead of a blank label waiting for interaction.
                  <div className="mt-3 flex items-center gap-1.5">
                    {previewItems.map((item) => (
                      <span
                        key={item}
                        title={item}
                        className="flex items-center justify-center w-6 h-6 rounded-md bg-bg-primary/40 text-ink-secondary"
                      >
                        <TechIcon tech={item} className="w-3.5 h-3.5" />
                      </span>
                    ))}
                    {remaining > 0 && (
                      <span className="font-mono text-[0.65rem] text-ink-muted ml-0.5">+{remaining}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-ink-muted mt-6 font-mono">
        hover a category to preview &middot; click to explore
      </p>

      <SkillDetailPanel category={openCategory} onClose={() => setOpenCategory(null)} />
    </div>
  );
}
