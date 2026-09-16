"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GuildSettings, NodeSummary, PlayerSnapshot } from "@tsuki/shared";
import { api, ApiError } from "@/lib/api.ts";
import { NowPlaying } from "./NowPlaying.tsx";
import { QueuePanel } from "./QueuePanel.tsx";
import { NodesPanel } from "./NodesPanel.tsx";
import { SettingsPanel } from "./SettingsPanel.tsx";
import { PlayerBar } from "./PlayerBar.tsx";
import { EffectsPanel } from "./EffectsPanel.tsx";
import { PlaylistsPanel } from "./PlaylistsPanel.tsx";

/**
 * Polls rather than streams, on purpose for now.
 *
 * The bot holds the authoritative player state in its own process; a socket
 * would need a second path out of it and buys nothing until the dashboard has
 * more than one viewer per guild. The interval is short enough that a skip
 * from Discord shows up before anyone reaches for refresh, and `positionMs` is
 * advanced locally between polls so the scrubber does not tick in steps.
 */
const POLL_MS = 2000;

/**
 * `minmax(0, …)` rather than `1fr`: a grid item defaults to `min-width: auto`,
 * so a long track title widens the whole column and the page scrolls sideways
 * on a phone. Measured at 390px — the document was 567px wide before this.
 */
const NOW_GRID = "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]";

type Tab = "now" | "playlists" | "effects" | "nodes" | "settings";

export function DashboardClient({
  guildId,
  guildName,
}: {
  guildId: string;
  guildName: string;
}) {
  const [player, setPlayer] = useState<PlayerSnapshot | null>(null);
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [tab, setTab] = useState<Tab>("now");
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const drift = useRef<{ at: number; position: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [next, config, nodeList] = await Promise.all([
        api.player(guildId),
        api.settings(guildId),
        api.nodes(guildId),
      ]);
      setPlayer(next);
      setSettings(config.settings);
      setNodes(nodeList);
      setFailed(false);
      drift.current = { at: Date.now(), position: next.positionMs };
    } catch {
      setFailed(true);
    }
  }, [guildId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Between polls the scrubber moves on its own so it reads as a clock, not a
  // sampler. Every poll resets it to the truth.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 500);
    return () => clearInterval(timer);
  }, []);

  const shownPosition = (() => {
    if (!player) return 0;
    if (!player.playing || player.paused) return player.positionMs;
    const base = drift.current;
    if (!base) return player.positionMs;
    void tick;
    return base.position + (Date.now() - base.at);
  })();

  const act = useCallback(
    async (run: () => Promise<unknown>, success?: string) => {
      try {
        await run();
        if (success) setNotice(success);
        await refresh();
      } catch (error) {
        setNotice(
          error instanceof ApiError ? error.message : "Something went wrong.",
        );
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="font-medium text-[var(--color-accent)]">tsuki</span>
          <span className="text-[var(--color-line)]">|</span>
          <span className="text-sm font-medium">{guildName}</span>
          <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
            {failed
              ? "cannot reach the bot"
              : player?.connected
                ? "in voice"
                : "idle"}
          </span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {(
            [
              ["now", "Now playing"],
              ["playlists", "Playlists"],
              ["effects", "Effects"],
              ["nodes", "Audio nodes"],
              ["settings", "Settings"],
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                tab === value
                  ? "bg-[var(--color-surface)] font-medium text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {notice ? (
        <div className="mx-auto mt-3 max-w-6xl px-4">
          <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm">
            {notice}
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-5">
        {tab === "now" ? (
          <div className={NOW_GRID}>
            <NowPlaying
              player={player}
              positionMs={shownPosition}
              nodes={nodes}
            />
            <QueuePanel
              guildId={guildId}
              player={player}
              onAct={act}
              nodes={nodes}
            />
          </div>
        ) : null}

        {tab === "playlists" ? (
          <PlaylistsPanel guildId={guildId} onAct={act} />
        ) : null}

        {tab === "effects" ? (
          <EffectsPanel guildId={guildId} player={player} onAct={act} />
        ) : null}

        {tab === "nodes" ? (
          <NodesPanel guildId={guildId} nodes={nodes} onAct={act} />
        ) : null}

        {tab === "settings" ? (
          <SettingsPanel guildId={guildId} settings={settings} onAct={act} />
        ) : null}
      </main>

      <PlayerBar
        guildId={guildId}
        player={player}
        positionMs={shownPosition}
        onAct={act}
      />
    </div>
  );
}
