import { PermissionsBitField, type Client } from "discord.js";
import type { Actor } from "@tsuki/shared";
import { ServiceError } from "../core/errors.ts";

/**
 * Builds the Actor for a dashboard request.
 *
 * The dashboard sends only *who* is asking. Roles, voice channel and Manage
 * Server are read here from Discord itself — never from the request body —
 * so a forged payload cannot hand itself the DJ role.
 */
export async function actorFromWeb(
  client: Client,
  guildId: string,
  userId: string,
): Promise<Actor> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new ServiceError(
      "NOT_FOUND",
      "Tsuki is not in that server.",
    );
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    throw new ServiceError(
      "NOT_FOUND",
      "You are not a member of that server.",
    );
  }

  return {
    userId,
    guildId,
    roleIds: [...member.roles.cache.keys()],
    voiceChannelId: member.voice.channelId ?? null,
    isGuildManager: member.permissions.has(
      PermissionsBitField.Flags.ManageGuild,
    ),
    surface: "web",
  };
}
