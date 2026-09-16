import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type Interaction,
} from "discord.js";
import { isServiceError } from "../core/errors.ts";
import { createLogger } from "../logger.ts";
import {
  commandsByName,
  handleModal,
  handleQueuePage,
  handleSearchSelect,
  type CommandContext,
} from "./commands/index.ts";
import { errorEmbed } from "./embeds.ts";
import { handleAutocomplete } from "./autocomplete.ts";

const log = createLogger("discord");

export function createDiscordClient(): Client {
  return new Client({
    // Message Content is a privileged intent and Tsuki has no use for it:
    // everything arrives as a slash command or from the dashboard.
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
}

async function reportFailure(
  interaction: Extract<Interaction, { replied: boolean }>,
  error: unknown,
): Promise<void> {
  const message = isServiceError(error)
    ? error.message
    : "Something went wrong on Tsuki's side. Try again in a moment.";

  if (!isServiceError(error)) log.error("unhandled interaction error", error);

  const payload = {
    embeds: [errorEmbed(message)],
    flags: MessageFlags.Ephemeral as const,
  };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (sendError) {
    log.error("could not deliver the error to Discord", sendError);
  }
}

export function registerInteractionHandlers(
  client: Client,
  context: CommandContext,
): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandsByName.get(interaction.commandName);
        if (!command) {
          log.warn(`no handler for /${interaction.commandName}`);
          return;
        }
        await command.execute(interaction, context);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModal(interaction, context);
        return;
      }

      if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
        return;
      }

      if (interaction.isButton()) {
        await handleQueuePage(interaction, context);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        await handleSearchSelect(interaction, context);
        return;
      }
    } catch (error) {
      if (
        interaction.isChatInputCommand() ||
        interaction.isModalSubmit() ||
        interaction.isStringSelectMenu() ||
        interaction.isButton()
      ) {
        await reportFailure(interaction, error);
      }
    }
  });
}
