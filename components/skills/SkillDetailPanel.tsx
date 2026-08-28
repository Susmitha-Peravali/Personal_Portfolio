"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X } from "lucide-react";
import type { SkillCategory } from "@/lib/data/profile";
import { getTechUsage } from "@/lib/skillUsage";
import { TechIcon } from "./techIcons";

export function SkillDetailPanel({
  category,
  onClose,
}: {
  category: SkillCategory | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!category) return;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [category, onClose]);

  return (
    <AnimatePresence>
      {category && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${category.label} technologies`}
            className="glass relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6 sm:p-8"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 text-ink-secondary hover:text-ink-primary transition-colors"
            >
              <X size={20} />
            </button>

            <span className="eyebrow block mb-2">Skill Category</span>
            <h3 className="font-display text-2xl text-ink-primary mb-6">{category.label}</h3>

            <ul className="space-y-4">
              {category.items.map((item) => {
                const usage = getTechUsage(item);
                return (
                  <li key={item} className="flex items-start gap-3 pb-4 border-b border-line last:border-0 last:pb-0">
                    <TechIcon tech={item} className="w-6 h-6 text-accent-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-ink-primary font-medium">{item}</p>
                      <p className="text-sm text-ink-secondary mt-0.5">
                        {usage.projects.length > 0 ? (
                          <>
                            Used in{" "}
                            {usage.projects.map((p, i) => (
                              <span key={p.name}>
                                {i > 0 && ", "}
                                {p.slug ? (
                                  <Link
                                    href={`/projects/${p.slug}`}
                                    className="text-accent-primary hover:underline"
                                  >
                                    {p.name}
                                  </Link>
                                ) : (
                                  p.name
                                )}
                              </span>
                            ))}
                          </>
                        ) : usage.experienceCompanies.length > 0 ? (
                          <>Applied during my {usage.experienceCompanies.join(" and ")} internship</>
                        ) : (
                          "Core part of my toolkit"
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
