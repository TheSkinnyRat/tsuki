"use client";

import { useEffect, useState } from "react";
import styles from "./landing.module.css";

type Theme = "light" | "dark";

const STORAGE_KEY = "tsuki-theme";

/** Runs before first paint so a saved choice does not flash the other scheme. */
export const themeBootScript = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => setTheme(currentTheme());
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={styles.iconButton}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
