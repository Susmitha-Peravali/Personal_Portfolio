import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "rgb(var(--color-bg-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-bg-secondary) / <alpha-value>)",
          elevated: "rgb(var(--color-bg-elevated) / <alpha-value>)",
        },
        accent: {
          primary: "rgb(var(--color-accent-primary) / <alpha-value>)",
          olive: "rgb(var(--color-accent-olive) / <alpha-value>)",
          blue: "rgb(var(--color-accent-blue) / <alpha-value>)",
          red: "rgb(var(--color-accent-red) / <alpha-value>)",
        },
        pastel: {
          lavender: "rgb(var(--color-accent-blue) / <alpha-value>)",
          mint: "rgb(var(--color-accent-olive) / <alpha-value>)",
          cream: "rgb(var(--color-accent-primary) / <alpha-value>)",
          sky: "rgb(var(--color-accent-blue) / <alpha-value>)",
          blush: "rgb(var(--color-accent-red) / <alpha-value>)",
        },
        ink: {
          primary: "rgb(var(--color-ink-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-ink-secondary) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        },
        line: "rgb(var(--color-accent-primary) / 0.18)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, rgb(var(--color-accent-primary)) 0%, rgb(var(--color-accent-red)) 100%)",
        "radial-fade":
          "radial-gradient(circle at center, rgb(var(--color-accent-primary) / 0.14) 0%, rgb(var(--color-bg-primary) / 0) 70%)",
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        blink: "blink 1s step-end infinite",
        "drift-a": "driftA 26s ease-in-out infinite",
        "drift-b": "driftB 32s ease-in-out infinite",
        "drift-c": "driftC 22s ease-in-out infinite",
        "spin-slow": "spinSlow 16s linear infinite",
        "spin-slower": "spinSlow 24s linear infinite reverse",
        scanline: "scanlineDrift 8s linear infinite",
        flicker: "crtFlicker 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        driftA: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(60px, 80px) scale(1.08)" },
        },
        driftB: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(-70px, 50px) scale(1.05)" },
        },
        driftC: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(40px, -60px) scale(1.1)" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
        scanlineDrift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 4px" },
        },
        crtFlicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.94" },
          "94%": { opacity: "1" },
          "97%": { opacity: "0.97" },
          "98%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
