"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/components/motion/useReducedMotion";
import { profile } from "@/lib/data/profile";

const LINES = [
  "booting kernel...",
  "[ OK ] mounting filesystem",
  "[ OK ] starting network services",
  `[ OK ] loading profile: ${profile.name}`,
  `[ OK ] role: ${profile.role}`,
  "> system online_",
];

const STORAGE_KEY = "intro-played";
const STAGGER_MS = 380;

export function IntroSequence({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "playing" | "done">("checking");
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const played = sessionStorage.getItem(STORAGE_KEY);
    if (played || reducedMotion) {
      setPhase("done");
      return;
    }
    setPhase("playing");
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== "playing") return;
    const totalTypingMs = LINES.join("").length * 45 + LINES.length * STAGGER_MS + 700;
    const timer = setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setPhase("done");
    }, totalTypingMs);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "checking") {
    return <div className="fixed inset-0 bg-bg-primary" aria-hidden="true" />;
  }

  return (
    <>
      <AnimatePresence>
        {phase === "playing" && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-[100] bg-bg-primary flex flex-col items-center justify-center px-6"
            exit={{ opacity: 0, transition: { duration: 0.7, ease: "easeInOut" } }}
            role="status"
            aria-live="polite"
          >
            <BootSpinner />
            <div className="max-w-md w-full font-mono text-xs sm:text-sm leading-relaxed text-ink-secondary">
              {LINES.map((line, i) => (
                <TypedLine key={i} text={line} delayMs={i * STAGGER_MS} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {phase === "done" && children}
    </>
  );
}

function BootSpinner() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      className="mb-8 animate-spin-slow"
      aria-hidden="true"
    >
      <circle
        cx="36"
        cy="36"
        r="30"
        fill="none"
        className="stroke-accent-primary/20"
        strokeWidth="1.5"
      />
      <circle
        cx="36"
        cy="36"
        r="30"
        fill="none"
        className="stroke-accent-primary"
        strokeWidth="1.5"
        strokeDasharray="24 165"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TypedLine({ text, delayMs }: { text: string; delayMs: number }) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delayMs);
    return () => clearTimeout(startTimer);
  }, [delayMs]);

  useEffect(() => {
    if (!started) return;
    if (visibleChars >= text.length) return;
    const t = setTimeout(() => setVisibleChars((c) => c + 1), 45);
    return () => clearTimeout(t);
  }, [started, visibleChars, text.length]);

  if (!started) return <p className="h-[1.6em]" />;

  const visible = text.slice(0, visibleChars);
  const prefixMatch = visible.match(/^(\[ OK \]|>)/);
  const prefix = prefixMatch?.[0];
  const rest = prefix ? visible.slice(prefix.length) : visible;

  return (
    <p className="min-h-[1.6em]">
      {prefix && <span className="text-accent-primary">{prefix}</span>}
      {rest}
      {visibleChars < text.length && (
        <span className="inline-block w-[2px] h-[0.9em] bg-accent-primary ml-0.5 animate-blink align-middle" />
      )}
    </p>
  );
}
