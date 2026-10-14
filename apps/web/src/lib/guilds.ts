/**
 * Which servers the picker shows, decided without asking Discord about each
 * one: the member's own guild list (one OAuth call) intersected with the
 * servers Tsuki is in (the bot's cache). The old route checked membership in
 * every server the bot is in, one REST call each — 15–18 s at 61 servers.
 *
 * Display only. Every action is still authorised by the bot from Discord's
 * own answer about the member, so a stale list here grants nothing.
 */

export interface UserGuild {
  id: string;
  owner?: boolean;
  /** Discord's permission bitfield for this member, as a decimal string. */
  permissions?: string;
}

export interface BotGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface SharedGuild extends BotGuild {
  canManage: boolean;
}

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

export function canManageFrom(guild: UserGuild): boolean {
  if (guild.owner) return true;
  let bits: bigint;
  try {
    bits = BigInt(guild.permissions ?? "0");
  } catch {
    return false;
  }
  return (bits & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
}

/** Servers in both lists, in the bot's order, with the bot's name and icon. */
export function sharedGuilds(
  userGuilds: UserGuild[],
  botGuilds: BotGuild[],
): SharedGuild[] {
  const mine = new Map(userGuilds.map((guild) => [guild.id, guild]));
  const out: SharedGuild[] = [];
  for (const guild of botGuilds) {
    const membership = mine.get(guild.id);
    if (!membership) continue;
    out.push({ ...guild, canManage: canManageFrom(membership) });
  }
  return out;
}
