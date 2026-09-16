import { Client, Events, GatewayIntentBits } from "discord.js";
import {
  EndBehaviorType,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type VoiceConnection,
} from "@discordjs/voice";

/**
 * Proof that audio actually reaches a voice channel.
 *
 * Lavalink reporting a track as playing only says Lavalink is sending. This
 * joins the channel as a second bot, subscribes to what the music bot is
 * transmitting, and counts the Opus packets that arrive. Discord's silence
 * frame is three bytes (0xF8 0xFF 0xFE), so anything larger is real audio —
 * which means this needs no Opus decoder and no native module to answer the
 * only question that matters: is there sound in the room.
 *
 * Usage:
 *   node --env-file=../../.env src/index.ts <guildId> <voiceChannelId> [seconds]
 */

const SILENCE_FRAME_MAX_BYTES = 3;

interface SpeakerStats {
  packets: number;
  bytes: number;
  voicedPackets: number;
  largestPacket: number;
  firstAt: number | null;
  lastAt: number | null;
}

function emptyStats(): SpeakerStats {
  return {
    packets: 0,
    bytes: 0,
    voicedPackets: 0,
    largestPacket: 0,
    firstAt: null,
    lastAt: null,
  };
}

async function main(): Promise<void> {
  const guildId = process.argv[2] ?? process.env["TEST_GUILD_ID"];
  const channelId = process.argv[3] ?? process.env["TEST_VOICE_CHANNEL_ID"];
  const seconds = Number(process.argv[4] ?? 20);
  const token = process.env["PROBE_DISCORD_TOKEN"];

  if (!guildId || !channelId || !token) {
    console.error(
      "need a guild id, a voice channel id and PROBE_DISCORD_TOKEN",
    );
    process.exit(2);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const stats = new Map<string, SpeakerStats>();
  const subscribed = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    client.once(Events.ClientReady, () => resolve());
    client.once(Events.Error, reject);
    void client.login(token);
  });

  const guild = await client.guilds.fetch(guildId);
  let connection: VoiceConnection;
  try {
    connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
      // Deafened, we would receive nothing at all; muted, we send nothing.
      selfDeaf: false,
      selfMute: true,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch (error) {
    console.error("could not join the voice channel:", error);
    await client.destroy();
    process.exit(1);
  }

  console.log(
    JSON.stringify({ event: "joined", guildId, channelId, seconds }),
  );

  connection.receiver.speaking.on("start", (userId) => {
    if (subscribed.has(userId)) return;
    subscribed.add(userId);

    const stream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    });

    stream.on("data", (chunk: Buffer) => {
      let entry = stats.get(userId);
      if (!entry) {
        entry = emptyStats();
        stats.set(userId, entry);
      }
      const now = Date.now();
      entry.packets += 1;
      entry.bytes += chunk.length;
      entry.lastAt = now;
      if (entry.firstAt === null) entry.firstAt = now;
      if (chunk.length > SILENCE_FRAME_MAX_BYTES) entry.voicedPackets += 1;
      if (chunk.length > entry.largestPacket) entry.largestPacket = chunk.length;
    });

    stream.on("error", (error) =>
      console.error(JSON.stringify({ event: "stream-error", userId, error: String(error) })),
    );
  });

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  const speakers = [...stats.entries()].map(([userId, entry]) => ({
    userId,
    ...entry,
    durationMs:
      entry.firstAt && entry.lastAt ? entry.lastAt - entry.firstAt : 0,
    averagePacketBytes:
      entry.packets > 0 ? Math.round(entry.bytes / entry.packets) : 0,
  }));

  const voiced = speakers.filter((s) => s.voicedPackets > 0);
  const verdict = voiced.length > 0 ? "AUDIO PRESENT" : "SILENT";

  console.log(
    JSON.stringify({ event: "result", verdict, speakers }, null, 2),
  );

  connection.destroy();
  await client.destroy();
  process.exit(voiced.length > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
