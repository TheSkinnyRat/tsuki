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

  /**
   * Joining is retried because Discord's voice handshake fails transiently —
   * three times during one evening's testing it went `signalling → disconnected`
   * with the permissions and the channel unchanged, and succeeded on the next
   * attempt. A probe that gives up on the first one reports "SILENT" for a bot
   * that is playing perfectly well, which is the worst thing a test instrument
   * can do.
   */
  const ATTEMPTS = 3;
  let connection: VoiceConnection | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      connection = await joinOnce(guild, channelId);
      break;
    } catch (error) {
      console.error(
        JSON.stringify({ event: "join-failed", attempt, error: String(error) }),
      );
      connection?.destroy();
      connection = null;
      if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (!connection) {
    console.error(`could not join the voice channel after ${ATTEMPTS} attempts`);
    await client.destroy();
    process.exit(1);
  }

  async function joinOnce(
    target: typeof guild,
    channel: string,
  ): Promise<VoiceConnection> {
    const attempt = joinVoiceChannel({
      channelId: channel,
      guildId: target.id,
      adapterCreator: target.voiceAdapterCreator,
      // Deafened, we would receive nothing at all; muted, we send nothing.
      selfDeaf: false,
      selfMute: true,
    });
    attempt.on("stateChange", (from, to) =>
      console.log(
        JSON.stringify({ event: "voice-state", from: from.status, to: to.status }),
      ),
    );
    attempt.on("error", (error) =>
      console.error(JSON.stringify({ event: "voice-error", error: String(error) })),
    );
    await entersState(attempt, VoiceConnectionStatus.Ready, 30_000);
    return attempt;
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
