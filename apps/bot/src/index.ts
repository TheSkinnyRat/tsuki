import { Events, type Client } from "discord.js";
import type { Player } from "lavalink-client";
import { env } from "./env.ts";
import { createLogger } from "./logger.ts";
import { createDiscordClient, registerInteractionHandlers } from "./discord/client.ts";
import { createLavalinkManager, type ManagerHooks } from "./lavalink/manager.ts";
import { PlayerService } from "./core/player.ts";
import { Lifecycle } from "./core/lifecycle.ts";
import { registerFailover } from "./core/failover.ts";
import { syncGuildNodes } from "./core/nodes.ts";
import { getGuildSettings } from "./core/guilds.ts";
import { startApiServer } from "./http/server.ts";

const log = createLogger("boot");

async function main(): Promise<void> {
  const client: Client = createDiscordClient();

  // The autoplay hook needs the manager that is being built, so it is filled
  // in once both exist rather than passed as a closure over undefined.
  const hooks: ManagerHooks = {};
  const manager = createLavalinkManager(client, hooks);
  const players = new PlayerService({ manager, client });
  const lifecycle = new Lifecycle({ client, manager, players });
  hooks.autoPlay = (player: Player) => lifecycle.autoPlayFunction(player);
  lifecycle.register();
  registerFailover(manager, {
    instanceNodeOffered: env.defaultNode !== null,
    announce: (player, message) => lifecycle.say(player, message),
  });

  registerInteractionHandlers(client, { players, manager });

  // Lavalink needs Discord's raw voice packets to negotiate the connection.
  client.on(Events.Raw, (packet) => {
    void manager.sendRawData(packet);
  });

  client.once(Events.ClientReady, async (ready) => {
    log.info(`signed in as ${ready.user.tag}`);
    await manager.init({ id: ready.user.id, username: ready.user.username });

    for (const [guildId, guild] of ready.guilds.cache) {
      await getGuildSettings(guildId, guild.name);
      await syncGuildNodes(manager, guildId).catch((error) =>
        log.warn(`could not sync nodes for ${guildId}`, error),
      );
    }
    log.info(`ready in ${ready.guilds.cache.size} guilds`);
  });

  const api = startApiServer({ players, manager, client });

  const shutdown = async (signal: string) => {
    log.info(`${signal} — shutting down`);
    lifecycle.dispose();
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
