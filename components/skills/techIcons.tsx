import type { IconType } from "react-icons";
import { Code2 } from "lucide-react";
import {
  SiPython,
  SiJavascript,
  SiOpenjdk,
  SiCplusplus,
  SiC,
  SiPhp,
  SiReact,
  SiNextdotjs,
  SiTailwindcss,
  SiBootstrap,
  SiHtml5,
  SiCss,
  SiNodedotjs,
  SiExpress,
  SiFlask,
  SiMongodb,
  SiMysql,
  SiGooglegemini,
  SiGit,
  SiGithub,
  SiDocker,
  SiPostman,
  SiFigma,
  SiChartdotjs,
} from "react-icons/si";

export const TECH_ICON_MAP: Record<string, IconType> = {
  Python: SiPython,
  JavaScript: SiJavascript,
  Java: SiOpenjdk,
  "C++": SiCplusplus,
  C: SiC,
  PHP: SiPhp,
  React: SiReact,
  "Next.js": SiNextdotjs,
  "Tailwind CSS": SiTailwindcss,
  Bootstrap: SiBootstrap,
  HTML: SiHtml5,
  CSS: SiCss,
  "Node.js": SiNodedotjs,
  "Express.js": SiExpress,
  Flask: SiFlask,
  MongoDB: SiMongodb,
  MySQL: SiMysql,
  "Google Gemini API": SiGooglegemini,
  Git: SiGit,
  GitHub: SiGithub,
  Docker: SiDocker,
  Postman: SiPostman,
  Figma: SiFigma,
  "Chart.js": SiChartdotjs,
};

export function TechIcon({ tech, className }: { tech: string; className?: string }) {
  const Icon = TECH_ICON_MAP[tech] ?? Code2;
  return <Icon className={className} aria-hidden="true" />;
}
