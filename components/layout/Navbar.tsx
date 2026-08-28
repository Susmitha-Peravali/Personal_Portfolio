"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "achievements", label: "Achievements" },
  { id: "contact", label: "Contact" },
];

export function Navbar() {
  const [active, setActive] = useState("home");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300 glass rounded-none",
        scrolled ? "shadow-[0_16px_40px_rgba(0,0,0,0.25)]" : "shadow-none"
      )}
      style={{ borderLeft: 0, borderRight: 0, borderTop: 0 }}
      aria-label="Primary"
    >
      <div className="container-page flex items-center justify-between h-16 md:h-20 gap-4">
        <a
          href="#home"
          className="eyebrow shrink-0 hover:text-ink-primary transition-colors"
          aria-label="Home"
        >
          ~/naga
        </a>

        <ul className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? "true" : undefined}
                className={cn(
                  "relative block px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap",
                  active === section.id
                    ? "text-ink-primary"
                    : "text-ink-secondary hover:text-ink-primary"
                )}
              >
                {active === section.id && (
                  <span
                    className="absolute inset-0 rounded-full bg-ink-primary/[0.08] border border-accent-primary/30"
                    aria-hidden="true"
                  />
                )}
                <span className="relative">{section.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="shrink-0 pl-2 ml-1 border-l border-line">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
