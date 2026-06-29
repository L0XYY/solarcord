"use client";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("sc-theme", theme);
  } catch {
    /* ignore */
  }
}

// ── Solar+ accent themes ──
export type Accent = "default" | "solar" | "blurple" | "crimson" | "mint" | "violet" | "aqua" | "rose";

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "default", label: "Monochrome", swatch: "#d0d0d6" },
  { id: "solar", label: "Solar", swatch: "#ffb84d" },
  { id: "blurple", label: "Blurple", swatch: "#7c88f8" },
  { id: "crimson", label: "Crimson", swatch: "#f0606a" },
  { id: "mint", label: "Mint", swatch: "#48d6a4" },
  { id: "violet", label: "Violet", swatch: "#b284ff" },
  { id: "aqua", label: "Aqua", swatch: "#4ecee2" },
  { id: "rose", label: "Rose", swatch: "#f68ac4" },
];

export function getAccent(): Accent {
  if (typeof document === "undefined") return "default";
  return (document.documentElement.getAttribute("data-accent") as Accent) || "default";
}

export function setAccent(accent: Accent) {
  if (accent === "default") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", accent);
  try {
    if (accent === "default") localStorage.removeItem("sc-accent");
    else localStorage.setItem("sc-accent", accent);
  } catch {
    /* ignore */
  }
}
