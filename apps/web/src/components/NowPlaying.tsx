"use client";

import { useState } from "react";
import type { GuildSettings, NodeSummary, PlayerSnapshot } from "@tsuki/shared";
import { api, ApiError } from "@/lib/api.ts";
import {
  Artwork,
  Chip,
  Panel,
  PanelHeader,
  Row,
  RowText,
  Switch,
} from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

export function NowPlaying({
  guildId,
  player,
  settings,
  nodes,
  onAct,
}: {
  guildId: string;
  player: PlayerSnapshot | null;
  settings: GuildSettings | null;
  nodes: NodeSummary[];
  onAct: Act;
}) {
  const current = player?.current ?? null;
  const connected = nodes.filter((node) => node.connected);

  const status = !current
    ? "Idle"
    : player?.paused
      ? "Paused"
      : "Now playing";

  const idleText =
    nodes.length === 0
      ? "This server has no audio node yet. Add one under Audio nodes — Tsuki plays through a Lavalink node you provide."
      : connected.length === 0
        ? "None of this server's nodes are reachable right now."
        : "Nothing is playing. Paste a link or a search into the queue to start.";

  const patch = (body: Record<string, unknown>, success: string) =>
    onAct(() => api.patch(guildId, "settings", body), success);

  return (
    <div>
      <div className="mb-[34px] flex flex-wrap items-end gap-[26px]">
        <Artwork
          src={current?.artworkUrl}
          size={190}
          radius={12}
          label={current ? undefined : "album art"}
        />
        <div className="min-w-[240px] flex-1">
          <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.08em] text-[var(--color-halo)] uppercase">
            {status}
          </div>
          <h1 className="mb-2 text-[clamp(26px,3vw,34px)] leading-[1.1] font-medium tracking-[-0.03em] text-balance">
            {current?.title ?? "Nothing queued"}
          </h1>
          <p className="mb-[18px] text-[15px] text-[var(--color-muted)]">
            {current ? current.author : idleText}
          </p>
          {current ? (
            <div className="flex flex-wrap gap-2">
              <Chip>
                {current.requestedBy
                  ? `requested by ${current.requestedByName ?? "a member"}`
                  : "autoplay"}
              </Chip>
              {current.sourceName ? <Chip>{current.sourceName}</Chip> : null}
              {player?.nodeName ? <Chip>via {player.nodeName}</Chip> : null}
              {player && player.activeFilters.length > 0 ? (
                <Chip>{player.activeFilters.join(" · ")}</Chip>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Channel rules"
          meta={
            player?.voiceChannelName ? `#${player.voiceChannelName}` : undefined
          }
        />
        <Row>
          <RowText
            title="Stay in voice 24/7"
            detail="Keeps the queue alive when the room empties"
          />
          <Switch
            label="Stay in voice 24/7"
            on={settings?.stay247 ?? false}
            disabled={!settings}
            onChange={(next) =>
              patch(
                { stay247: next },
                next ? "Tsuki will hold the channel." : "Tsuki will leave when the room empties.",
              )
            }
          />
        </Row>
        <Row>
          <RowText
            title="Autoplay when queue ends"
            detail="Continues from this server's listening history"
          />
          <Switch
            label="Autoplay when queue ends"
            on={settings?.autoplay ?? false}
            disabled={!settings}
            onChange={(next) =>
              patch({ autoplay: next }, next ? "Autoplay on." : "Autoplay off.")
            }
          />
        </Row>
        <Row last>
          <RowText
            title="DJ role required to control playback"
            detail={
              settings?.djRoleId
                ? "Others can still skip the tracks they asked for"
                : "No DJ role set yet — pick one under Settings"
            }
          />
          <Switch
            label="DJ role required"
            on={settings?.djMode ?? false}
            disabled={!settings}
            onChange={(next) =>
              patch({ djMode: next }, next ? "DJ mode on." : "DJ mode off.")
            }
          />
        </Row>
      </Panel>

      {current ? (
        <Lyrics guildId={guildId} key={current.identifier} />
      ) : null}
    </div>
  );
}

/**
 * Fetched on demand rather than with every poll: lyrics come from a plugin on
 * the guild's node, most nodes do not have one, and asking twice a second for
 * something that is usually a refusal is rude to somebody else's machine.
 */
function Lyrics({ guildId }: { guildId: string }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; text: string; source: string | null }
  >({ status: "idle" });

  return (
    <Panel className="mt-4">
      <div className="flex items-center justify-between gap-3 px-4 py-[13px]">
        <span className="text-[13px] font-medium">Lyrics</span>
        {state.status === "done" ? (
          state.source ? (
            <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-muted)]">
              via {state.source}
            </span>
          ) : null
        ) : (
          <button
            type="button"
            disabled={state.status === "loading"}
            onClick={async () => {
              setState({ status: "loading" });
              try {
                const found = await api.lyrics(guildId);
                const text =
                  found.text ?? found.lines.map((line) => line.line).join("\n");
                setState({
                  status: "done",
                  text: text || "(empty)",
                  source: found.provider,
                });
              } catch (error) {
                setState({
                  status: "done",
                  text:
                    error instanceof ApiError
                      ? error.message
                      : "Could not fetch lyrics.",
                  source: null,
                });
              }
            }}
            className="h-7 cursor-pointer rounded-[7px] border border-[var(--color-line)] bg-transparent px-3 text-[12.5px] transition-colors duration-150 hover:border-[var(--color-halo)] disabled:opacity-40"
          >
            {state.status === "loading" ? "Looking…" : "Show"}
          </button>
        )}
      </div>
      {state.status === "done" ? (
        <pre className="max-h-72 overflow-auto border-t border-[var(--color-line)] px-4 py-3 font-[family-name:var(--font-sans)] text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--color-muted)]">
          {state.text}
        </pre>
      ) : null}
    </Panel>
  );
}
