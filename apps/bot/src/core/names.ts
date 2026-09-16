import type { Client } from "discord.js";

/**
 * Display names for the members who asked for tracks.
 *
 * Tsuki does not hold the Guild Members privileged intent, so the member cache
 * is whatever has happened to walk past — and the dashboard polls the player
 * every couple of seconds, which rules out fetching per snapshot. Names are
 * therefore resolved once, in the background, and kept: a snapshot returns
 * whatever is known now rather than waiting, and the next poll has it.
 */

const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 2_000;

interface Entry {
  name: string;
  at: number;
}

export class DisplayNames {
  private readonly client: Client;
  private readonly cache = new Map<string, Entry>();
  private readonly inFlight = new Set<string>();

  constructor(client: Client) {
    this.client = client;
  }

  /** What is known right now, without waiting on Discord. */
  peek(guildId: string, userId: string | null): string | null {
    if (!userId) return null;
    const key = `${guildId}:${userId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.name;

    const cached =
      this.client.guilds.cache.get(guildId)?.members.cache.get(userId)
        ?.displayName ?? this.client.users.cache.get(userId)?.username;
    if (cached) {
      this.remember(key, cached);
      return cached;
    }

    void this.resolve(guildId, userId, key);
    return null;
  }

  private async resolve(
    guildId: string,
    userId: string,
    key: string,
  ): Promise<void> {
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    try {
      const guild = this.client.guilds.cache.get(guildId);
      const member = await guild?.members.fetch(userId).catch(() => null);
      if (member) {
        this.remember(key, member.displayName);
        return;
      }
      const user = await this.client.users.fetch(userId).catch(() => null);
      if (user) this.remember(key, user.username);
    } finally {
      this.inFlight.delete(key);
    }
  }

  private remember(key: string, name: string): void {
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { name, at: Date.now() });
  }
}
