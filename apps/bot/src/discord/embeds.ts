import { EmbedBuilder } from "discord.js";
import type {
  NodeSummary,
  PlayerSnapshot,
  TrackInfo,
} from "@tsuki/shared";

/** Tsuki's indigo, the same accent the dashboard uses. */
export const ACCENT = 0x474fb0;
export const WARN = 0xb08a47;
export const BAD = 0xb04a4a;

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

function trackLine(track: TrackInfo): string {
  const length = track.isStream ? "live" : formatDuration(track.lengthMs);
  const title = track.uri
    ? `[${escapeMarkdown(track.title)}](${track.uri})`
    : escapeMarkdown(track.title);
  return `${title} · ${escapeMarkdown(track.author)} · \`${length}\``;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`~\\|\[\]])/g, "\\$1");
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(BAD).setDescription(message);
}

export function noticeEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(ACCENT).setDescription(message);
}

export function addedEmbed(
  tracks: TrackInfo[],
  playlistName: string | null,
  position: number,
): EmbedBuilder {
  const first = tracks[0];
  if (playlistName && tracks.length > 1) {
    const total = tracks.reduce((sum, t) => sum + t.lengthMs, 0);
    return new EmbedBuilder()
      .setColor(ACCENT)
      .setAuthor({ name: "Added a playlist" })
      .setTitle(playlistName)
      .setDescription(
        `${tracks.length} tracks · \`${formatDuration(total)}\``,
      )
      .setThumbnail(first?.artworkUrl ?? null);
  }
  if (!first) return noticeEmbed("Nothing was added.");
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: position === 0 ? "Playing next" : "Added to the queue" })
    .setDescription(trackLine(first))
    .setThumbnail(first.artworkUrl);
}

export function nowPlayingEmbed(snapshot: PlayerSnapshot): EmbedBuilder {
  const current = snapshot.current;
  if (!current) return noticeEmbed("Nothing is playing right now.");

  const bar = progressBar(snapshot.positionMs, current.lengthMs);
  const position = current.isStream
    ? "live"
    : `${formatDuration(snapshot.positionMs)} / ${formatDuration(current.lengthMs)}`;

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: snapshot.paused ? "Paused" : "Now playing" })
    .setTitle(current.title)
    .setDescription(
      [
        escapeMarkdown(current.author),
        current.isStream ? "" : `\`${bar}\``,
        position,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setThumbnail(current.artworkUrl);

  if (current.uri) embed.setURL(current.uri);

  const footer: string[] = [`volume ${snapshot.volume}`];
  if (snapshot.repeatMode !== "off") footer.push(`repeat ${snapshot.repeatMode}`);
  if (snapshot.autoplay) footer.push("autoplay");
  if (current.requestedBy) footer.push(`asked by <@${current.requestedBy}>`);
  embed.setFooter({ text: footer.join(" · ") });

  return embed;
}

function progressBar(position: number, length: number, width = 18): string {
  if (length <= 0) return "─".repeat(width);
  const filled = Math.min(width - 1, Math.floor((position / length) * width));
  return `${"─".repeat(filled)}●${"─".repeat(Math.max(0, width - filled - 1))}`;
}

export function queueEmbed(
  snapshot: PlayerSnapshot,
  page: number,
  perPage = 10,
): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle("Queue");

  if (snapshot.current) {
    embed.addFields({
      name: "Now playing",
      value: trackLine(snapshot.current),
    });
  }

  if (snapshot.queue.length === 0) {
    embed.setDescription("Nothing queued after this.");
    return embed;
  }

  const pages = Math.max(1, Math.ceil(snapshot.queue.length / perPage));
  const safePage = Math.min(Math.max(page, 1), pages);
  const start = (safePage - 1) * perPage;
  const lines = snapshot.queue
    .slice(start, start + perPage)
    .map((track, index) => `\`${String(start + index + 1).padStart(2, "0")}\` ${trackLine(track)}`);

  embed.setDescription(lines.join("\n")).setFooter({
    text: `page ${safePage}/${pages} · ${snapshot.queue.length} tracks · ${formatDuration(snapshot.queueLengthMs)} left`,
  });
  return embed;
}

export function nodesEmbed(nodes: NodeSummary[]): EmbedBuilder {
  if (nodes.length === 0) {
    return new EmbedBuilder()
      .setColor(WARN)
      .setTitle("No audio node yet")
      .setDescription(
        [
          "Tsuki plays through a Lavalink node **you** provide, so this server decides what it can play and who pays for it.",
          "",
          "Add one with `/node add`. You will need its host, port and password.",
        ].join("\n"),
      );
  }

  const embed = new EmbedBuilder().setColor(ACCENT).setTitle("Audio nodes");
  for (const node of nodes) {
    const state = node.connected
      ? "connected"
      : node.enabled
        ? `offline${node.lastError ? ` — ${node.lastError}` : ""}`
        : "disabled";
    const caps = node.capabilities;
    embed.addFields({
      name: `${node.name} · ${node.host}:${node.port}`,
      value: [
        state,
        caps ? `Lavalink ${caps.version}` : null,
        caps && caps.sources.length > 0
          ? `sources: ${caps.sources.join(", ")}`
          : null,
        caps && caps.plugins.length > 0
          ? `plugins: ${caps.plugins.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
  return embed;
}
