"use client";

import type { PlayerSnapshot } from "@tsuki/shared";
import { api, formatDuration } from "@/lib/api.ts";

export function PlayerBar({
  guildId,
  player,
  positionMs,
  onAct,
}: {
  guildId: string;
  player: PlayerSnapshot | null;
  positionMs: number;
  onAct: (run: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const current = player?.current ?? null;
  if (!current) return null;

  const repeatNext =
    player?.repeatMode === "off"
      ? "queue"
      : player?.repeatMode === "queue"
        ? "track"
        : "off";

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate text-sm font-medium">{current.title}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {current.author}
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center gap-1 sm:flex-none">
          <Control
            label="Previous is not supported yet"
            disabled
            hideOnPhone
            onClick={() => undefined}
          >
            ‹‹
          </Control>
          <button
            type="button"
            aria-label={player?.paused ? "Resume" : "Pause"}
            onClick={() =>
              onAct(() =>
                api.post(guildId, player?.paused ? "resume" : "pause"),
              )
            }
            className="grid size-10 place-items-center rounded-full bg-[var(--color-accent)] text-white transition-colors duration-150 hover:bg-[var(--color-halo)]"
          >
            {player?.paused ? "▶" : "❚❚"}
          </button>
          <Control
            label="Skip"
            onClick={() => onAct(() => api.post(guildId, "skip"))}
          >
            ››
          </Control>
          <Control
            label={`Repeat: ${player?.repeatMode ?? "off"}`}
            onClick={() =>
              onAct(() => api.post(guildId, "repeat", { mode: repeatNext }))
            }
            active={player?.repeatMode !== "off"}
          >
            ↻
          </Control>
          <Control
            label="Stop and leave"
            onClick={() => onAct(() => api.post(guildId, "stop"), "Stopped.")}
          >
            ■
          </Control>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)] sm:inline">
            {current.isStream ? "live" : formatDuration(positionMs)}
          </span>
          <label className="flex items-center gap-2">
            <span className="hidden font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)] sm:inline">
              vol
            </span>
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              defaultValue={player?.volume ?? 30}
              onMouseUp={(event) =>
                onAct(() =>
                  api.post(guildId, "volume", {
                    volume: Number(event.currentTarget.value),
                  }),
                )
              }
              onTouchEnd={(event) =>
                onAct(() =>
                  api.post(guildId, "volume", {
                    volume: Number(event.currentTarget.value),
                  }),
                )
              }
              className="w-16 accent-[var(--color-accent)] sm:w-24"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function Control({
  children,
  label,
  onClick,
  disabled,
  active,
  hideOnPhone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  hideOnPhone?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`${hideOnPhone ? "hidden sm:grid" : "grid"} size-9 place-items-center rounded-full text-sm transition-colors duration-150 ${
        active
          ? "bg-[var(--color-soft)] text-[var(--color-ink)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}
