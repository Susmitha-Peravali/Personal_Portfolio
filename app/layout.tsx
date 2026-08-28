import type { Metadata } from "next";
import "./globals.css";
import { TerminalBackground } from "@/components/layout/TerminalBackground";
import { ScanlineOverlay } from "@/components/layout/ScanlineOverlay";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { CustomCursor } from "@/components/cursor/CustomCursor";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://susmitha-portfolio-cyan.vercel.app"),
  title: {
    default: "Naga Teja Susmitha Peravali — Software Engineer",
    template: "%s — Naga Teja Susmitha Peravali",
  },
  description:
    "Software engineer building intelligent, full-stack products across AI, backend systems, and frontend engineering.",
  openGraph: {
    title: "Naga Teja Susmitha Peravali — Software Engineer",
    description:
      "Software engineer building intelligent, full-stack products across AI, backend systems, and frontend engineering.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased bg-bg-primary text-ink-primary">
        <ThemeProvider>
          <TerminalBackground />
          <div className="relative z-10">{children}</div>
          <ScanlineOverlay />
          <CustomCursor />
        </ThemeProvider>
      </body>
    </html>
  );
}
