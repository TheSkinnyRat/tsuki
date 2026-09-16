import type { LavalinkManager, Player } from "lavalink-client";
import { prisma } from "@tsuki/db";
import { createLogger } from "../logger.ts";
import { DEFAULT_NODE_ID, guildIdFromNodeId, nodeIdFor } from "../lavalink/manager.ts";

const log = createLogger("failover");

export interface NodeView {
  id: string;
  connected: boolean;
}

/**
 * The node a guild's player should move to when the one it is on goes down.
 *
 * Only that guild's own nodes are candidates, highest priority first, then the
 * instance's node if the operator offers one. Another guild's node is never a
 * candidate however healthy it is: in this model a node is somebody's machine,
 * and failing over onto it would play one server's music through another
 * server's hardware. That rule is the reason the library's own `autoMove` is
 * off, so it lives here where a test can hold it.
 */
export function chooseFailoverNode(
  guildId: string,
  failingId: string,
  nodes: NodeView[],
  priorityByName: Map<string, number>,
  instanceNodeOffered: boolean,
): string | null {
  const own = nodes
    .filter((node) => node.connected && node.id !== failingId)
    .filter((node) => guildIdFromNodeId(node.id) === guildId)
    .sort((a, b) => {
      const pa = priorityByName.get(a.id.split(":").slice(2).join(":")) ?? 0;
      const pb = priorityByName.get(b.id.split(":").slice(2).join(":")) ?? 0;
      return pb - pa;
    });
  if (own[0]) return own[0].id;

  if (instanceNodeOffered && failingId !== DEFAULT_NODE_ID) {
    const fallback = nodes.find(
      (node) => node.id === DEFAULT_NODE_ID && node.connected,
    );
    if (fallback) return fallback.id;
  }
  return null;
}

export function registerFailover(
  manager: LavalinkManager,
  options: {
    instanceNodeOffered: boolean;
    announce: (player: Player, message: string) => Promise<void>;
  },
): void {
  manager.nodeManager.on("disconnect", (node) => {
    const failingId = node.options.id;
    if (!failingId) return;
    void moveAway(manager, failingId, options);
  });
}

async function moveAway(
  manager: LavalinkManager,
  failingId: string,
  options: {
    instanceNodeOffered: boolean;
    announce: (player: Player, message: string) => Promise<void>;
  },
): Promise<void> {
  const stranded = [...manager.players.values()].filter(
    (player) => player.node.options.id === failingId,
  );
  if (stranded.length === 0) return;

  const views: NodeView[] = [...manager.nodeManager.nodes.values()].map(
    (candidate) => ({
      id: candidate.options.id ?? "",
      connected: candidate.connected,
    }),
  );

  for (const player of stranded) {
    const rows = await prisma.node
      .findMany({
        where: { guildId: player.guildId, enabled: true },
        select: { name: true, priority: true },
      })
      .catch(() => []);
    const priorities = new Map(
      rows.map((row) => [row.name, row.priority] as const),
    );

    const target = chooseFailoverNode(
      player.guildId,
      failingId,
      views,
      priorities,
      options.instanceNodeOffered,
    );
    if (!target) {
      log.warn(`no other node for ${player.guildId}; waiting for ${failingId}`);
      await options.announce(
        player,
        "The audio node dropped and this server has no other node to switch to. Tsuki will keep trying to reconnect.",
      );
      continue;
    }
    try {
      await player.changeNode(target);
      log.info(`moved ${player.guildId} from ${failingId} to ${target}`);
      const label = target === DEFAULT_NODE_ID ? "the instance's node" : `**${target.split(":").slice(2).join(":")}**`;
      await options.announce(
        player,
        `The audio node dropped — switched to ${label} and carried on.`,
      );
    } catch (error) {
      log.error(`could not move ${player.guildId} to ${target}`, error);
    }
  }
}

export { nodeIdFor };
