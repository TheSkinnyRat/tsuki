import type { Client, SendableChannels } from "discord.js";
import type { LavalinkManager, Player, Track } from "lavalink-client";
import { createLogger } from "../logger.ts";
import { nowPlayingEmbed, noticeEmbed } from "../discord/embeds.ts";
import { getGuildSettings } from "./guilds.ts";
import type { PlayerService } from "./player.ts";
import { pickAutoplayTrack } from "./autoplay.ts";

const log = createLogger("lifecycle");

/** How long Tsuki waits in an idle or empty channel before leaving. */
const IDLE_LEAVE_MS = 60_000;

/**
 * Leaving is managed here rather than by the library's `destroyAfterMs`,
 * because the decision depends on a per-guild setting the library cannot see:
 * `stay247` means hold the channel, and a static timeout cannot express that.
 */
export class Lifecycle {
  private readonly client: Client;
  private readonly manager: LavalinkManager;
  private readonly players: PlayerService;
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(deps: {
    client: Client;
    manager: LavalinkManager;
    players: PlayerService;
  }) {
    this.client = deps.client;
    this.manager = deps.manager;
    this.players = deps.players;
  }

  register(): void {
    const manager = this.manager;

    manager.on("trackStart", (player, track) => {
      this.cancelIdle(player.guildId);
      if (!track) return;
      void this.players.recordPlayed(player.guildId, track as Track);
      void this.announceNowPlaying(player);
    });

    manager.on("queueEnd", (player) => {
      void this.onQueueEnd(player);
    });

    manager.on("trackError", (player, track, payload) => {
      log.warn(
        `track error in ${player.guildId}: ${payload.exception?.message ?? "unknown"}`,
      );
      void this.say(
        player,
        `Could not play **${track?.info.title ?? "that track"}** — ${
          payload.exception?.message ?? "the node refused it"
        }. Skipping.`,
      );
    });

    manager.on("trackStuck", (player, track) => {
      void this.say(
        player,
        `**${track?.info.title ?? "That track"}** stopped sending audio. Skipping.`,
      );
    });

    manager.on("playerVoiceLeave", (player) => {
      void this.considerEmptyChannel(player);
    });

    manager.on("playerVoiceJoin", (player) => {
      this.cancelIdle(player.guildId);
    });

    manager.on("playerDestroy", (player) => {
      this.cancelIdle(player.guildId);
    });
  }

  /** The hook lavalink-client calls before it declares the queue finished. */
  autoPlayFunction = async (player: Player): Promise<void> => {
    const settings = await getGuildSettings(player.guildId);
    if (!settings.autoplay) return;
    const next = await pickAutoplayTrack(this.manager, player);
    if (!next) return;
    await player.queue.add(next);
    log.debug(`autoplay queued ${next.info.title} in ${player.guildId}`);
  };

  private async onQueueEnd(player: Player): Promise<void> {
    const settings = await getGuildSettings(player.guildId);
    await this.say(
      player,
      settings.autoplay
        ? "The queue is empty and there is nothing in this server's history to keep going with."
        : "That was the last track.",
    );
    if (settings.stay247) return;
    this.startIdle(player, "the queue ran out");
  }

  private async considerEmptyChannel(player: Player): Promise<void> {
    const settings = await getGuildSettings(player.guildId);
    if (settings.stay247) return;
    const listeners = this.humanListeners(player);
    if (listeners > 0) return;
    this.startIdle(player, "everyone left the channel");
  }

  private humanListeners(player: Player): number {
    const guild = this.client.guilds.cache.get(player.guildId);
    const channel = player.voiceChannelId
      ? guild?.channels.cache.get(player.voiceChannelId)
      : null;
    if (!channel || !("members" in channel)) return 0;
    const members = channel.members as Map<string, { user: { bot: boolean } }>;
    let count = 0;
    for (const member of members.values()) if (!member.user.bot) count += 1;
    return count;
  }

  private startIdle(player: Player, reason: string): void {
    this.cancelIdle(player.guildId);
    const timer = setTimeout(() => {
      this.idleTimers.delete(player.guildId);
      const live = this.manager.getPlayer(player.guildId);
      if (!live) return;
      // Re-check rather than trust the timer: a track may have been queued,
      // or somebody may have walked back in, while it was counting down.
      if (live.playing || live.queue.tracks.length > 0) return;
      void this.say(live, `Leaving — ${reason}.`);
      void live.destroy("idle");
    }, IDLE_LEAVE_MS);
    this.idleTimers.set(player.guildId, timer);
  }

  private cancelIdle(guildId: string): void {
    const timer = this.idleTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(guildId);
    }
  }

  private async announceNowPlaying(player: Player): Promise<void> {
    const channel = await this.textChannel(player);
    if (!channel) return;
    const snapshot = await this.players.snapshot(player.guildId);
    await channel
      .send({ embeds: [nowPlayingEmbed(snapshot)] })
      .catch((error: unknown) => log.debug("could not announce", error));
  }

  private async say(player: Player, message: string): Promise<void> {
    const channel = await this.textChannel(player);
    if (!channel) return;
    await channel
      .send({ embeds: [noticeEmbed(message)] })
      .catch((error: unknown) => log.debug("could not post notice", error));
  }

  private async textChannel(player: Player): Promise<SendableChannels | null> {
    if (!player.textChannelId) return null;
    const channel = await this.client.channels
      .fetch(player.textChannelId)
      .catch(() => null);
    if (!channel || !channel.isSendable()) return null;
    return channel;
  }

  /** Clears every pending timer; used on shutdown so the process can exit. */
  dispose(): void {
    for (const timer of this.idleTimers.values()) clearTimeout(timer);
    this.idleTimers.clear();
  }
}
