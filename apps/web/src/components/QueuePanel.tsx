"use client";

import { useState } from "react";
import type { NodeSummary, PlayerSnapshot } from "@tsuki/shared";
import { api, formatDuration } from "@/lib/api.ts";

export function QueuePanel({
  guildId,
  player,
  nodes,
  onAct,
}: {
  guildId: string;
  player: PlayerSnapshot | null;
  nodes: NodeSummary[];
  onAct: (run: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const queue = player?.queue ?? [];
  const sources = nodes
    .flatMap((node) => node.capabilities?.sources ?? [])
    .filter((source, index, all) => all.indexOf(source) === index);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    await onAct(
      () => api.post(guildId, "play", { query: query.trim() }),
      "Queued.",
    );
    setQuery("");
    setBusy(false);
  }

  return (
    <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Queue</h2>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
          {queue.length} tracks · {formatDuration(player?.queueLengthMs ?? 0)} left
        </span>
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Paste a link or search…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-halo)] disabled:opacity-40"
        >
          Queue
        </button>
      </form>

      {sources.length > 0 ? (
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
          this server&apos;s node plays: {sources.join(", ")}
        </p>
      ) : null}

      {queue.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--color-muted)]">
          Nothing queued after the current track.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-[var(--color-line)]">
          {queue.map((track, index) => (
            <li
              key={`${track.identifier}-${index}`}
              className="flex items-center gap-3 py-2"
            >
              <span className="w-6 shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{track.title}</span>
                <span className="block truncate text-xs text-[var(--color-muted)]">
                  {track.author}
                </span>
              </span>
              <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                {track.isStream ? "live" : formatDuration(track.lengthMs)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${track.title}`}
                onClick={() =>
                  onAct(
                    () => api.post(guildId, "queue/remove", { index }),
                    "Removed.",
                  )
                }
                className="shrink-0 rounded px-1.5 text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-ink)]"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      {queue.length > 1 ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() =>
              onAct(() => api.post(guildId, "shuffle"), "Queue shuffled.")
            }
            className="flex-1 rounded-lg border border-[var(--color-line)] py-2 text-sm transition-colors duration-150 hover:border-[var(--color-accent)]"
          >
            Shuffle queue
          </button>
          <button
            type="button"
            onClick={() =>
              onAct(() => api.post(guildId, "clear"), "Queue cleared.")
            }
            className="flex-1 rounded-lg border border-[var(--color-line)] py-2 text-sm transition-colors duration-150 hover:border-[var(--color-accent)]"
          >
            Clear
          </button>
        </div>
      ) : null}
    </section>
  );
}
