"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDuration } from "@/lib/api.ts";

interface PlaylistRow {
  name: string;
  trackCount: number;
  totalLengthMs: number;
  createdBy: string;
}

export function PlaylistsPanel({
  guildId,
  onAct,
}: {
  guildId: string;
  onAct: (run: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await api.playlists(guildId).catch(() => []);
    setPlaylists(rows);
  }, [guildId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onAct(
      () => api.post(guildId, "playlists", { name: name.trim() }),
      `Saved "${name.trim()}".`,
    );
    setName("");
    setBusy(false);
    await load();
  }

  return (
    <div className="grid max-w-4xl gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Saved playlists</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Stored per server. Loading one needs you in a voice channel.
        </p>

        {playlists.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
            Nothing saved yet. Queue some tracks, then save them on the right.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-line)]">
            {playlists.map((playlist) => (
              <li
                key={playlist.name}
                className="flex flex-wrap items-center gap-2 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {playlist.name}
                  </span>
                  <span className="block font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                    {playlist.trackCount} tracks ·{" "}
                    {formatDuration(playlist.totalLengthMs)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onAct(
                      () =>
                        api.post(
                          guildId,
                          `playlists/${encodeURIComponent(playlist.name)}/load`,
                          {},
                        ),
                      `Queued "${playlist.name}".`,
                    )
                  }
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs transition-colors duration-150 hover:border-[var(--color-accent)]"
                >
                  Queue
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onAct(
                      () =>
                        api.post(
                          guildId,
                          `playlists/${encodeURIComponent(playlist.name)}/load`,
                          { shuffle: true },
                        ),
                      `Queued "${playlist.name}" shuffled.`,
                    )
                  }
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs transition-colors duration-150 hover:border-[var(--color-accent)]"
                >
                  Shuffled
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onAct(
                      () =>
                        api.del(
                          guildId,
                          `playlists/${encodeURIComponent(playlist.name)}`,
                        ),
                      `Deleted "${playlist.name}".`,
                    );
                    await load();
                  }}
                  className="rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-ink)]"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Save the current queue</h2>
        <form onSubmit={save} className="mt-3 grid gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Friday night"
            className="rounded-lg border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-halo)] disabled:opacity-40"
          >
            Save
          </button>
          <p className="text-xs text-[var(--color-muted)]">
            Saving a name that already exists replaces it. Tracks are stored in
            the node&apos;s own encoded form, so a playlist saved while a
            different node was configured may not load in full — Tsuki says how
            many it could not read.
          </p>
        </form>
      </section>
    </div>
  );
}
