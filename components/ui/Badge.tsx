import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[0.7rem] tracking-wide uppercase text-ink-secondary bg-white/[0.04] border border-line rounded-full px-3 py-1",
        className
      )}
    >
      {children}
    </span>
  );
}
