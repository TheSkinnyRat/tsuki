"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerSnapshot } from "@tsuki/shared";
import { api, ApiError } from "@/lib/api.ts";
import { Panel, PanelHeader, Row, RowText, SmallButton, Switch } from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

/**
 * Kept in step with `apps/bot/src/core/filters.ts` by hand. The bot refuses an
 * effect the guild's node does not offer, so a stale entry here produces a
 * clear refusal rather than a switch that silently does nothing.
 */
const EFFECTS: Array<{ name: string; lavalink: string; describe: string }> = [
  { name: "nightcore", lavalink: "nightcore", describe: "Faster and higher" },
  { name: "vaporwave", lavalink: "vaporwave", describe: "Slower and lower" },
  { name: "8d", lavalink: "rotation", describe: "Sound circling the head" },
  { name: "karaoke", lavalink: "karaoke", describe: "Vocals pushed down" },
  { name: "tremolo", lavalink: "tremolo", describe: "Wobbling volume" },
  { name: "vibrato", lavalink: "vibrato", describe: "Wobbling pitch" },
  { name: "lowpass", lavalink: "lowPass", describe: "Highs cut away" },
  { name: "mono", lavalink: "mono", describe: "Both channels merged" },
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
  onAct: Act;
}) {
  const playing = Boolean(player?.current);
  const [state, setState] = useState<{
    effects: Record<string, boolean | undefined>;
    speed: number;
    pitch: number;
  } | null>(null);

  // Read from the node, not from the snapshot: nightcore moves speed to 1.29×,
  // and a control parked at 1× while the audio is faster is a control that lies.
  const load = useCallback(async () => {
    if (!playing) return setState(null);
    const filters = await api.filters(guildId).catch(() => null);
    setState(
      filters
        ? { effects: filters.effects, speed: filters.speed, pitch: filters.pitch }
        : null,
    );
  }, [guildId, playing]);

  const activeKey = player?.activeFilters.join(",");
  useEffect(() => {
    void load();
  }, [load, activeKey]);

  const run = async (call: () => Promise<unknown>, success?: string) => {
    await onAct(call, success);
    await load();
  };

  return (
    <div className="grid gap-4">
      {!playing ? (
        <p className="text-[13px] text-[var(--color-muted)]">
          Effects apply to a live player — start something first.
        </p>
      ) : null}

      <Panel>
        <PanelHeader title="Effects" meta="applied to what is playing" />
        {EFFECTS.map((effect, index) => (
          <Row key={effect.name} last={index === EFFECTS.length - 1}>
            <RowText title={effect.name} detail={effect.describe} />
            <Switch
              label={effect.name}
              disabled={!playing}
              on={Boolean(state?.effects[effect.name])}
              onChange={() =>
                run(() =>
                  api.post(guildId, "filters/toggle", { effect: effect.name }),
                )
              }
            />
          </Row>
        ))}
      </Panel>

      <Panel>
        <PanelHeader title="Equaliser" meta="presets" />
        <div className="flex flex-wrap gap-2 px-4 py-[13px]">
          {EQ_PRESETS.map((preset) => (
            <SmallButton
              key={preset}
              className="h-7"
              disabled={!playing}
              onClick={() =>
                run(
                  () => api.post(guildId, "filters/eq", { preset }),
                  `Equaliser set to ${preset}.`,
                )
              }
            >
              {preset}
            </SmallButton>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Speed and pitch" />
        <Timescale
          label="Speed"
          value={state?.speed ?? 1}
          disabled={!playing}
          onCommit={(value) =>
            run(
              () => api.post(guildId, "filters/timescale", { speed: value }),
              `Speed ${value.toFixed(2)}×.`,
            )
          }
        />
        <Timescale
          label="Pitch"
          last
          value={state?.pitch ?? 1}
          disabled={!playing}
          onCommit={(value) =>
            run(
              () => api.post(guildId, "filters/timescale", { pitch: value }),
              `Pitch ${value.toFixed(2)}×.`,
            )
          }
        />
      </Panel>

      <SmallButton
        muted
        disabled={!playing}
        onClick={() =>
          run(() => api.post(guildId, "filters/reset"), "Every effect cleared.")
        }
      >
        Clear every effect
      </SmallButton>

      <SponsorBlock guildId={guildId} playing={playing} onAct={onAct} />
    </div>
  );
}

const MIN = 0.5;
const MAX = 2;

function Timescale({
  label,
  value,
  disabled,
  onCommit,
  last,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
  last?: boolean;
}) {
  const pct = ((Math.min(MAX, Math.max(MIN, value)) - MIN) / (MAX - MIN)) * 100;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-[13px] ${
        last ? "" : "border-b border-[var(--color-line)]"
      }`}
    >
      <span className="w-12 text-[13.5px]">{label}</span>
      <span
        role="slider"
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        onClick={(event) => {
          if (disabled) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          const next = Math.round((MIN + ratio * (MAX - MIN)) * 20) / 20;
          onCommit(next);
        }}
        className={`flex h-3.5 flex-1 items-center ${disabled ? "opacity-40" : "cursor-pointer"}`}
      >
        <span className="relative block h-[3px] w-full rounded-sm bg-[var(--color-line)]">
          <span
            className="absolute inset-y-0 left-0 block rounded-sm bg-[var(--color-accent)]"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
      <span className="w-12 text-right font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-muted)]">
        {value.toFixed(2)}×
      </span>
    </div>
  );
}

const SEGMENTS: Array<[string, string]> = [
  ["sponsor", "Paid promotion"],
  ["selfpromo", "Unpaid self-promotion"],
  ["interaction", "Like and subscribe reminders"],
  ["intro", "Intro animation"],
  ["outro", "Endcards and credits"],
  ["preview", "Recap or preview"],
  ["music_offtopic", "Non-music section in a music video"],
  ["filler", "Filler tangents"],
];

/**
 * Loaded once when the tab opens rather than with the poll: it is a plugin on
 * the guild's node, usually absent, and the refusal names the missing plugin.
 */
function SponsorBlock({
  guildId,
  playing,
  onAct,
}: {
  guildId: string;
  playing: boolean;
  onAct: Act;
}) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ok"; on: string[] } | { kind: "refused"; message: string }
  >({ kind: "loading" });

  const load = useCallback(async () => {
    if (!playing) return setState({ kind: "refused", message: "Start something first." });
    try {
      const found = await api.sponsorblock(guildId);
      setState({ kind: "ok", on: found.categories });
    } catch (error) {
      setState({
        kind: "refused",
        message: error instanceof ApiError ? error.message : "Could not read SponsorBlock.",
      });
    }
  }, [guildId, playing]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (category: string, next: boolean) => {
    if (state.kind !== "ok") return;
    const chosen = next
      ? [...state.on, category]
      : state.on.filter((value) => value !== category);
    await onAct(
      () =>
        chosen.length === 0
          ? api.del(guildId, "sponsorblock")
          : api.put(guildId, "sponsorblock", { categories: chosen }),
      chosen.length === 0 ? "SponsorBlock off." : "SponsorBlock updated.",
    );
    await load();
  };

  return (
    <Panel>
      <PanelHeader title="SponsorBlock" meta="needs the plugin on your node" />
      {state.kind === "ok" ? (
        SEGMENTS.map(([category, detail], index) => (
          <Row key={category} last={index === SEGMENTS.length - 1}>
            <RowText title={category} detail={detail} />
            <Switch
              label={category}
              on={state.on.includes(category)}
              onChange={(next) => toggle(category, next)}
            />
          </Row>
        ))
      ) : (
        <div className="px-4 py-[13px] text-[12.5px] text-[var(--color-muted)]">
          {state.kind === "loading" ? "Checking the node…" : state.message}
        </div>
      )}
    </Panel>
  );
}
