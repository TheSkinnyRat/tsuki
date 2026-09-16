import { prisma } from "@tsuki/db";
import type { LavalinkManager, Player, Track } from "lavalink-client";
import { createLogger } from "../logger.ts";

const log = createLogger("autoplay");

/** How far back autoplay looks, and how many candidates it weighs. */
const HISTORY_WINDOW = 200;
const AVOID_LAST = 15;

/**
 * Picks the next track from what this guild has actually listened to.
 *
 * Deliberately not a recommendation engine: a server's own history is the
 * thing it already agreed to hear, and it needs no source the node may lack.
 * Recently played tracks are held back so a small history does not turn into
 * a two-song loop.
 */
export async function pickAutoplayTrack(
  manager: LavalinkManager,
  player: Player,
): Promise<Track | null> {
  const rows = await prisma.playHistory.findMany({
    where: { guildId: player.guildId },
    orderBy: { playedAt: "desc" },
    take: HISTORY_WINDOW,
    select: { encoded: true, title: true, playedAt: true },
  });
  if (rows.length === 0) return null;

  const recent = new Set(rows.slice(0, AVOID_LAST).map((row) => row.encoded));
  const pool = rows.filter((row) => !recent.has(row.encoded));
  const candidates = pool.length > 0 ? pool : rows;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  if (!chosen) return null;

  try {
    // Decoding through the node rather than replaying the blob: an encoded
    // track from a node that has since been removed is not playable here, and
    // this is where that shows up as a clean null instead of a load error.
    const decoded = await player.node.decode.singleTrack(chosen.encoded, {
      id: null,
    });
    return decoded as Track;
  } catch (error) {
    log.warn(`could not decode a history track for ${player.guildId}`, error);
    return null;
  }
}
