import { Events, type Client } from "discord.js";
import type { Track } from "lavalink-client";
import { env } from "./env.ts";
import { createLogger } from "./logger.ts";
import { createDiscordClient, registerInteractionHandlers } from "./discord/client.ts";
import { createLavalinkManager } from "./lavalink/manager.ts";
import { PlayerService } from "./core/player.ts";
import { syncGuildNodes } from "./core/nodes.ts";
import { getGuildSettings } from "./core/guilds.ts";
import { startApiServer } from "./http/server.ts";

const log = createLogger("boot");

async function main(): Promise<void> {
  const client: Client = createDiscordClient();
  const manager = createLavalinkManager(client);
  const players = new PlayerService({ manager, client });

  registerInteractionHandlers(client, { players, manager });

  // Lavalink needs Discord's raw voice packets to negotiate the connection.
  client.on(Events.Raw, (packet) => {
    void manager.sendRawData(packet);
  });

  client.once(Events.ClientReady, async (ready) => {
    log.info(`signed in as ${ready.user.tag}`);
    await manager.init({ id: ready.user.id, username: ready.user.username });

    for (const guildId of ready.guilds.cache.keys()) {
      await getGuildSettings(
        guildId,
        ready.guilds.cache.get(guildId)?.name ?? undefined,
      );
      await syncGuildNodes(manager, guildId).catch((error) =>
        log.warn(`could not sync nodes for ${guildId}`, error),
      );
    }
    log.info(`ready in ${ready.guilds.cache.size} guilds`);
  });

  manager.on("trackStart", (player, track) => {
    if (!track) return;
    void players.recordPlayed(player.guildId, track as Track);
  });

  manager.on("playerDestroy", (player) => {
    log.debug(`player destroyed in ${player.guildId}`);
  });

  const api = startApiServer({ players, manager, client });

  const shutdown = async (signal: string) => {
    log.info(`${signal} — shutting down`);
    api.close();
    await manager.nodeManager.disconnectAll(true, true).catch(() => undefined);
    await client.destroy();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await client.login(env.discordToken);
}

main().catch((error) => {
  log.error("failed to start", error);
  process.exit(1);
});
