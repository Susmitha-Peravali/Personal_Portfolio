"use client";

import { motion } from "framer-motion";
import { ArrowRight, Download, Github, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { profile } from "@/lib/data/profile";
import { fadeUp } from "@/components/motion/variants";
import { HolographicPortrait } from "./HolographicPortrait";

export function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-[100svh] flex items-center pt-32 pb-24 overflow-hidden"
    >
      <div className="container-page relative flex flex-col lg:flex-row items-center gap-14 lg:gap-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="max-w-3xl lg:flex-1"
        >
          <span className="eyebrow mb-6 block">{profile.role}</span>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-gradient font-semibold">
            {profile.name}
          </h1>

          <p className="mt-6 font-display text-2xl sm:text-3xl text-ink-primary/90 leading-snug max-w-2xl">
            {profile.heroHeadline}
          </p>

          <p className="mt-6 text-ink-secondary text-lg max-w-xl leading-relaxed">
            {profile.heroSub}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button href="#projects" icon={ArrowRight}>
              Explore Projects
            </Button>
            <Button href={profile.resumeUrl} variant="ghost" icon={Download} external>
              Download Resume
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-5">
            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-secondary hover:text-accent-primary transition-colors"
              aria-label="GitHub profile"
            >
              <Github size={20} />
            </a>
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-secondary hover:text-accent-primary transition-colors"
              aria-label="LinkedIn profile"
            >
              <Linkedin size={20} />
            </a>
          </div>
        </motion.div>

        <HolographicPortrait className="w-full max-w-[320px] sm:max-w-[420px] lg:max-w-[520px] lg:w-[44%] shrink-0" />
      </div>
    </section>
  );
}
