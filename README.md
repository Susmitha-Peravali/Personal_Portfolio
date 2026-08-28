# Naga Teja Susmitha Peravali — Portfolio

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and Framer Motion.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Before you deploy

A few things are placeholders on purpose — I didn't want to fabricate content on your behalf:

1. **`public/resume.pdf`** — the Download Resume / Resume buttons link to `/resume.pdf`. Add your actual resume file at that path.
2. **Cover art** — `public/images/*-cover.svg` are generated placeholder graphics (dark gradient + starfield + project name) in the gold/olive/blue palette. Swap in real screenshots or diagrams for Zyviora, Tech Resale Hub, and BizVaani whenever you have them — same filenames, or update the `cover` path in `lib/data/projects.ts`.
3. **Live links** — `github`, `demo`, `linkedin`, and `email` in `lib/data/profile.ts` and `lib/data/projects.ts` are placeholder URLs. Update them to your real ones.
4. **Contact form** — currently opens the visitor's email client via a `mailto:` link (no backend, no secrets required, works immediately on any host). If you'd rather have it submit silently to an inbox, wire `components/contact/ContactForm.tsx` to a form backend instead.
5. **Mental Health Support Platform** project — intentionally left out of `lib/data/projects.ts` for now, per your note that you'll add it later.

## The galaxy background

`components/layout/GalaxyBackground.tsx` is a canvas starfield mounted once at the root layout, so it's visible behind every section on every route. Stars are drawn in gold/olive/blue/white, twinkle on a sine cycle, and drift with mouse position via a parallax offset per star (based on depth). It's capped at ~220 stars scaled to viewport size to stay performant, and fully disables mouse-parallax and twinkling when `prefers-reduced-motion` is set (stars render static instead).

If you want a denser or sparser field, adjust the `count` calculation in `makeStars()`. If you want the parallax to feel stronger or gentler, adjust the `parallax` multiplier in the draw loop.

## Project structure

```
app/                    routes (home, dynamic project pages)
components/
  intro/                one-time typing intro sequence
  layout/                navbar, footer, smooth-scroll provider
  hero/                  hero section + signature node-graph
  about/ skills/ experience/ projects/ achievements/ education/ contact/
  motion/                shared scroll-reveal variants/hooks
  ui/                    Button, Badge, SectionEyebrow primitives
lib/
  data/                  typed content — the single source of truth
  utils.ts
public/
  images/                cover art, icons
```

Content lives entirely in `lib/data/*.ts`. To update your experience, skills, achievements, or project write-ups, edit those files — no JSX changes needed.

## Notes on the build

- Fonts (Playfair Display, Inter, IBM Plex Mono) load via a `<link>` tag in `app/layout.tsx` rather than `next/font/google`, since the build sandbox this was created in couldn't reach `fonts.googleapis.com`. This works fine in production, but if you'd like Next's font optimization (self-hosted, zero layout shift), you can switch back to `next/font/google` once building somewhere with normal internet access — it's a drop-in swap.
- `prefers-reduced-motion` is respected globally: the intro sequence, smooth scroll, and hero parallax all short-circuit to static/instant behavior.
- All interactive elements (nav, form fields, node-graph nodes) have visible focus states for keyboard navigation.
