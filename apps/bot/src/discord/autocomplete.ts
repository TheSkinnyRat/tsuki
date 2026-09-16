import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "@tsuki/db";
import { createLogger } from "../logger.ts";

const log = createLogger("autocomplete");

/** Discord accepts at most 25 suggestions. */
const LIMIT = 25;

/**
 * Names a member would otherwise have to remember exactly.
 *
 * Both lookups read the database directly rather than going through the
 * service layer: suggesting a name is not an action, it needs no actor, and
 * Discord gives roughly three seconds to answer.
 */
export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) return;
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "name") return;

  const typed = focused.value.trim().toLowerCase();
  const command = interaction.commandName;

  try {
    const names =
      command === "node"
        ? await nodeNames(interaction.guildId)
        : command === "playlist"
          ? await playlistNames(interaction.guildId)
          : [];

    const matching = names
      .filter((name) => name.toLowerCase().includes(typed))
      .slice(0, LIMIT);

    await interaction.respond(
      matching.map((name) => ({ name, value: name })),
    );
  } catch (error) {
    log.debug("could not answer an autocomplete", error);
    await interaction.respond([]).catch(() => undefined);
  }
}

async function nodeNames(guildId: string): Promise<string[]> {
  const rows = await prisma.node.findMany({
    where: { guildId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { name: true },
    take: 50,
  });
  return rows.map((row) => row.name);
}

async function playlistNames(guildId: string): Promise<string[]> {
  const rows = await prisma.playlist.findMany({
    where: { guildId },
    orderBy: { updatedAt: "desc" },
    select: { name: true },
    take: 50,
  });
  return rows.map((row) => row.name);
}
