import { experience } from "@/lib/data/profile";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { TimelineItem } from "./TimelineItem";
import { WireframeShape } from "@/components/decor/WireframeShape";

export function ExperienceTimeline() {
  return (
    <section id="experience" className="py-28 md:py-36 relative">
      <WireframeShape
        shape="tetrahedron"
        size={140}
        className="hidden lg:block absolute bottom-10 left-4 opacity-25"
      />

      <div className="container-page grid md:grid-cols-[0.7fr_1.3fr] gap-14">
        <RevealOnScroll>
          <SectionEyebrow>Experience</SectionEyebrow>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight">
            Time spent shipping in production teams.
          </h2>
        </RevealOnScroll>

        <div>
          {experience.map((item, i) => (
            <TimelineItem key={item.id} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
