import type { Config } from "tailwindcss";

// SolarCord design tokens. Colours reference CSS variables (see globals.css) so
// dark/light themes swap cleanly. Monochrome "black glass" palette (Vyntra-style):
// near-black base, white accent, faint grid + top glow, macOS frosted vibrancy.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        night: {
          900: "rgb(var(--night-900) / <alpha-value>)",
          800: "rgb(var(--night-800) / <alpha-value>)",
          700: "rgb(var(--night-700) / <alpha-value>)",
          600: "rgb(var(--night-600) / <alpha-value>)",
        },
        solar: {
          DEFAULT: "rgb(var(--solar) / <alpha-value>)",
          glow: "rgb(var(--solar-glow) / <alpha-value>)",
          ember: "rgb(var(--solar-ember) / <alpha-value>)",
        },
        aurora: "rgb(var(--aurora) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        glow: "0 0 60px -12px rgb(var(--solar-glow) / 0.45)",
        glass: "0 8px 32px -8px rgb(0 0 0 / 0.5)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
