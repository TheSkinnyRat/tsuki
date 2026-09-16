import type {
  GuildSettings,
  NodeSummary,
  PlayerSnapshot,
  ServiceErrorShape,
} from "@tsuki/shared";
import { serverEnv } from "./env.ts";

/**
 * The dashboard's only way to reach the bot.
 *
 * It sends who is asking and nothing else about them: roles, voice state and
 * Manage Server are read on the bot's side from Discord itself. Anything this
 * file could claim about a member would be a claim the browser could forge.
 */

export class BotError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(shape: ServiceErrorShape, status: number) {
    super(shape.message);
    this.name = "BotError";
    this.code = shape.code;
    this.status = status;
    this.details = shape.details;
  }
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${serverEnv.botApiUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${serverEnv.botApiToken}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const shape = (payload as { error?: ServiceErrorShape }).error ?? {
      code: "INTERNAL",
      message: "The bot did not answer.",
    };
    throw new BotError(shape, response.status);
  }
  return payload as T;
}

export const bot = {
  health: () => call<{ ok: boolean }>("/health"),

  guildsFor: (userId: string) =>
    call<
      Array<{ id: string; name: string; icon: string | null; canManage: boolean }>
    >(`/api/members/${userId}/guilds`),

  player: (guildId: string) =>
    call<PlayerSnapshot>(`/api/guilds/${guildId}/player`),

  settings: (guildId: string) =>
    call<{ settings: GuildSettings; channelRules: unknown[] }>(
      `/api/guilds/${guildId}/settings`,
    ),

  nodes: (guildId: string) =>
    call<NodeSummary[]>(`/api/guilds/${guildId}/nodes`),

  filters: (guildId: string) =>
    call<Record<string, unknown>>(`/api/guilds/${guildId}/filters`),

  lyrics: (guildId: string) =>
    call<Record<string, unknown>>(`/api/guilds/${guildId}/lyrics`),

  playlists: (guildId: string) =>
    call<Array<{ name: string; trackCount: number; totalLengthMs: number; createdBy: string }>>(
      `/api/guilds/${guildId}/playlists`,
    ),

  action: <T>(guildId: string, action: string, body: Record<string, unknown>) =>
    call<T>(`/api/guilds/${guildId}/${action}`, { method: "POST", body }),

  patch: <T>(guildId: string, path: string, body: Record<string, unknown>) =>
    call<T>(`/api/guilds/${guildId}/${path}`, { method: "PATCH", body }),

  remove: <T>(guildId: string, path: string, body: Record<string, unknown>) =>
    call<T>(`/api/guilds/${guildId}/${path}`, { method: "DELETE", body }),
};
