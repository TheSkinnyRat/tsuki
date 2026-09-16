import type {
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { LavalinkManager } from "lavalink-client";
import type { PlayerService } from "../../core/player.ts";

export interface CommandContext {
  players: PlayerService;
  manager: LavalinkManager;
}

export interface Command {
  data:
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute(
    interaction: ChatInputCommandInteraction,
    context: CommandContext,
  ): Promise<void>;
}
