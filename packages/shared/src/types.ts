/**
 * The contract between the bot and the dashboard.
 *
 * Every capability Tsuki has is reachable from both a slash command and the
 * web API, and both go through the same service layer inside the bot. These
 * types are what crosses the wire between the two processes.
 */

// ------------------------------------------------------------------- tracks

export interface TrackInfo {
  /** Lavalink's opaque encoded track — what you hand back to play it again. */
  encoded: string;
  identifier: string;
  title: string;
  author: string;
  uri: string | null;
  artworkUrl: string | null;
  lengthMs: number;
  isStream: boolean;
  isSeekable: boolean;
  sourceName: string | null;
  /** Discord user id, or null when autoplay chose it. */
  requestedBy: string | null;
  /** That member's display name, resolved by the bot. Null until it is known. */
  requestedByName: string | null;
}

// ------------------------------------------------------------------- player

/** String unions rather than enums: Node runs this repo in strip-only mode. */
export type RepeatMode = "off" | "track" | "queue";

export const REPEAT_MODES: readonly RepeatMode[] = ["off", "track", "queue"];

export interface PlayerSnapshot {
  guildId: string;
  connected: boolean;
  voiceChannelId: string | null;
  /** Name of that voice channel, for the "#lounge · 14 listening" chip. */
  voiceChannelName: string | null;
  /** Humans (not bots) in that voice channel right now. */
  listenerCount: number;
  textChannelId: string | null;
  playing: boolean;
  paused: boolean;
  /** Milliseconds into the current track. */
  positionMs: number;
  volume: number;
  repeatMode: RepeatMode;
  autoplay: boolean;
  /** Node this guild is currently playing through, by its stored name. */
  nodeName: string | null;
  current: TrackInfo | null;
  queue: TrackInfo[];
  queueLengthMs: number;
  /** Whether there is a track to go back to. */
  hasPrevious: boolean;
  /** Filters currently applied, by Lavalink's own names. */
  activeFilters: string[];
}

// -------------------------------------------------------------------- nodes

/** What a node can actually do, read from its own GET /v4/info. */
export interface NodeCapabilities {
  version: string;
  sources: string[];
  plugins: string[];
  filters: string[];
}

export type NodeHealth = "unknown" | "ok" | "unreachable" | "rejected";

export interface NodeSummary {
  id: string;
  /**
   * True for a node the instance operator supplies rather than the guild.
   * The dashboard shows it, but nobody in the guild can edit or remove it.
   */
  instanceProvided?: boolean;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  enabled: boolean;
  priority: number;
  connected: boolean;
  health: NodeHealth;
  lastError: string | null;
  lastOkAt: string | null;
  capabilities: NodeCapabilities | null;
}

// ------------------------------------------------------------------- guilds

export interface GuildSettings {
  id: string;
  name: string | null;
  defaultVolume: number;
  stay247: boolean;
  autoplay: boolean;
  djMode: boolean;
  djRoleId: string | null;
}

export interface ChannelRuleSummary {
  channelId: string;
  djRequired: boolean;
  canRequest: boolean;
  locked: boolean;
}

// -------------------------------------------------------------------- actor

/**
 * Who is asking. Built from a Discord interaction or from a web session, and
 * every service call takes one — authorisation lives in the service layer, so
 * a rule cannot be enforced on one surface and missing on the other.
 */
export interface Actor {
  userId: string;
  guildId: string;
  /** Role ids the member holds in this guild. */
  roleIds: string[];
  /** Voice channel the member is sitting in, or null. */
  voiceChannelId: string | null;
  /** Discord Manage Guild — always allowed to change settings. */
  isGuildManager: boolean;
  /** Where the request came in from. Never used to decide permissions. */
  surface: "discord" | "web";
}

// ------------------------------------------------------------------- errors

export type ServiceErrorCode =
  | "NOT_IN_VOICE"
  | "WRONG_VOICE_CHANNEL"
  | "DJ_REQUIRED"
  | "CHANNEL_LOCKED"
  | "REQUESTS_DISABLED"
  | "NO_NODE_CONFIGURED"
  | "NO_NODE_AVAILABLE"
  | "SOURCE_UNSUPPORTED"
  | "NOTHING_PLAYING"
  | "QUEUE_EMPTY"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "HOST_NOT_ALLOWED"
  | "NODE_UNREACHABLE"
  | "INTERNAL";

export interface ServiceErrorShape {
  code: ServiceErrorCode;
  message: string;
  /** Extra context the dashboard can render, e.g. which sources the node has. */
  details?: Record<string, unknown>;
}

// ------------------------------------------------------------------ results

export interface SearchResult {
  loadType: "track" | "playlist" | "search" | "empty" | "error";
  playlistName: string | null;
  tracks: TrackInfo[];
}

export interface EnqueueResult {
  added: TrackInfo[];
  playlistName: string | null;
  startedPlaying: boolean;
  positionInQueue: number;
}
