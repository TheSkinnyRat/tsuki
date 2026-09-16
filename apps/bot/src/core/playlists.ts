import { prisma } from "@tsuki/db";
import type { TrackInfo } from "@tsuki/shared";
import { ServiceError } from "./errors.ts";
import { getGuildSettings } from "./guilds.ts";

const NAME_PATTERN = /^[\w '&-]{1,48}$/;
const MAX_TRACKS = 500;

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  trackCount: number;
  totalLengthMs: number;
  updatedAt: string;
}

function assertName(name: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new ServiceError(
      "INVALID_INPUT",
      "A playlist name can be up to 48 letters, numbers, spaces, apostrophes, ampersands, dashes or underscores.",
    );
  }
}

export async function listPlaylists(
  guildId: string,
): Promise<PlaylistSummary[]> {
  const rows = await prisma.playlist.findMany({
    where: { guildId },
    orderBy: { updatedAt: "desc" },
    include: { tracks: { select: { lengthMs: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.createdBy,
    trackCount: row.tracks.length,
    totalLengthMs: row.tracks.reduce((sum, t) => sum + t.lengthMs, 0),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getPlaylistTracks(
  guildId: string,
  name: string,
): Promise<TrackInfo[]> {
  const row = await prisma.playlist.findUnique({
    where: { guildId_name: { guildId, name } },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
  if (!row) {
    throw new ServiceError("NOT_FOUND", `No playlist called "${name}" here.`);
  }
  return row.tracks.map((track) => ({
    encoded: track.encoded,
    identifier: track.id,
    title: track.title,
    author: track.author,
    uri: track.uri,
    artworkUrl: track.artworkUrl,
    lengthMs: track.lengthMs,
    isStream: track.isStream,
    isSeekable: !track.isStream,
    sourceName: track.sourceName,
    requestedBy: track.addedBy,
    requestedByName: null,
  }));
}

/**
 * Stores what is playing plus what is queued, in that order.
 *
 * The encoded blob is kept rather than a URL: it replays without another
 * lookup, and it survives a source going away from search while the node can
 * still decode it. It does *not* survive a node that never supported the
 * source, which is why loading reports what it could not decode instead of
 * failing the whole playlist.
 */
export async function savePlaylist(
  guildId: string,
  userId: string,
  name: string,
  tracks: TrackInfo[],
  description?: string,
): Promise<PlaylistSummary> {
  assertName(name);
  if (tracks.length === 0) {
    throw new ServiceError(
      "QUEUE_EMPTY",
      "There is nothing playing or queued to save.",
    );
  }
  if (tracks.length > MAX_TRACKS) {
    throw new ServiceError(
      "INVALID_INPUT",
      `A playlist holds at most ${MAX_TRACKS} tracks.`,
    );
  }
  await getGuildSettings(guildId);

  const playlist = await prisma.playlist.upsert({
    where: { guildId_name: { guildId, name } },
    create: {
      guildId,
      name,
      createdBy: userId,
      description: description ?? null,
    },
    update: description !== undefined ? { description } : {},
  });

  await prisma.playlistTrack.deleteMany({ where: { playlistId: playlist.id } });
  await prisma.playlistTrack.createMany({
    data: tracks.map((track, position) => ({
      playlistId: playlist.id,
      position,
      encoded: track.encoded,
      title: track.title,
      author: track.author,
      uri: track.uri,
      artworkUrl: track.artworkUrl,
      lengthMs: track.lengthMs,
      isStream: track.isStream,
      sourceName: track.sourceName,
      addedBy: userId,
    })),
  });

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    createdBy: playlist.createdBy,
    trackCount: tracks.length,
    totalLengthMs: tracks.reduce((sum, t) => sum + t.lengthMs, 0),
    updatedAt: new Date().toISOString(),
  };
}

export async function deletePlaylist(
  guildId: string,
  userId: string,
  name: string,
  canManage: boolean,
): Promise<void> {
  const row = await prisma.playlist.findUnique({
    where: { guildId_name: { guildId, name } },
  });
  if (!row) {
    throw new ServiceError("NOT_FOUND", `No playlist called "${name}" here.`);
  }
  if (row.createdBy !== userId && !canManage) {
    throw new ServiceError(
      "DJ_REQUIRED",
      "Only the member who saved this playlist, or a DJ, can delete it.",
    );
  }
  await prisma.playlist.delete({ where: { id: row.id } });
}
