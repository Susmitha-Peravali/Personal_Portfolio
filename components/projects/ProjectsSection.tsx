import { featuredProjects, otherProjects } from "@/lib/data/projects";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { ProjectRow } from "./ProjectRow";
import { ProjectCard } from "./ProjectCard";
import { WireframeShape } from "@/components/decor/WireframeShape";

export function ProjectsSection() {
  return (
    <section id="projects" className="py-28 md:py-36 relative">
      <div className="container-page">
        <RevealOnScroll>
          <SectionEyebrow>Selected Work</SectionEyebrow>
          <h2 className="font-display text-3xl sm:text-4xl max-w-xl">
            Products built end to end, from schema to screen.
          </h2>
        </RevealOnScroll>

        <div className="mt-8">
          {featuredProjects.map((project, i) => (
            <ProjectRow key={project.slug} project={project} index={i} />
          ))}
        </div>

        <div className="mt-24 relative">
          <WireframeShape
            shape="cube"
            size={130}
            className="hidden lg:block absolute -top-4 right-4 opacity-25"
          />
          <RevealOnScroll>
            <h3 className="font-display text-xl text-ink-primary mb-8">Other Projects</h3>
          </RevealOnScroll>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {otherProjects.map((project, i) => (
              <RevealOnScroll key={project.name} index={i % 3} variant="flip">
                <ProjectCard project={project} />
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
