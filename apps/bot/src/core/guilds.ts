import { prisma } from "@tsuki/db";
import type { ChannelRuleSummary, GuildSettings } from "@tsuki/shared";
import { ServiceError } from "./errors.ts";

function toSettings(row: {
  id: string;
  name: string | null;
  defaultVolume: number;
  stay247: boolean;
  autoplay: boolean;
  djMode: boolean;
  djRoleId: string | null;
}): GuildSettings {
  return {
    id: row.id,
    name: row.name,
    defaultVolume: row.defaultVolume,
    stay247: row.stay247,
    autoplay: row.autoplay,
    djMode: row.djMode,
    djRoleId: row.djRoleId,
  };
}

/** Reads a guild's settings, creating the row on first contact. */
export async function getGuildSettings(
  guildId: string,
  name?: string,
): Promise<GuildSettings> {
  const row = await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, name: name ?? null },
    update: name ? { name } : {},
  });
  return toSettings(row);
}

export interface GuildSettingsPatch {
  defaultVolume?: number;
  stay247?: boolean;
  autoplay?: boolean;
  djMode?: boolean;
  djRoleId?: string | null;
}

export async function updateGuildSettings(
  guildId: string,
  patch: GuildSettingsPatch,
): Promise<GuildSettings> {
  if (patch.defaultVolume !== undefined) {
    if (
      !Number.isInteger(patch.defaultVolume) ||
      patch.defaultVolume < 0 ||
      patch.defaultVolume > 200
    ) {
      throw new ServiceError(
        "INVALID_INPUT",
        "Volume has to be a whole number between 0 and 200.",
      );
    }
  }
  await getGuildSettings(guildId);
  const row = await prisma.guild.update({ where: { id: guildId }, data: patch });
  return toSettings(row);
}

// ------------------------------------------------------------ channel rules

export async function getChannelRule(
  guildId: string,
  channelId: string | null,
): Promise<ChannelRuleSummary | null> {
  if (!channelId) return null;
  const row = await prisma.channelRule.findUnique({
    where: { guildId_channelId: { guildId, channelId } },
  });
  if (!row) return null;
  return {
    channelId: row.channelId,
    djRequired: row.djRequired,
    canRequest: row.canRequest,
    locked: row.locked,
  };
}

export async function listChannelRules(
  guildId: string,
): Promise<ChannelRuleSummary[]> {
  const rows = await prisma.channelRule.findMany({ where: { guildId } });
  return rows.map((row) => ({
    channelId: row.channelId,
    djRequired: row.djRequired,
    canRequest: row.canRequest,
    locked: row.locked,
  }));
}

export async function setChannelRule(
  guildId: string,
  channelId: string,
  patch: Partial<Omit<ChannelRuleSummary, "channelId">>,
): Promise<ChannelRuleSummary> {
  await getGuildSettings(guildId);
  const row = await prisma.channelRule.upsert({
    where: { guildId_channelId: { guildId, channelId } },
    create: { guildId, channelId, ...patch },
    update: patch,
  });
  return {
    channelId: row.channelId,
    djRequired: row.djRequired,
    canRequest: row.canRequest,
    locked: row.locked,
  };
}

export async function clearChannelRule(
  guildId: string,
  channelId: string,
): Promise<void> {
  await prisma.channelRule
    .delete({ where: { guildId_channelId: { guildId, channelId } } })
    .catch(() => undefined);
}
