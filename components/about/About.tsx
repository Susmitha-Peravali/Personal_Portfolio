import { profile } from "@/lib/data/profile";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { WireframeShape } from "@/components/decor/WireframeShape";

export function About() {
  return (
    <section id="about" className="container-page py-28 md:py-36 relative">
      <WireframeShape
        shape="cube"
        size={130}
        className="hidden lg:block absolute top-6 right-4 md:right-10 opacity-25"
      />

      <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-14 md:gap-20">
        <RevealOnScroll variant="slide-left">
          <SectionEyebrow>About</SectionEyebrow>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight text-ink-primary">
            I build the whole system,
            <br className="hidden sm:block" /> not just the feature.
          </h2>
        </RevealOnScroll>

        <RevealOnScroll index={1} variant="slide-right">
          <GlassPanel className="p-8">
            <div className="space-y-5">
              {profile.aboutParagraphs.map((p, i) => (
                <p key={i} className="text-ink-secondary leading-relaxed">
                  {p}
                </p>
              ))}
            </div>

            <ul className="flex flex-wrap gap-2 mt-7 pt-6 border-t border-line">
              {profile.interests.map((interest) => (
                <li
                  key={interest}
                  className="text-sm font-medium text-ink-secondary bg-white/[0.04] border border-line rounded-full px-4 py-2 hover:text-ink-primary transition-colors"
                >
                  {interest}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </RevealOnScroll>
      </div>
    </section>
  );
}
