"use client";

import { useTheme, THEMES, THEME_SWATCHES } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, cycleTheme] = useTheme();

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${theme}. Activate to change theme`}
      className="flex items-center gap-2 border border-border px-2 py-1 transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {theme}
      </span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {THEMES.map((t) => (
          <span
            key={t}
            className={`block size-2.5 transition-colors ${
              theme === t
                ? "border-2 border-foreground"
                : "border border-border"
            }`}
            style={{ backgroundColor: THEME_SWATCHES[t] }}
          />
        ))}
      </span>
    </button>
  );
}

