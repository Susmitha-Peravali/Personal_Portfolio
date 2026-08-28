import { skillCategories } from "@/lib/data/profile";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { SkillsEcosystem } from "./SkillsEcosystem";

export function SkillsSection() {
  return (
    <section id="skills" className="bg-bg-secondary/40 py-28 md:py-36">
      <div className="container-page">
        <RevealOnScroll>
          <SectionEyebrow>Skills</SectionEyebrow>
          <h2 className="font-display text-3xl sm:text-4xl mb-14 max-w-xl">
            An engineering ecosystem, not a checklist.
          </h2>
        </RevealOnScroll>

        <RevealOnScroll index={1}>
          <SkillsEcosystem categories={skillCategories} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
