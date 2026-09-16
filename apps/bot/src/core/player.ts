import type { Client } from "discord.js";
import type { LavalinkManager, Player, Track } from "lavalink-client";
import { prisma } from "@tsuki/db";
import type {
  Actor,
  EnqueueResult,
  PlayerSnapshot,
  RepeatMode,
  SearchResult,
  TrackInfo,
} from "@tsuki/shared";
import { ServiceError } from "./errors.ts";
import { getChannelRule, getGuildSettings } from "./guilds.ts";
import {
  assertCan,
  assertInVoice,
  type Capability,
  type PermissionContext,
} from "./permissions.ts";
import { assertNodeAvailable, sourcesForGuild } from "./nodes.ts";
import { createLogger } from "../logger.ts";

const log = createLogger("player");

/**
 * Which source manager a request needs, so a node that lacks it can say so
 * before the load fails. Names match Lavalink's own `sourceManagers`.
 */
export function requiredSourceFor(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (q.startsWith("ytsearch:") || q.startsWith("ytmsearch:")) return "youtube";
  if (q.startsWith("scsearch:")) return "soundcloud";
  if (q.startsWith("spsearch:") || q.startsWith("sprec:")) return "spotify";
  if (q.startsWith("dzsearch:") || q.startsWith("dzisrc:")) return "deezer";
  if (q.startsWith("amsearch:")) return "applemusic";
  if (!/^https?:\/\//.test(q)) return null; // plain search — the default platform decides

  try {
    const host = new URL(q).hostname.replace(/^www\./, "");
    if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
    if (host.endsWith("spotify.com")) return "spotify";
    if (host.endsWith("soundcloud.com")) return "soundcloud";
    if (host.endsWith("deezer.com")) return "deezer";
    if (host.endsWith("music.apple.com")) return "applemusic";
    if (host.endsWith("bandcamp.com")) return "bandcamp";
    if (host.endsWith("twitch.tv")) return "twitch";
    if (host.endsWith("vimeo.com")) return "vimeo";
    if (host.endsWith("nicovideo.jp")) return "niconico";
    return "http";
  } catch {
    return null;
  }
}

function toTrackInfo(track: Track): TrackInfo {
  const requester = track.requester as { id?: string } | undefined;
  return {
    encoded: track.encoded ?? "",
    identifier: track.info.identifier,
    title: track.info.title,
    author: track.info.author,
    uri: track.info.uri ?? null,
    artworkUrl: track.info.artworkUrl ?? null,
    lengthMs: track.info.duration ?? 0,
    isStream: track.info.isStream ?? false,
    isSeekable: track.info.isSeekable ?? false,
    sourceName: track.info.sourceName ?? null,
    requestedBy: requester?.id ?? null,
  };
}

export interface PlayerServiceDeps {
  manager: LavalinkManager;
  client: Client;
}

export class PlayerService {
  private readonly manager: LavalinkManager;
  private readonly client: Client;

  constructor(deps: PlayerServiceDeps) {
    this.manager = deps.manager;
    this.client = deps.client;
  }

  getPlayer(guildId: string): Player | undefined {
    return this.manager.getPlayer(guildId);
  }

  /** Humans (not bots) sitting in a voice channel. */
  private listenerCount(guildId: string, channelId: string | null): number {
    if (!channelId) return 0;
    const guild = this.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (!channel || !("members" in channel)) return 0;
    const members = channel.members as Map<string, { user: { bot: boolean } }>;
    let count = 0;
    for (const member of members.values()) if (!member.user.bot) count += 1;
    return count;
  }

  async buildContext(
    actor: Actor,
    options: { targetRequesterId?: string | null } = {},
  ): Promise<PermissionContext> {
    const settings = await getGuildSettings(actor.guildId);
    const player = this.getPlayer(actor.guildId);
    const channelForRule = player?.voiceChannelId ?? actor.voiceChannelId;
    const rule = await getChannelRule(actor.guildId, channelForRule);

    const context: PermissionContext = {
      actor,
      settings,
      rule,
      player: player
        ? {
            connected: Boolean(player.connected),
            voiceChannelId: player.voiceChannelId,
            currentRequesterId:
              (player.queue.current?.requester as { id?: string } | undefined)
                ?.id ?? null,
            listenerCount: this.listenerCount(
              actor.guildId,
              player.voiceChannelId,
            ),
          }
        : null,
    };
    if (options.targetRequesterId !== undefined) {
      context.targetRequesterId = options.targetRequesterId;
    }
    return context;
  }

  private async authorise(
    capability: Capability,
    actor: Actor,
    options: { targetRequesterId?: string | null } = {},
  ): Promise<PermissionContext> {
    const context = await this.buildContext(actor, options);
    assertCan(capability, context);
    return context;
  }

  private requirePlayer(guildId: string): Player {
    const player = this.getPlayer(guildId);
    if (!player || !player.queue.current) {
      throw new ServiceError("NOTHING_PLAYING", "Nothing is playing right now.");
    }
    return player;
  }

  // ------------------------------------------------------------- snapshot

  async snapshot(guildId: string): Promise<PlayerSnapshot> {
    const settings = await getGuildSettings(guildId);
    const player = this.getPlayer(guildId);
    if (!player) {
      return {
        guildId,
        connected: false,
        voiceChannelId: null,
        textChannelId: null,
        playing: false,
        paused: false,
        positionMs: 0,
        volume: settings.defaultVolume,
        repeatMode: "off",
        autoplay: settings.autoplay,
        nodeName: null,
        current: null,
        queue: [],
        queueLengthMs: 0,
        activeFilters: [],
      };
    }

    const queue = player.queue.tracks.map((t) => toTrackInfo(t as Track));
    return {
      guildId,
      connected: Boolean(player.connected),
      voiceChannelId: player.voiceChannelId,
      textChannelId: player.textChannelId,
      playing: player.playing,
      paused: player.paused,
      positionMs: player.position,
      volume: player.volume,
      repeatMode: player.repeatMode as RepeatMode,
      autoplay: settings.autoplay,
      nodeName: player.node.options.id ?? null,
      current: player.queue.current
        ? toTrackInfo(player.queue.current as Track)
        : null,
      queue,
      queueLengthMs: queue.reduce(
        (total, track) => total + (track.isStream ? 0 : track.lengthMs),
        0,
      ),
      activeFilters: this.activeFilters(player),
    };
  }

  private activeFilters(player: Player): string[] {
    const filters = player.filterManager.filters as unknown as Record<
      string,
      unknown
    >;
    return Object.entries(filters)
      .filter(([, value]) => value === true)
      .map(([name]) => name);
  }

  // -------------------------------------------------------------- search

  async search(actor: Actor, query: string): Promise<SearchResult> {
    await this.authorise("request", actor);
    const nodeId = await assertNodeAvailable(this.manager, actor.guildId);
    await this.assertSourceSupported(actor.guildId, query);

    const node = this.manager.nodeManager.nodes.get(nodeId);
    if (!node) {
      throw new ServiceError("NO_NODE_AVAILABLE", "The audio node went away.");
    }

    const result = await node.search(
      { query },
      { id: actor.userId },
      false,
    );

    return {
      loadType: result.loadType as SearchResult["loadType"],
      playlistName: result.playlist?.name ?? null,
      tracks: (result.tracks ?? []).map((t) => toTrackInfo(t as Track)),
    };
  }

  private async assertSourceSupported(
    guildId: string,
    query: string,
  ): Promise<void> {
    const needed = requiredSourceFor(query);
    if (!needed) return;
    const available = await sourcesForGuild(this.manager, guildId);
    if (available.length === 0) return; // nothing known yet; let the node answer
    if (available.includes(needed)) return;
    throw new ServiceError(
      "SOURCE_UNSUPPORTED",
      `This server's audio node cannot play from ${needed}. It supports: ${available.join(", ")}.`,
      { needed, available },
    );
  }

  // ------------------------------------------------------------- playback

  async enqueue(
    actor: Actor,
    query: string,
    options: { textChannelId?: string | null; playNext?: boolean } = {},
  ): Promise<EnqueueResult> {
    const context = await this.authorise("request", actor);
    const nodeId = await assertNodeAvailable(this.manager, actor.guildId);
    await this.assertSourceSupported(actor.guildId, query);

    if (!actor.voiceChannelId) {
      throw new ServiceError("NOT_IN_VOICE", "Join a voice channel first.");
    }

    let player = this.getPlayer(actor.guildId);
    if (!player) {
      player = this.manager.createPlayer({
        guildId: actor.guildId,
        voiceChannelId: actor.voiceChannelId,
        textChannelId: options.textChannelId ?? undefined,
        selfDeaf: true,
        selfMute: false,
        volume: context.settings.defaultVolume,
        node: nodeId,
      });
    }
    if (!player.connected) await player.connect();

    const result = await player.search({ query }, { id: actor.userId }, false);
    const tracks = (result.tracks ?? []) as Track[];
    if (tracks.length === 0) {
      throw new ServiceError(
        "NOT_FOUND",
        `Nothing found for "${query}".`,
      );
    }

    const isPlaylist = result.loadType === "playlist";
    const chosen = isPlaylist ? tracks : [tracks[0]!];

    const positionBefore = player.queue.tracks.length;
    if (options.playNext) {
      await player.queue.splice(0, 0, ...chosen);
    } else {
      await player.queue.add(chosen);
    }

    const startedPlaying = !player.playing && !player.paused;
    if (startedPlaying) await player.play();

    return {
      added: chosen.map(toTrackInfo),
      playlistName: isPlaylist ? (result.playlist?.name ?? null) : null,
      startedPlaying,
      positionInQueue: options.playNext ? 0 : positionBefore,
    };
  }

  async skip(actor: Actor, to?: number): Promise<TrackInfo | null> {
    const player = this.requirePlayer(actor.guildId);
    const currentRequester =
      (player.queue.current?.requester as { id?: string } | undefined)?.id ??
      null;
    await this.authorise("control", actor, {
      targetRequesterId: currentRequester,
    });

    if (player.queue.tracks.length === 0) {
      await player.stopPlaying(false, false);
      return null;
    }
    await player.skip(to);
    return player.queue.current
      ? toTrackInfo(player.queue.current as Track)
      : null;
  }

  async pause(actor: Actor): Promise<void> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    if (player.paused) return;
    await player.pause();
  }

  async resume(actor: Actor): Promise<void> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    if (!player.paused) return;
    await player.resume();
  }

  async stop(actor: Actor, leave = true): Promise<void> {
    const player = this.getPlayer(actor.guildId);
    if (!player) return;
    await this.authorise("control", actor);
    const settings = await getGuildSettings(actor.guildId);
    await player.stopPlaying(true, false);
    if (leave && !settings.stay247) {
      await player.destroy("stopped by a member");
    }
  }

  async seek(actor: Actor, positionMs: number): Promise<void> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    const track = player.queue.current;
    if (!track?.info.isSeekable) {
      throw new ServiceError("INVALID_INPUT", "This track cannot be seeked.");
    }
    if (positionMs < 0 || positionMs > (track.info.duration ?? 0)) {
      throw new ServiceError(
        "INVALID_INPUT",
        "That position is outside the track.",
      );
    }
    await player.seek(positionMs);
  }

  async setVolume(actor: Actor, volume: number): Promise<void> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    if (!Number.isInteger(volume) || volume < 0 || volume > 200) {
      throw new ServiceError(
        "INVALID_INPUT",
        "Volume has to be a whole number between 0 and 200.",
      );
    }
    await player.setVolume(volume);
  }

  async setRepeatMode(actor: Actor, mode: RepeatMode): Promise<void> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    await player.setRepeatMode(mode);
  }

  async shuffle(actor: Actor): Promise<void> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    if (player.queue.tracks.length < 2) {
      throw new ServiceError(
        "QUEUE_EMPTY",
        "There is nothing in the queue to shuffle.",
      );
    }
    await player.queue.shuffle();
  }

  async clearQueue(actor: Actor): Promise<number> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    const removed = player.queue.tracks.length;
    if (removed === 0) {
      throw new ServiceError("QUEUE_EMPTY", "The queue is already empty.");
    }
    await player.queue.splice(0, removed);
    return removed;
  }

  async removeAt(actor: Actor, index: number): Promise<TrackInfo> {
    const player = this.requirePlayer(actor.guildId);
    const target = player.queue.tracks[index] as Track | undefined;
    if (!target) {
      throw new ServiceError("NOT_FOUND", `There is no track at #${index + 1}.`);
    }
    const requester = (target.requester as { id?: string } | undefined)?.id;
    await this.authorise("control", actor, {
      targetRequesterId: requester ?? null,
    });
    await player.queue.splice(index, 1);
    return toTrackInfo(target);
  }

  async move(actor: Actor, from: number, to: number): Promise<TrackInfo> {
    const player = this.requirePlayer(actor.guildId);
    await this.authorise("control", actor);
    const tracks = player.queue.tracks;
    const target = tracks[from] as Track | undefined;
    if (!target) {
      throw new ServiceError("NOT_FOUND", `There is no track at #${from + 1}.`);
    }
    if (to < 0 || to >= tracks.length) {
      throw new ServiceError("INVALID_INPUT", "That position is out of range.");
    }
    await player.queue.splice(from, 1);
    await player.queue.splice(to, 0, target);
    return toTrackInfo(target);
  }

  async joinVoice(actor: Actor, textChannelId?: string | null): Promise<void> {
    const context = await this.buildContext(actor);
    assertInVoice(context);
    assertCan("request", context);
    const nodeId = await assertNodeAvailable(this.manager, actor.guildId);
    if (!actor.voiceChannelId) {
      throw new ServiceError("NOT_IN_VOICE", "Join a voice channel first.");
    }
    let player = this.getPlayer(actor.guildId);
    if (!player) {
      player = this.manager.createPlayer({
        guildId: actor.guildId,
        voiceChannelId: actor.voiceChannelId,
        textChannelId: textChannelId ?? undefined,
        selfDeaf: true,
        volume: context.settings.defaultVolume,
        node: nodeId,
      });
    }
    if (!player.connected) await player.connect();
  }

  /** Writes what just started to the guild's history, for autoplay and the dashboard. */
  async recordPlayed(guildId: string, track: Track): Promise<void> {
    const info = toTrackInfo(track);
    await prisma.playHistory
      .create({
        data: {
          guildId,
          encoded: info.encoded,
          title: info.title,
          author: info.author,
          uri: info.uri,
          artworkUrl: info.artworkUrl,
          lengthMs: info.lengthMs,
          sourceName: info.sourceName,
          requestedBy: info.requestedBy,
        },
      })
      .catch((error) => log.warn("could not record history", error));
  }
}
