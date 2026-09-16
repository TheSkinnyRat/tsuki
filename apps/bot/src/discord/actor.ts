import {
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Actor } from "@tsuki/shared";
import { ServiceError } from "../core/errors.ts";

/**
 * Turns a Discord interaction into the same Actor the dashboard builds from a
 * web session. Everything downstream sees one shape, which is what keeps a
 * permission rule from drifting between the two surfaces.
 */
export function actorFromInteraction(
  interaction: ChatInputCommandInteraction,
): Actor {
  if (!interaction.inGuild() || !interaction.guildId) {
    throw new ServiceError(
      "INVALID_INPUT",
      "Tsuki only works inside a server.",
    );
  }
  const member = interaction.member as GuildMember | null;
  const permissions = interaction.memberPermissions;

  return {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    roleIds: member?.roles?.cache ? [...member.roles.cache.keys()] : [],
    voiceChannelId: member?.voice?.channelId ?? null,
    isGuildManager:
      permissions?.has(PermissionsBitField.Flags.ManageGuild) ?? false,
    surface: "discord",
  };
}
