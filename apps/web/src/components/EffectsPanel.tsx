"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerSnapshot } from "@tsuki/shared";
import { api } from "@/lib/api.ts";

/**
 * Kept in step with `apps/bot/src/core/filters.ts` by hand.
 *
 * The bot refuses an effect the guild's node does not offer, so a stale entry
 * here produces a clear refusal rather than a switch that silently does
 * nothing — which is why this list is allowed to be a copy at all.
 */
const EFFECTS: Array<{ name: string; describe: string }> = [
  { name: "nightcore", describe: "faster and higher" },
  { name: "vaporwave", describe: "slower and lower" },
  { name: "8d", describe: "sound circling the head" },
  { name: "karaoke", describe: "vocals pushed down" },
  { name: "tremolo", describe: "wobbling volume" },
  { name: "vibrato", describe: "wobbling pitch" },
  { name: "lowpass", describe: "highs cut away" },
  { name: "mono", describe: "both channels merged" },
];

const EQ_PRESETS = [
  "BassboostLow",
  "BassboostMedium",
  "BassboostHigh",
  "BetterMusic",
  "Rock",
  "Classic",
  "Pop",
  "Electronic",
  "FullSound",
  "Gaming",
];

export function EffectsPanel({
  guildId,
  player,
  onAct,
}: {
  guildId: string;
  player: PlayerSnapshot | null;
  onAct: (run: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const active = new Set(player?.activeFilters ?? []);
  const playing = Boolean(player?.current);
  const [state, setState] = useState<{ speed: number; pitch: number } | null>(
    null,
  );

  // The sliders show what is actually applied: nightcore moves speed to 1.29,
  // and a control parked at 1 while the audio is faster is a control that lies.
  const load = useCallback(async () => {
    if (!playing) return setState(null);
    const filters = await api.filters(guildId).catch(() => null);
    setState(filters ? { speed: filters.speed, pitch: filters.pitch } : null);
  }, [guildId, playing]);

  useEffect(() => {
    void load();
  }, [load, player?.activeFilters.join(",")]);

  // Lavalink's own filter names, mapped to the ones a listener recognises.
  const isOn = (effect: string) =>
    effect === "8d"
      ? active.has("rotation")
      : effect === "lowpass"
        ? active.has("lowPass")
        : active.has(effect);

  return (
    <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Effects</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {playing
            ? "Applied to what is playing right now."
            : "Start something first — effects apply to a live player."}
        </p>

        <div className="mt-4 grid gap-2">
          {EFFECTS.map((effect) => (
            <button
              key={effect.name}
              type="button"
              disabled={!playing}
              onClick={() =>
                onAct(() =>
                  api.post(guildId, "filters/toggle", { effect: effect.name }),
                )
              }
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors duration-150 disabled:opacity-40 ${
                isOn(effect.name)
                  ? "border-[var(--color-accent)] bg-[var(--color-soft)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
              }`}
            >
              <span>
                <span className="block text-sm font-medium">{effect.name}</span>
                <span className="block text-xs text-[var(--color-muted)]">
                  {effect.describe}
                </span>
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                {isOn(effect.name) ? "on" : "off"}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!playing}
          onClick={() =>
            onAct(
              () => api.post(guildId, "filters/reset"),
              "Every effect cleared.",
            )
          }
          className="mt-4 w-full rounded-lg border border-[var(--color-line)] py-2 text-sm transition-colors duration-150 hover:border-[var(--color-accent)] disabled:opacity-40"
        >
          Clear everything
        </button>
      </section>

      <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Equaliser</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Presets, applied to the whole player.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {EQ_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={!playing}
              onClick={() =>
                onAct(
                  () => api.post(guildId, "filters/eq", { preset }),
                  `Equaliser set to ${preset}.`,
                )
              }
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs transition-colors duration-150 hover:border-[var(--color-accent)] disabled:opacity-40"
            >
              {preset}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-medium">Speed and pitch</h3>
        <div className="mt-3 grid gap-3">
          <Slider
            label="Speed"
            value={state?.speed ?? 1}
            disabled={!playing}
            onCommit={async (value) => {
              await onAct(
                () => api.post(guildId, "filters/timescale", { speed: value }),
                `Speed ${value}×.`,
              );
              await load();
            }}
          />
          <Slider
            label="Pitch"
            value={state?.pitch ?? 1}
            disabled={!playing}
            onCommit={async (value) => {
              await onAct(
                () => api.post(guildId, "filters/timescale", { pitch: value }),
                `Pitch ${value}×.`,
              );
              await load();
            }}
          />
        </div>
      </section>
    </div>
  );
}

function Slider({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="flex justify-between text-xs font-medium text-[var(--color-muted)]">
        <span>{label}</span>
        <span className="font-[family-name:var(--font-mono)]">
          {value.toFixed(2)}×
        </span>
      </span>
      <input
        key={value}
        type="range"
        min={0.5}
        max={2}
        step={0.05}
        defaultValue={value}
        disabled={disabled}
        onMouseUp={(event) => onCommit(Number(event.currentTarget.value))}
        onTouchEnd={(event) => onCommit(Number(event.currentTarget.value))}
        className="accent-[var(--color-accent)] disabled:opacity-40"
      />
    </label>
  );
}
