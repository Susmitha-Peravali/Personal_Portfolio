import { profile, coreCS } from "@/lib/data/profile";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function EducationStrip() {
  const { education } = profile;
  return (
    <section aria-label="Education" className="py-20 border-t border-line">
      <div className="container-page">
        <RevealOnScroll variant="slide-left">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="font-display text-xl text-ink-primary">{education.school}</p>
              <p className="text-ink-secondary text-sm mt-1">
                {education.degree} &middot; {education.minor}
              </p>
            </div>
            <div className="flex gap-8 font-mono text-sm text-ink-secondary">
              <div>
                <span className="block text-ink-muted text-xs uppercase tracking-wide">CGPA</span>
                {education.cgpa}
              </div>
              <div>
                <span className="block text-ink-muted text-xs uppercase tracking-wide">
                  Graduation
                </span>
                {education.graduation}
              </div>
            </div>
          </div>

          <p className="text-ink-muted text-xs mt-6 pt-6 border-t border-line font-mono">
            <span className="text-ink-secondary uppercase tracking-wide">Coursework</span>{" "}
            &middot; {coreCS.join(" · ")}
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
