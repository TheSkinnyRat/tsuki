"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import styles from "./landing.module.css";

/** Pauses the decorative orbits, stars and level bars on the whole page. */
export function MotionToggle() {
  const [paused, setPaused] = useState(false);

  function toggle() {
    const next = !paused;
    setPaused(next);
    document
      .querySelector("[data-landing-page]")
      ?.setAttribute("data-motion-paused", String(next));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={styles.motionControl}
      aria-label="Pause ambient animation"
      aria-pressed={paused}
    >
      {paused ? (
        <Play size={11} strokeWidth={2.25} aria-hidden />
      ) : (
        <Pause size={11} strokeWidth={2.25} aria-hidden />
      )}
      {paused ? "Motion paused" : "Pause motion"}
    </button>
  );
}
