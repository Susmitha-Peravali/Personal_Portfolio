import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  icon?: LucideIcon;
  external?: boolean;
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  icon: Icon,
  external = false,
  className,
}: ButtonProps) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-accent-primary";

  const styles = {
    primary:
      "btn-tactile bg-accent-gradient text-bg-primary hover:-translate-y-0.5",
    ghost:
      "glass glass-hover text-ink-primary",
  };

  return (
    <Link
      href={href}
      className={cn(base, styles[variant], className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
    </Link>
  );
}
