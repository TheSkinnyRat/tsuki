/**
 * Every capability Tsuki has, and where each one is reachable from.
 *
 * Parity between the slash commands and the dashboard is a promise, and a
 * promise kept by remembering is a promise that breaks. `capabilities.test.ts`
 * reads the real Hono route table and the real command definitions and fails
 * when either surface grows something this list does not have — so adding an
 * action to one side and not the other cannot pass quietly.
 *
 * `web: null` marks the handful of things that genuinely belong to one side:
 * Discord's own picker components, and reads the dashboard does through a
 * different door.
 */

export interface Capability {
  id: string;
  /** Slash command, or `command sub` for a subcommand. */
  discord: string | null;
  /** Path under /api/guilds/:guildId, as the route table spells it. */
  web: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
  } | null;
  why?: string;
}

export const CAPABILITIES: Capability[] = [
  // playback
  { id: "queue-a-track", discord: "play", web: { method: "POST", path: "/play" } },
  { id: "search-and-pick", discord: "search", web: { method: "POST", path: "/search" } },
  { id: "skip", discord: "skip", web: { method: "POST", path: "/skip" } },
  { id: "previous", discord: "previous", web: { method: "POST", path: "/previous" } },
  { id: "pause", discord: "pause", web: { method: "POST", path: "/pause" } },
  { id: "resume", discord: "resume", web: { method: "POST", path: "/resume" } },
  { id: "stop", discord: "stop", web: { method: "POST", path: "/stop" } },
  { id: "seek", discord: "seek", web: { method: "POST", path: "/seek" } },
  { id: "volume", discord: "volume", web: { method: "POST", path: "/volume" } },
  { id: "repeat-mode", discord: "loop", web: { method: "POST", path: "/repeat" } },
  { id: "shuffle", discord: "shuffle", web: { method: "POST", path: "/shuffle" } },
  { id: "clear-queue", discord: "clear", web: { method: "POST", path: "/clear" } },
  {
    id: "remove-from-queue",
    discord: "remove",
    web: { method: "POST", path: "/queue/remove" },
  },
  {
    id: "move-in-queue",
    discord: "move",
    web: { method: "POST", path: "/queue/move" },
  },
  {
    id: "read-player",
    discord: "nowplaying",
    web: { method: "GET", path: "/player" },
  },
  {
    id: "read-queue",
    discord: "queue",
    web: { method: "GET", path: "/player" },
    why: "the dashboard reads the queue from the same snapshot",
  },
  {
    id: "join-voice",
    discord: "join",
    web: null,
    why: "the dashboard has no channel to join from; queueing brings Tsuki in",
  },
  {
    id: "leave-voice",
    discord: "leave",
    web: { method: "POST", path: "/stop" },
  },

  {
    id: "read-lyrics",
    discord: "lyrics",
    web: { method: "GET", path: "/lyrics" },
  },

  // effects
  {
    id: "toggle-effect",
    discord: "filter toggle",
    web: { method: "POST", path: "/filters/toggle" },
  },
  {
    id: "equaliser-preset",
    discord: "filter eq",
    web: { method: "POST", path: "/filters/eq" },
  },
  {
    id: "speed",
    discord: "filter speed",
    web: { method: "POST", path: "/filters/timescale" },
  },
  {
    id: "pitch",
    discord: "filter pitch",
    web: { method: "POST", path: "/filters/timescale" },
  },
  {
    id: "read-effects",
    discord: "filter show",
    web: { method: "GET", path: "/filters" },
  },
  {
    id: "clear-effects",
    discord: "filter reset",
    web: { method: "POST", path: "/filters/reset" },
  },

  {
    id: "read-sponsorblock",
    discord: "sponsorblock show",
    web: { method: "GET", path: "/sponsorblock" },
  },
  {
    id: "set-sponsorblock",
    discord: "sponsorblock set",
    web: { method: "PUT", path: "/sponsorblock" },
  },
  {
    id: "clear-sponsorblock",
    discord: "sponsorblock off",
    web: { method: "DELETE", path: "/sponsorblock" },
  },

  // playlists
  {
    id: "list-playlists",
    discord: "playlist list",
    web: { method: "GET", path: "/playlists" },
  },
  {
    id: "save-playlist",
    discord: "playlist save",
    web: { method: "POST", path: "/playlists" },
  },
  {
    id: "load-playlist",
    discord: "playlist load",
    web: { method: "POST", path: "/playlists/:name/load" },
  },
  {
    id: "delete-playlist",
    discord: "playlist delete",
    web: { method: "DELETE", path: "/playlists/:name" },
  },

  // nodes
  {
    id: "list-nodes",
    discord: "node list",
    web: { method: "GET", path: "/nodes" },
  },
  {
    id: "add-node",
    discord: "node add",
    web: { method: "POST", path: "/nodes" },
  },
  {
    id: "remove-node",
    discord: "node remove",
    web: { method: "DELETE", path: "/nodes/:name" },
  },
  {
    id: "enable-node",
    discord: "node enable",
    web: { method: "POST", path: "/nodes/:name/enabled" },
  },
  {
    id: "disable-node",
    discord: "node disable",
    web: { method: "POST", path: "/nodes/:name/enabled" },
  },

  // settings
  {
    id: "read-settings",
    discord: "settings show",
    web: { method: "GET", path: "/settings" },
  },
  {
    id: "dj-mode",
    discord: "settings dj",
    web: { method: "PATCH", path: "/settings" },
  },
  {
    id: "stay-in-voice",
    discord: "settings stay",
    web: { method: "PATCH", path: "/settings" },
  },
  {
    id: "autoplay",
    discord: "settings autoplay",
    web: { method: "PATCH", path: "/settings" },
  },
  {
    id: "default-volume",
    discord: "settings volume",
    web: { method: "PATCH", path: "/settings" },
  },
  {
    id: "list-roles",
    discord: null,
    web: { method: "GET", path: "/roles" },
    why: "Discord's own role picker in /settings dj already lists them",
  },
  {
    id: "list-voice-channels",
    discord: null,
    web: { method: "GET", path: "/channels" },
    why: "Discord's own channel picker in /settings channel already lists them",
  },
  {
    id: "channel-rules",
    discord: "settings channel",
    web: { method: "PUT", path: "/channel-rules/:channelId" },
    why: "PUT rather than PATCH because a rule is written whole",
  },
];
