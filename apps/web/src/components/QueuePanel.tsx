"use client";

import { useState } from "react";
import type { NodeSummary, PlayerSnapshot } from "@tsuki/shared";
import { api, formatDuration } from "@/lib/api.ts";
import { Panel, SmallButton } from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

export function QueuePanel({
  guildId,
  player,
  nodes,
  onAct,
}: {
  guildId: string;
  player: PlayerSnapshot | null;
  nodes: NodeSummary[];
  onAct: Act;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const current = player?.current ?? null;
  const queue = player?.queue ?? [];
  const total = queue.length + (current ? 1 : 0);

  const sources = nodes
    .flatMap((node) => node.capabilities?.sources ?? [])
    .filter((source, index, all) => all.indexOf(source) === index);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setBusy(true);
    await onAct(() => api.post(guildId, "play", { query: value }), "Queued.");
    setQuery("");
    setBusy(false);
  }

  // The current track is row one, as in the design, so the list reads as the
  // whole run of the room rather than only what is still to come.
  const rows = [
    ...(current ? [{ track: current, index: -1 }] : []),
    ...queue.map((track, index) => ({ track, index })),
  ];

  return (
    <aside className="flex min-w-0 flex-col gap-4 px-6 pt-[30px] pb-10">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">Queue</span>
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-muted)]">
          {total} tracks · {formatDuration(player?.queueLengthMs ?? 0)} left
        </span>
      </div>

      <form onSubmit={submit}>
        <input
          value={query}
          disabled={busy}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={busy ? "Looking…" : "Paste a link or search…"}
          className="h-9 w-full rounded-[9px] border border-[var(--color-line)] bg-transparent px-3 text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-halo)]"
        />
        {sources.length > 0 ? (
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
            this server&apos;s node plays {sources.join(", ")}
          </p>
        ) : null}
      </form>

      <Panel>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--color-muted)]">
            The queue is empty.
          </div>
        ) : (
          rows.map(({ track, index }, position) => {
            const isCurrent = index === -1;
            const last = position === rows.length - 1;
            return (
              <div
                key={`${track.identifier}-${index}`}
                className={`flex items-center gap-[11px] px-3 py-2.5 ${
                  last ? "" : "border-b border-[var(--color-line)]"
                } ${isCurrent ? "bg-[var(--color-surface)]" : ""}`}
              >
                <span
                  className={`w-[22px] flex-none font-[family-name:var(--font-mono)] text-[11px] ${
                    isCurrent
                      ? "text-[var(--color-halo)]"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  {isCurrent ? "▶" : String(index + 2).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">
                    {track.title}
                  </span>
                  <span className="block truncate text-[11.5px] text-[var(--color-muted)]">
                    {track.author} ·{" "}
                    {track.requestedBy
                      ? (track.requestedByName ?? "a member")
                      : "autoplay"}
                  </span>
                </span>
                <span className="flex-none font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                  {track.isStream ? "live" : formatDuration(track.lengthMs)}
                </span>
                <button
                  type="button"
                  title={isCurrent ? "Skip" : "Remove"}
                  aria-label={
                    isCurrent ? `Skip ${track.title}` : `Remove ${track.title}`
                  }
                  onClick={() =>
                    onAct(
                      () =>
                        isCurrent
                          ? api.post(guildId, "skip")
                          : api.post(guildId, "queue/remove", { index }),
                      isCurrent ? "Skipped." : "Removed.",
                    )
                  }
                  className="size-[22px] flex-none cursor-pointer rounded-md border border-transparent bg-transparent text-[13px] leading-none text-[var(--color-muted)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </Panel>

      <div className="flex gap-2">
        <SmallButton
          className="flex-1"
          disabled={queue.length < 2}
          onClick={() =>
            onAct(() => api.post(guildId, "shuffle"), "Queue shuffled.")
          }
        >
          Shuffle queue
        </SmallButton>
        <SmallButton
          className="flex-1"
          muted
          disabled={queue.length === 0}
          onClick={() => onAct(() => api.post(guildId, "clear"), "Queue cleared.")}
        >
          Clear
        </SmallButton>
      </div>
    </aside>
  );
}
