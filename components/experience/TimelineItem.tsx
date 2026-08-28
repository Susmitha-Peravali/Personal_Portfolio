import type { ExperienceItem } from "@/lib/data/profile";
import { Badge } from "@/components/ui/Badge";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { GlassPanel } from "@/components/ui/GlassPanel";

export function TimelineItem({ item, index }: { item: ExperienceItem; index: number }) {
  return (
    <RevealOnScroll index={index} variant="slide-right">
      <div className="relative pl-10 pb-10 last:pb-0 border-l border-line last:border-transparent">
        <span
          className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-bg-primary border-2 border-accent-primary"
          aria-hidden="true"
        />
        <GlassPanel className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-xl text-ink-primary">{item.company}</h3>
            <span className="font-mono text-xs text-ink-muted uppercase tracking-wide">
              {item.period}
            </span>
          </div>
          <p className="text-accent-primary text-sm font-medium mb-3">{item.role}</p>
          <p className="text-ink-secondary leading-relaxed mb-4">{item.summary}</p>
          <ul className="space-y-1.5 mb-4">
            {item.highlights.map((h) => (
              <li key={h} className="text-sm text-ink-secondary flex gap-2">
                <span className="mt-1.5 block w-1 h-1 rounded-full bg-accent-primary shrink-0" />
                {h}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {item.stack.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </GlassPanel>
      </div>
    </RevealOnScroll>
  );
}
