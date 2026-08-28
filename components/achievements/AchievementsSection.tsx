import { achievements } from "@/lib/data/profile";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Trophy } from "lucide-react";
import { WireframeShape } from "@/components/decor/WireframeShape";

export function AchievementsSection() {
  return (
    <section id="achievements" className="py-28 md:py-36 relative">
      <WireframeShape
        shape="octahedron"
        size={130}
        className="hidden lg:block absolute top-6 right-4 md:right-10 opacity-25"
      />

      <div className="container-page">
        <RevealOnScroll>
          <SectionEyebrow>Achievements</SectionEyebrow>
          <h2 className="font-display text-3xl sm:text-4xl mb-14 max-w-xl">
            Markers along the way.
          </h2>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {achievements.map((a, i) => (
            <RevealOnScroll key={a.id} index={i % 3} variant="flip">
              <GlassPanel className="glass-hover p-6 flex items-start gap-4 h-full">
                <Trophy size={18} className="text-accent-primary shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="font-display text-lg text-ink-primary">{a.title}</p>
                  <p className="text-sm text-ink-secondary mt-1">{a.detail}</p>
                </div>
              </GlassPanel>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
