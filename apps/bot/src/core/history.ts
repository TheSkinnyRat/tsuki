import { prisma } from "@tsuki/db";
import { createLogger } from "../logger.ts";

const log = createLogger("history");

/**
 * Removes a track from a guild's listening history.
 *
 * Called when the node reports it could not play one. A track this guild's
 * node cannot play is not a track this guild has listened to, and leaving it
 * in place means autoplay keeps choosing it and the room goes quiet — which is
 * exactly what happened with a YouTube entry on a node whose address YouTube
 * refuses.
 *
 * Scoped to the guild on purpose: the same track may play perfectly well on
 * another server's node, and one server's bad luck is not another's.
 */
export async function forgetUnplayable(
  guildId: string,
  encoded: string | null | undefined,
): Promise<number> {
  if (!encoded) return 0;
  const result = await prisma.playHistory
    .deleteMany({ where: { guildId, encoded } })
    .catch((error: unknown) => {
      log.warn("could not prune the history", error);
      return null;
    });
  return result?.count ?? 0;
}
