"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDuration } from "@/lib/api.ts";
import { Artwork, Panel, SmallButton } from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

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
  onAct: Act;
}) {
  const [playlists, setPlaylists] = useState<PlaylistRow[] | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setPlaylists(await api.playlists(guildId).catch(() => []));
  }, [guildId]);

  useEffect(() => {
    void load();
  }, [load]);

  const path = (playlist: string) =>
    `playlists/${encodeURIComponent(playlist)}`;

  return (
    <div className="grid gap-4">
      <Panel>
        {playlists === null ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--color-muted)]">
            Loading…
          </div>
        ) : playlists.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--color-muted)]">
            No playlists saved on this server yet.
          </div>
        ) : (
          playlists.map((playlist, index) => (
            <div
              key={playlist.name}
              className={`flex items-center gap-3 px-3.5 py-3 ${
                index === playlists.length - 1
                  ? ""
                  : "border-b border-[var(--color-line)]"
              }`}
            >
              <Artwork src={null} size={38} radius={7} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">
                  {playlist.name}
                </span>
                <span className="block text-xs text-[var(--color-muted)]">
                  {playlist.trackCount} tracks ·{" "}
                  {formatDuration(playlist.totalLengthMs)}
                </span>
              </span>
              <SmallButton
                className="h-7 flex-none"
                onClick={() =>
                  onAct(
                    () => api.post(guildId, `${path(playlist.name)}/load`, {}),
                    `Queued "${playlist.name}".`,
                  )
                }
              >
                Queue
              </SmallButton>
              <SmallButton
                className="h-7 flex-none"
                muted
                onClick={() =>
                  onAct(
                    () =>
                      api.post(guildId, `${path(playlist.name)}/load`, {
                        shuffle: true,
                      }),
                    `Queued "${playlist.name}" shuffled.`,
                  )
                }
              >
                Shuffled
              </SmallButton>
              <button
                type="button"
                title={`Delete ${playlist.name}`}
                aria-label={`Delete ${playlist.name}`}
                onClick={async () => {
                  await onAct(
                    () => api.del(guildId, path(playlist.name)),
                    `Deleted "${playlist.name}".`,
                  );
                  await load();
                }}
                className="size-[22px] flex-none cursor-pointer rounded-md border border-transparent bg-transparent text-[13px] leading-none text-[var(--color-muted)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]"
              >
                ×
              </button>
            </div>
          ))
        )}
      </Panel>

      <form
        className="flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const value = name.trim();
          if (!value) return;
          await onAct(
            () => api.post(guildId, "playlists", { name: value }),
            `Saved "${value}".`,
          );
          setName("");
          await load();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Save the current queue as…"
          className="h-9 min-w-0 flex-1 rounded-[9px] border border-[var(--color-line)] bg-transparent px-3 text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-halo)]"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="h-9 cursor-pointer rounded-[9px] border-0 bg-[var(--color-accent)] px-4 text-[13px] text-[var(--color-on-accent)] hover:opacity-[0.88] disabled:cursor-default disabled:opacity-40"
        >
          Save
        </button>
      </form>
      <p className="text-xs text-[var(--color-muted)]">
        Saving an existing name replaces it. A playlist saved while another node
        was configured may not load in full — Tsuki says how many tracks it
        could not read.
      </p>
    </div>
  );
}
