import type { Client } from "discord.js";
import { LavalinkManager, type LavalinkNode } from "lavalink-client";
import { env } from "../env.ts";
import { createLogger } from "../logger.ts";

const log = createLogger("lavalink");

export const DEFAULT_NODE_ID = "instance-default";

/**
 * Node ids carry the guild they belong to.
 *
 * Nodes here are not ours — each one is infrastructure a different server
 * handed us. Namespacing the id is what makes "pick a node for this guild" a
 * lookup rather than a search, and it is why `autoMove` stays off below: the
 * library's own failover would happily move a stalled player onto whatever
 * node is healthiest, which in this model means playing one server's music
 * through another server's machine.
 */
export function nodeIdFor(guildId: string, nodeName: string): string {
  return `g:${guildId}:${nodeName}`;
}

export function guildIdFromNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith("g:")) return null;
  const rest = nodeId.slice(2);
  const cut = rest.indexOf(":");
  return cut === -1 ? null : rest.slice(0, cut);
}

/** Nodes this guild may use: its own, plus the instance default if there is one. */
export function nodesForGuild(
  manager: LavalinkManager,
  guildId: string,
): LavalinkNode[] {
  const out: LavalinkNode[] = [];
  for (const node of manager.nodeManager.nodes.values()) {
    const id = node.options.id;
    if (!id) continue;
    if (guildIdFromNodeId(id) === guildId) out.push(node as LavalinkNode);
  }
  if (env.defaultNode) {
    const fallback = manager.nodeManager.nodes.get(DEFAULT_NODE_ID);
    if (fallback) out.push(fallback as LavalinkNode);
  }
  return out;
}

export function createLavalinkManager(client: Client): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: env.defaultNode
      ? [
          {
            id: DEFAULT_NODE_ID,
            host: env.defaultNode.host,
            port: env.defaultNode.port,
            authorization: env.defaultNode.password,
            secure: env.defaultNode.secure,
            retryAmount: 5,
            retryDelay: 3_000,
          },
        ]
      : [],
    sendToShard: (guildId, payload) => {
      client.guilds.cache.get(guildId)?.shard?.send(payload);
    },
    client: {
      id: env.discordClientId,
      username: "Tsuki",
    },
    autoSkip: true,
    // Off on purpose — see nodeIdFor above. Failover is done per guild in
    // core/nodes.ts, over that guild's own nodes only.
    autoMove: false,
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 30_000 },
      useUnresolvedData: true,
    },
    queueOptions: { maxPreviousTracks: 25 },
  });

  manager.nodeManager
    .on("connect", (node) =>
      log.info(`node connected: ${node.options.id ?? node.options.host}`),
    )
    .on("disconnect", (node, reason) =>
      log.warn(`node disconnected: ${node.options.id}`, reason),
    )
    .on("error", (node, error) =>
      log.error(`node error: ${node.options.id}`, error?.message ?? error),
    );

  return manager;
}
