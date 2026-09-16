"use client";

import type { PlayerSnapshot } from "@tsuki/shared";
import { api, formatDuration } from "@/lib/api.ts";
import { Artwork } from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

/** Where along a bar the click landed, from 0 to 1. */
function ratio(event: React.MouseEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
}

export function PlayerBar({
  guildId,
  player,
  positionMs,
  onAct,
}: {
  guildId: string;
  player: PlayerSnapshot | null;
  positionMs: number;
  onAct: Act;
}) {
  const current = player?.current ?? null;
  const playing = Boolean(player?.playing && !player?.paused);
  const repeatOn = Boolean(player && player.repeatMode !== "off");
  const repeatNext =
    player?.repeatMode === "off"
      ? "queue"
      : player?.repeatMode === "queue"
        ? "track"
        : "off";

  const length = current?.lengthMs ?? 0;
  const progress =
    current && !current.isStream && length > 0
      ? Math.min(100, (positionMs / length) * 100)
      : 0;
  // The bar spans 0–100; volumes above 100 (the API allows 200) read as full.
  const volume = player?.volume ?? 0;

  return (
    <div className="sticky bottom-0 z-[15] border-t border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_88%,transparent)] backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-[18px] px-[18px] py-3">
        <div className="flex min-w-[190px] flex-1 items-center gap-[11px]">
          <Artwork src={current?.artworkUrl} size={40} radius={7} />
          <span className="min-w-0">
            <span className="block truncate text-[13px]">
              {current?.title ?? "Nothing playing"}
            </span>
            <span className="block truncate text-[11.5px] text-[var(--color-muted)]">
              {current?.author ?? "—"}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="flex h-[18px] flex-none items-end gap-[2.5px] transition-opacity duration-150"
            style={{ opacity: playing ? 1 : 0.25 }}
          >
            {[0, 0.22, 0.44].map((delay) => (
              <span
                key={delay}
                className="h-full w-[2.5px] origin-bottom rounded-sm bg-[var(--color-halo)]"
                style={{
                  animation: playing
                    ? `tsuki-bar 1.1s ease-in-out ${delay}s infinite`
                    : "none",
                }}
              />
            ))}
          </span>
        </div>

        <div className="flex min-w-[280px] flex-[2] flex-col items-center gap-[7px]">
          <div className="flex items-center gap-3">
            <IconButton
              title="Shuffle the queue"
              disabled={!current || (player?.queue.length ?? 0) < 2}
              onClick={() =>
                onAct(() => api.post(guildId, "shuffle"), "Queue shuffled.")
              }
            >
              ⤮
            </IconButton>
            <TransportButton
              title="Previous"
              disabled={!current}
              onClick={() => onAct(() => api.post(guildId, "previous"))}
            >
              ◀◀
            </TransportButton>
            <button
              type="button"
              title="Play / pause"
              disabled={!current}
              onClick={() =>
                onAct(() => api.post(guildId, playing ? "pause" : "resume"))
              }
              className="grid size-[38px] cursor-pointer place-items-center rounded-full border-0 bg-[var(--color-accent)] font-[family-name:var(--font-mono)] text-xs text-[var(--color-on-accent)] transition-opacity duration-150 hover:opacity-[0.88] disabled:cursor-default disabled:opacity-40"
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <TransportButton
              title="Next"
              disabled={!current}
              onClick={() => onAct(() => api.post(guildId, "skip"))}
            >
              ▶▶
            </TransportButton>
            <IconButton
              title={`Loop: ${player?.repeatMode ?? "off"}`}
              active={repeatOn}
              disabled={!current}
              onClick={() =>
                onAct(() => api.post(guildId, "repeat", { mode: repeatNext }))
              }
            >
              ↻
            </IconButton>
          </div>

          <div className="flex w-full max-w-[520px] items-center gap-2.5">
            <span className="w-[34px] text-right font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
              {current?.isStream ? "live" : formatDuration(positionMs)}
            </span>
            <span
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={length}
              aria-valuenow={Math.round(positionMs)}
              onClick={(event) => {
                if (!current?.isSeekable) return;
                const target = Math.floor(ratio(event) * length);
                void onAct(() =>
                  api.post(guildId, "seek", { positionMs: target }),
                );
              }}
              className={`flex h-3.5 flex-1 items-center ${current?.isSeekable ? "cursor-pointer" : ""}`}
            >
              <span className="relative block h-[3px] w-full rounded-sm bg-[var(--color-line)]">
                <span
                  className="absolute inset-y-0 left-0 block rounded-sm bg-[var(--color-accent)]"
                  style={{ width: `${progress.toFixed(2)}%` }}
                />
              </span>
            </span>
            <span className="w-[34px] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
              {current?.isStream ? "" : formatDuration(length)}
            </span>
          </div>
        </div>

        <div className="flex min-w-[150px] flex-1 items-center justify-end gap-2.5">
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
            VOL
          </span>
          <span
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={volume}
            onClick={(event) => {
              if (!current) return;
              const next = Math.round(ratio(event) * 100);
              void onAct(() => api.post(guildId, "volume", { volume: next }));
            }}
            className={`flex h-3.5 w-[88px] items-center ${current ? "cursor-pointer" : ""}`}
          >
            <span className="relative block h-[3px] w-full rounded-sm bg-[var(--color-line)]">
              <span
                className="absolute inset-y-0 left-0 block rounded-sm bg-[var(--color-ink)]"
                style={{ width: `${Math.min(100, volume)}%` }}
              />
            </span>
          </span>
          <span className="w-[26px] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
            {volume}
          </span>
        </div>
      </div>
    </div>
  );
}

function TransportButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="grid size-[30px] cursor-pointer place-items-center border-0 bg-transparent font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-ink)] transition-colors duration-150 hover:text-[var(--color-halo)] disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 cursor-pointer place-items-center rounded-[7px] border bg-transparent text-[13px] disabled:cursor-default disabled:opacity-30 ${
        active
          ? "border-[var(--color-halo)] text-[var(--color-halo)]"
          : "border-transparent text-[var(--color-muted)]"
      }`}
    >
      {children}
    </button>
  );
}
