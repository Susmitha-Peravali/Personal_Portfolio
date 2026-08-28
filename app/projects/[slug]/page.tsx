import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Github, ExternalLink } from "lucide-react";
import { featuredProjects } from "@/lib/data/projects";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/Badge";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function generateStaticParams() {
  return featuredProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = featuredProjects.find((p) => p.slug === slug);
  if (!project) return {};
  return {
    title: project.name,
    description: project.summary,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = featuredProjects.find((p) => p.slug === slug);
  if (!project) notFound();

  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="container-page">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-accent-primary transition-colors mb-10"
          >
            <ArrowLeft size={16} />
            Back to projects
          </Link>

          <RevealOnScroll>
            <span className="eyebrow">{project.category}</span>
            <h1 className="font-display text-4xl sm:text-5xl mt-3 mb-6 text-gradient">
              {project.name}
            </h1>
            <p className="text-ink-secondary text-lg max-w-2xl leading-relaxed mb-6 font-sans">
              {project.summary}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {project.stack.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
            <div className="flex gap-4">
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-ink-primary hover:text-accent-primary transition-colors"
                >
                  <Github size={16} /> Source
                </a>
              )}
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-ink-primary hover:text-accent-primary transition-colors"
                >
                  <ExternalLink size={16} /> Live demo
                </a>
              )}
            </div>
          </RevealOnScroll>

          <RevealOnScroll index={1} className="mt-14">
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden glass">
              <Image src={project.cover} alt={`${project.name} architecture visual`} fill className="object-cover" priority />
            </div>
          </RevealOnScroll>

          <div className="mt-20 max-w-3xl space-y-14">
            {project.sections.map((section, i) => (
              <RevealOnScroll key={section.heading} index={i % 4}>
                <h2 className="font-display text-2xl text-ink-primary mb-4">{section.heading}</h2>
                <p className="text-ink-secondary leading-relaxed font-sans">{section.body}</p>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
