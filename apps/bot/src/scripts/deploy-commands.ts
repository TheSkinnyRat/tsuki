import { REST, Routes } from "discord.js";
import { env } from "../env.ts";
import { commands } from "../discord/commands/index.ts";
import { createLogger } from "../logger.ts";

const log = createLogger("commands");

/**
 * Registers the slash commands. Pass a guild id to register there (instant),
 * or nothing to register globally (Discord takes up to an hour to roll out).
 */
async function main(): Promise<void> {
  const guildId = process.argv[2] ?? process.env["TEST_GUILD_ID"];
  const rest = new REST().setToken(env.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  const route = guildId
    ? Routes.applicationGuildCommands(env.discordClientId, guildId)
    : Routes.applicationCommands(env.discordClientId);

  const result = (await rest.put(route, { body })) as unknown[];
  log.info(
    `registered ${result.length} commands ${guildId ? `in guild ${guildId}` : "globally"}`,
  );
  for (const command of commands) log.debug(`  /${command.data.name}`);
}

main().catch((error) => {
  log.error("could not register commands", error);
  process.exit(1);
});
