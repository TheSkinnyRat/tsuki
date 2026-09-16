import type { LavalinkManager, Player } from "lavalink-client";
import { ServiceError } from "./errors.ts";

/**
 * Lyrics come from a plugin on the guild's node, not from us.
 *
 * Which means most nodes do not have them, and the honest answer is to say so
 * by name rather than to return nothing and let it read as "this song has no
 * lyrics". The plugin is `lavalyrics-plugin`, usually alongside a source such
 * as `java-lyrics-plugin` or LavaSrc's own.
 */

const LYRICS_PLUGIN = "lavalyrics";

export interface LyricsResult {
  source: string | null;
  provider: string | null;
  /** Plain text when the plugin returns it. */
  text: string | null;
  /** Timed lines, when the provider has them. */
  lines: Array<{ timestampMs: number | null; line: string }>;
}

function hasLyricsPlugin(player: Player): boolean {
  const plugins = player.node.info?.plugins ?? [];
  return plugins.some((plugin) => plugin.name.includes(LYRICS_PLUGIN));
}

export async function currentLyrics(
  _manager: LavalinkManager,
  player: Player,
): Promise<LyricsResult> {
  if (!player.queue.current) {
    throw new ServiceError("NOTHING_PLAYING", "Nothing is playing right now.");
  }
  if (!hasLyricsPlugin(player)) {
    throw new ServiceError(
      "SOURCE_UNSUPPORTED",
      "This server's audio node has no lyrics plugin. Install `lavalyrics-plugin` on it, with a lyrics source, and Tsuki will use it.",
      { needed: "lavalyrics-plugin" },
    );
  }

  const found = await player.getCurrentLyrics().catch(() => null);
  if (!found) {
    throw new ServiceError(
      "NOT_FOUND",
      `No lyrics found for **${player.queue.current.info.title}**.`,
    );
  }

  const raw = found as {
    sourceName?: string;
    provider?: string;
    text?: string | null;
    lines?: Array<{ timestamp?: number; line?: string }>;
  };

  return {
    source: raw.sourceName ?? null,
    provider: raw.provider ?? null,
    text: raw.text ?? null,
    lines: (raw.lines ?? []).map((line) => ({
      timestampMs: typeof line.timestamp === "number" ? line.timestamp : null,
      line: line.line ?? "",
    })),
  };
}
