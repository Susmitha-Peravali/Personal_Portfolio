"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// WebGL needs the DOM/canvas APIs and pulls in the three.js chunk — keep it out of the initial
// server-rendered payload and load it only once the Hero actually mounts client-side.
//
// Renders the dense-grid amber particle portrait (see ParticlePortraitScene.tsx for what's in it
// and why) — replaces the earlier duotone/dissolve-plane + bloom effect, which read as an
// overexposed yellow wash rather than a hologram.
const ParticlePortraitScene = dynamic(
  () => import("./portrait/ParticlePortraitScene").then((m) => m.ParticlePortraitScene),
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
      <ParticlePortraitScene src={src} />
    </div>
  );
}
