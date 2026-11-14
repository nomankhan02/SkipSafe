"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dim" | "dark";

export const THEMES: Theme[] = ["light", "dim", "dark"];

export const THEME_SWATCHES: Record<Theme, string> = {
  light: "#faf9f5",
  dim: "#383a41",
  dark: "#141519",
};

const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dim" || value === "dark";

export const themeStore = {
  subscribe(onStoreChange: () => void): () => void {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    if (isTheme(stored) && root.getAttribute("data-theme") !== stored) {
      root.setAttribute("data-theme", stored);
    }
    const observer = new MutationObserver(onStoreChange);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  },
  getSnapshot(): Theme {
    const value = document.documentElement.getAttribute("data-theme");
    return isTheme(value) ? value : "light";
  },
  getServerSnapshot(): Theme {
    return "light";
  },
};

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return [theme, cycleTheme];
}

