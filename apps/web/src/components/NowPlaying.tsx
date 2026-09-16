"use client";

import type { NodeSummary, PlayerSnapshot } from "@tsuki/shared";
import { formatDuration } from "@/lib/api.ts";

export function NowPlaying({
  player,
  positionMs,
  nodes,
}: {
  player: PlayerSnapshot | null;
  positionMs: number;
  nodes: NodeSummary[];
}) {
  const current = player?.current ?? null;
  const connected = nodes.filter((node) => node.connected);

  if (!current) {
    return (
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium text-[var(--color-muted)]">
          Now playing
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {nodes.length === 0
            ? "This server has no audio node yet. Add one under Audio nodes — Tsuki plays through a Lavalink node you provide."
            : connected.length === 0
              ? "None of this server's nodes are reachable right now."
              : "Nothing is playing. Paste a link on the right to start."}
        </p>
      </section>
    );
  }

  const progress =
    current.isStream || current.lengthMs === 0
      ? 0
      : Math.min(100, (positionMs / current.lengthMs) * 100);

  return (
    <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <h2 className="font-[family-name:var(--font-mono)] text-xs tracking-wide text-[var(--color-muted)] uppercase">
        {player?.paused ? "Paused" : "Now playing"}
      </h2>

      <div className="mt-3 flex gap-4">
        {current.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.artworkUrl}
            alt=""
            className="size-24 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="size-24 shrink-0 rounded-lg bg-[var(--color-soft)]" />
        )}

        <div className="min-w-0">
          <p className="truncate text-xl font-medium">{current.title}</p>
          <p className="truncate text-sm text-[var(--color-muted)]">
            {current.author}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
            {current.sourceName ? (
              <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5">
                {current.sourceName}
              </span>
            ) : null}
            {current.requestedBy ? (
              <span className="max-w-full truncate rounded border border-[var(--color-line)] px-1.5 py-0.5">
                asked by {current.requestedByName ?? "a member"}
              </span>
            ) : (
              <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5">
                autoplay
              </span>
            )}
            {player?.nodeName ? (
              <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5">
                via {player.nodeName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
          <span>{current.isStream ? "live" : formatDuration(positionMs)}</span>
          <span>{current.isStream ? "" : formatDuration(current.lengthMs)}</span>
        </div>
      </div>

      {player && player.activeFilters.length > 0 ? (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Effects on: {player.activeFilters.join(", ")}
        </p>
      ) : null}
    </section>
  );
}
