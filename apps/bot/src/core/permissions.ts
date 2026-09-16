import type { Actor, ChannelRuleSummary, GuildSettings } from "@tsuki/shared";
import { ServiceError } from "./errors.ts";

/**
 * The one place a permission is decided.
 *
 * Both surfaces call this: the slash command adapter and the dashboard's HTTP
 * adapter. A rule enforced in a command handler instead would be enforced on
 * Discord and absent on the web, which is the whole failure this module exists
 * to prevent. `actor.surface` is deliberately never read here.
 */

export type Capability =
  /** Put something in the queue. */
  | "request"
  /** Change what is playing: skip, pause, seek, volume, shuffle, clear, stop. */
  | "control"
  /** Change the guild's configuration: settings, nodes, DJ role. */
  | "manage";

export interface PlayerContext {
  connected: boolean;
  voiceChannelId: string | null;
  /** Who asked for the track that is playing, if anyone did. */
  currentRequesterId: string | null;
  /** Humans in the voice channel, excluding bots. */
  listenerCount: number;
}

export interface PermissionContext {
  actor: Actor;
  settings: GuildSettings;
  /** Rule for the channel the action concerns, if one is stored. */
  rule: ChannelRuleSummary | null;
  player: PlayerContext | null;
  /**
   * Set when the action targets one specific track, e.g. skipping the current
   * one. Lets someone remove their own request without holding the DJ role.
   */
  targetRequesterId?: string | null;
}

function hasDjRole(actor: Actor, settings: GuildSettings): boolean {
  if (!settings.djRoleId) return false;
  return actor.roleIds.includes(settings.djRoleId);
}

/**
 * True when the member may act as a DJ. A guild manager always may; so does
 * the only human in the channel, because a DJ rule that locks the room against
 * its single occupant is just a bug with a policy name.
 */
export function isDj(ctx: PermissionContext): boolean {
  const { actor, settings, player } = ctx;
  if (actor.isGuildManager) return true;
  if (hasDjRole(actor, settings)) return true;
  if (player && player.listenerCount <= 1 && sharesVoice(ctx)) return true;
  return false;
}

function sharesVoice(ctx: PermissionContext): boolean {
  const { actor, player } = ctx;
  if (!player || !player.connected || player.voiceChannelId === null) {
    return actor.voiceChannelId !== null;
  }
  return actor.voiceChannelId === player.voiceChannelId;
}

/** Throws unless the actor is in the voice channel the player is using. */
export function assertInVoice(ctx: PermissionContext): void {
  const { actor, player } = ctx;
  if (actor.voiceChannelId === null) {
    throw new ServiceError(
      "NOT_IN_VOICE",
      "Join a voice channel first — Tsuki follows the channel you are in.",
    );
  }
  if (
    player?.connected &&
    player.voiceChannelId !== null &&
    player.voiceChannelId !== actor.voiceChannelId
  ) {
    throw new ServiceError(
      "WRONG_VOICE_CHANNEL",
      "Tsuki is playing in another voice channel right now.",
      { playingIn: player.voiceChannelId },
    );
  }
}

export function assertCan(capability: Capability, ctx: PermissionContext): void {
  const { actor, settings, rule } = ctx;

  if (capability === "manage") {
    if (actor.isGuildManager || hasDjRole(actor, settings)) return;
    throw new ServiceError(
      "DJ_REQUIRED",
      "Changing Tsuki's settings needs the DJ role or Manage Server.",
    );
  }

  assertInVoice(ctx);

  if (rule?.locked && !isDj(ctx)) {
    throw new ServiceError(
      "CHANNEL_LOCKED",
      "This channel is locked — only the DJ role can start Tsuki here.",
    );
  }

  if (capability === "request") {
    if (rule && !rule.canRequest) {
      throw new ServiceError(
        "REQUESTS_DISABLED",
        "Requests are turned off for this channel.",
      );
    }
    if (rule?.djRequired && !isDj(ctx)) {
      throw new ServiceError(
        "DJ_REQUIRED",
        "Only the DJ role can queue tracks in this channel.",
      );
    }
    return;
  }

  // capability === "control"
  if (!settings.djMode && !rule?.djRequired) return;
  if (isDj(ctx)) return;

  // Anyone may undo their own request without being a DJ.
  if (
    ctx.targetRequesterId !== undefined &&
    ctx.targetRequesterId !== null &&
    ctx.targetRequesterId === actor.userId
  ) {
    return;
  }

  throw new ServiceError(
    "DJ_REQUIRED",
    settings.djRoleId
      ? "DJ mode is on — you need the DJ role to change playback."
      : "DJ mode is on, but no DJ role has been set. A server manager has to pick one.",
  );
}
