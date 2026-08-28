import { featuredProjects, otherProjects } from "@/lib/data/projects";
import { experience } from "@/lib/data/profile";

export type TechUsage = {
  projects: { name: string; slug?: string }[];
  experienceCompanies: string[];
};

export function getTechUsage(tech: string): TechUsage {
  const projects = [
    ...featuredProjects
      .filter((p) => p.stack.includes(tech))
      .map((p) => ({ name: p.name, slug: p.slug })),
    ...otherProjects.filter((p) => p.stack.includes(tech)).map((p) => ({ name: p.name })),
  ];

  const experienceCompanies = experience
    .filter((e) => e.stack.includes(tech))
    .map((e) => e.company);

  return { projects, experienceCompanies };
}
