"use client";

import type {
  GuildSettings,
  NodeSummary,
  PlayerSnapshot,
} from "@tsuki/shared";

export interface ApiFailure {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: string;
  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = "ApiError";
    this.code = failure.code;
  }
}

async function request<T>(
  guildId: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api/guilds/${guildId}/${path}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: ApiFailure }).error ?? {
        code: "INTERNAL",
        message: "Something went wrong.",
      },
    );
  }
  return payload as T;
}

export const api = {
  player: (guildId: string) => request<PlayerSnapshot>(guildId, "player"),
  settings: (guildId: string) =>
    request<{ settings: GuildSettings }>(guildId, "settings"),
  nodes: (guildId: string) => request<NodeSummary[]>(guildId, "nodes"),
  filters: (guildId: string) =>
    request<{
      effects: Record<string, boolean | undefined>;
      speed: number;
      pitch: number;
      audioOutput: string;
      equalizerApplied: boolean;
      availableOnNode: string[];
    }>(guildId, "filters"),
  playlists: (guildId: string) =>
    request<
      Array<{
        name: string;
        trackCount: number;
        totalLengthMs: number;
        createdBy: string;
      }>
    >(guildId, "playlists"),

  post: <T = unknown>(guildId: string, path: string, body: unknown = {}) =>
    request<T>(guildId, path, { method: "POST", body }),
  patch: <T = unknown>(guildId: string, path: string, body: unknown) =>
    request<T>(guildId, path, { method: "PATCH", body }),
  del: <T = unknown>(guildId: string, path: string) =>
    request<T>(guildId, path, { method: "DELETE" }),
};

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}
