"use client";

import Link from "next/link";
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
import { MoonMark } from "./ui.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

/**
 * Polls rather than streams, on purpose for now.
 *
 * The bot holds the authoritative player state in its own process; a socket
 * would need a second path out of it and buys nothing until the dashboard has
 * more than one viewer per guild. `positionMs` is advanced locally between
 * polls so the scrubber reads as a clock, not a sampler.
 */
const POLL_MS = 2000;

type Tab = "now" | "playlists" | "effects" | "nodes" | "settings";

const TABS: Array<[Tab, string]> = [
  ["now", "Now playing"],
  ["playlists", "Playlists"],
  ["effects", "Effects"],
  ["nodes", "Audio nodes"],
  ["settings", "Settings"],
];

export interface RailGuild {
  id: string;
  name: string;
  icon: string | null;
}

export function DashboardClient({
  guildId,
  guildName,
  guildIcon,
  guilds,
  userImage,
}: {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  guilds: RailGuild[];
  userImage: string | null;
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
    const length = player.current?.lengthMs ?? Number.POSITIVE_INFINITY;
    return Math.min(base.position + (Date.now() - base.at), length);
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

  const channelChip = failed
    ? "cannot reach the bot"
    : player?.connected && player.voiceChannelName
      ? `#${player.voiceChannelName} · ${player.listenerCount} listening`
      : "idle";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[15px] leading-normal text-[var(--color-ink)]">
      <header className="flex h-[54px] flex-none items-center gap-[18px] border-b border-[var(--color-line)] px-[18px]">
        <Link href="/dashboard" className="flex flex-none items-center gap-[9px]">
          <MoonMark />
          <span className="text-sm font-medium tracking-[-0.01em]">tsuki</span>
        </Link>
        <span className="h-5 w-px flex-none bg-[var(--color-line)]" />
        <div className="flex min-w-0 items-center gap-[9px]">
          {guildIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=40`}
              alt=""
              className="size-5 flex-none rounded-md border border-[var(--color-line)]"
            />
          ) : (
            <span className="size-5 flex-none rounded-md border border-[var(--color-line)] bg-[var(--color-soft)]" />
          )}
          <span className="truncate text-[13.5px] font-medium">{guildName}</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden h-[30px] items-center gap-2 rounded-lg border border-[var(--color-line)] px-[11px] text-[12.5px] text-[var(--color-muted)] sm:flex">
            <span
              className={`size-[5px] rounded-full ${
                failed ? "bg-amber-500" : "bg-[var(--color-halo)]"
              }`}
            />
            <span className="whitespace-nowrap">{channelChip}</span>
          </div>
          <ThemeToggle />
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt=""
              className="size-7 rounded-full border border-[var(--color-line)]"
            />
          ) : (
            <span className="hatch-sm size-7 rounded-full border border-[var(--color-line)]" />
          )}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[60px_minmax(0,1fr)] items-stretch">
        <nav className="flex flex-col items-center gap-2 border-r border-[var(--color-line)] py-3.5">
          {guilds.map((guild) => {
            const selected = guild.id === guildId;
            return (
              <Link
                key={guild.id}
                href={`/dashboard/${guild.id}`}
                title={guild.name}
                className={`grid size-[34px] place-items-center border text-[13px] transition-[border-radius] duration-200 ${
                  selected
                    ? "rounded-[11px] border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                    : "rounded-full border-[var(--color-line)] bg-transparent text-[var(--color-muted)]"
                }`}
              >
                {guild.name.slice(0, 1).toUpperCase()}
              </Link>
            );
          })}
          <span className="my-1.5 h-px w-[22px] bg-[var(--color-line)]" />
          <Link
            href="/dashboard"
            title="All servers"
            className="grid size-[34px] place-items-center rounded-[10px] border border-dashed border-[var(--color-line)] text-[15px] leading-none text-[var(--color-muted)] hover:border-[var(--color-halo)] hover:text-[var(--color-ink)]"
          >
            +
          </Link>
        </nav>

        {/* auto-fit with a 330px floor: two columns on a desktop, stacked on a
            phone, without a breakpoint the design does not have. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(330px,100%),1fr))] items-stretch">
          <main className="min-w-0 border-r border-[var(--color-line)] px-[30px] pt-[30px] pb-10 max-sm:px-4">
            <div className="mb-[30px] flex gap-1.5 overflow-x-auto">
              {TABS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`h-[30px] flex-none cursor-pointer rounded-lg border px-3.5 text-[13px] ${
                    tab === value
                      ? "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
                      : "border-transparent bg-transparent text-[var(--color-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {notice ? (
              <p className="mb-5 rounded-[9px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[13px]">
                {notice}
              </p>
            ) : null}

            {tab === "now" ? (
              <NowPlaying
                guildId={guildId}
                player={player}
                settings={settings}
                nodes={nodes}
                onAct={act}
              />
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
              <SettingsPanel
                guildId={guildId}
                settings={settings}
                player={player}
                nodes={nodes}
                onAct={act}
              />
            ) : null}
          </main>

          <QueuePanel
            guildId={guildId}
            player={player}
            nodes={nodes}
            onAct={act}
          />
        </div>
      </div>

      <PlayerBar
        guildId={guildId}
        player={player}
        positionMs={shownPosition}
        onAct={act}
      />
    </div>
  );
}
