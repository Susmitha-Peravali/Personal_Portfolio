"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// WebGL needs the DOM/canvas APIs and pulls in the three.js chunk — keep it out of the initial
// server-rendered payload and load it only once the Hero actually mounts client-side.
const PortraitScene = dynamic(
  () => import("./portrait/Scene").then((m) => m.PortraitScene),
  { ssr: false }
);

export function HolographicPortrait({
  src = "/images/profile.png",
  className,
}: {
  src?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden="true">
      <PortraitScene src={src} />
    </div>
  );
}
