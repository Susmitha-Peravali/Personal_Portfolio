import { GlassPanel } from "@/components/ui/GlassPanel";
import { Badge } from "@/components/ui/Badge";
import { DecryptText } from "@/components/motion/DecryptText";

export function ProjectCard({
  project,
}: {
  project: { name: string; description: string; stack: string[] };
}) {
  return (
    <GlassPanel className="glass-hover p-6 h-full">
      <DecryptText
        as="h4"
        text={project.name}
        className="font-display text-lg text-ink-primary mb-2"
      />
      <p className="text-sm text-ink-secondary leading-relaxed mb-4">{project.description}</p>
      <div className="flex flex-wrap gap-2">
        {project.stack.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
    </GlassPanel>
  );
}
