import { bot } from "./bot.ts";
import { sharedGuilds, type SharedGuild, type UserGuild } from "./guilds.ts";

/**
 * The servers a signed-in member shares with Tsuki, for the picker and the
 * dashboard rail. See guilds.ts for why this asks Discord once per member
 * rather than once per server.
 *
 * Discord rate-limits /users/@me/guilds tightly, and one page view asks for
 * it from both the picker and the dashboard; a short cache keeps that at one
 * call. Without an access token (development login, or a token Discord no
 * longer accepts) it falls back to the bot's slow per-server lookup, which is
 * correct, only slow.
 */

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; guilds: UserGuild[] }>();

async function userGuilds(
  userId: string,
  accessToken: string,
): Promise<UserGuild[] | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.guilds;

  const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return hit?.guilds ?? null;

  const guilds = (await response.json()) as UserGuild[];
  cache.set(userId, { at: Date.now(), guilds });
  return guilds;
}

export async function guildsForSession(session: {
  user?: { id?: string } | null;
  discordAccessToken?: string;
} | null): Promise<SharedGuild[]> {
  const userId = session?.user?.id;
  if (!userId) return [];

  const token = session?.discordAccessToken;
  const mine = token ? await userGuilds(userId, token) : null;
  if (mine) {
    const botGuilds = await bot.botGuilds().catch(() => null);
    if (botGuilds) return sharedGuilds(mine, botGuilds);
  }
  return bot.guildsFor(userId).catch(() => []);
}
