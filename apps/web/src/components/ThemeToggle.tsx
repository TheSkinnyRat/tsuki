"use client";

import { useEffect, useState } from "react";

const KEY = "tsuki-theme";

/**
 * Light/dark override on top of the system preference, as in the design.
 * Stored per browser; storage can be unavailable (private mode), so every read
 * and write is guarded and the page still follows the system when it is.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    const initial =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    if (saved) document.documentElement.dataset["theme"] = saved;
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme"
      aria-label="Toggle theme"
      className="grid size-[30px] cursor-pointer place-items-center rounded-lg border border-[var(--color-line)] bg-transparent font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)] transition-colors duration-150 hover:border-[var(--color-halo)] hover:text-[var(--color-ink)]"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
