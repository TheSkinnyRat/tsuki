import { SlashCommandBuilder } from "discord.js";
import type { RepeatMode } from "@tsuki/shared";
import { ServiceError } from "../../core/errors.ts";
import { actorFromInteraction } from "../actor.ts";
import {
  addedEmbed,
  formatDuration,
  noticeEmbed,
  nowPlayingEmbed,
  queueEmbed,
} from "../embeds.ts";
import type { Command } from "./types.ts";

/** "1:23", "83", "1h02m" → milliseconds. */
export function parseTimestamp(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (/^\d+$/.test(text)) return Number(text) * 1000;

  const colon = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const [, h, m, s] = colon;
    return ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(s)) * 1000;
  }

  const units = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (units && (units[1] || units[2] || units[3])) {
    const [, h, m, s] = units;
    return (
      (Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)) * 1000
    );
  }
  return null;
}

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Queue a link or a search term")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("A link, or something to search for")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("next")
        .setDescription("Put it at the front of the queue"),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const result = await players.enqueue(
      actor,
      interaction.options.getString("query", true),
      {
        textChannelId: interaction.channelId,
        playNext: interaction.options.getBoolean("next") ?? false,
      },
    );
    await interaction.editReply({
      embeds: [
        addedEmbed(result.added, result.playlistName, result.positionInQueue),
      ],
    });
  },
};

export const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track")
    .addIntegerOption((option) =>
      option
        .setName("to")
        .setDescription("Skip forward to this queue position")
        .setMinValue(1),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const to = interaction.options.getInteger("to");
    const next = await players.skip(actor, to ?? undefined);
    await interaction.editReply({
      embeds: [
        noticeEmbed(
          next
            ? `Skipped. Now playing **${next.title}**.`
            : "Skipped. Nothing left in the queue.",
        ),
      ],
    });
  },
};

export const pauseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause playback"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    await players.pause(actorFromInteraction(interaction));
    await interaction.editReply({ embeds: [noticeEmbed("Paused.")] });
  },
};

export const resumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume playback"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    await players.resume(actorFromInteraction(interaction));
    await interaction.editReply({ embeds: [noticeEmbed("Playing again.")] });
  },
};

export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop, clear the queue and leave"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    await players.stop(actorFromInteraction(interaction));
    await interaction.editReply({ embeds: [noticeEmbed("Stopped.")] });
  },
};

export const nowPlayingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show what is playing"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const snapshot = await players.snapshot(actor.guildId);
    await interaction.editReply({ embeds: [nowPlayingEmbed(snapshot)] });
  },
};

export const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the queue")
    .addIntegerOption((option) =>
      option.setName("page").setDescription("Page number").setMinValue(1),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const snapshot = await players.snapshot(actor.guildId);
    await interaction.editReply({
      embeds: [queueEmbed(snapshot, interaction.options.getInteger("page") ?? 1)],
    });
  },
};

export const volumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the playback volume")
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("0 to 200")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const level = interaction.options.getInteger("level", true);
    await players.setVolume(actorFromInteraction(interaction), level);
    await interaction.editReply({
      embeds: [noticeEmbed(`Volume set to ${level}.`)],
    });
  },
};

export const loopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Repeat the track, the queue, or nothing")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("What to repeat")
        .setRequired(true)
        .addChoices(
          { name: "off", value: "off" },
          { name: "track", value: "track" },
          { name: "queue", value: "queue" },
        ),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const mode = interaction.options.getString("mode", true) as RepeatMode;
    await players.setRepeatMode(actorFromInteraction(interaction), mode);
    await interaction.editReply({
      embeds: [
        noticeEmbed(
          mode === "off" ? "Repeat off." : `Repeating the ${mode}.`,
        ),
      ],
    });
  },
};

export const shuffleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the queue"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    await players.shuffle(actorFromInteraction(interaction));
    await interaction.editReply({ embeds: [noticeEmbed("Queue shuffled.")] });
  },
};

export const clearCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Empty the queue without stopping the current track"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const removed = await players.clearQueue(actorFromInteraction(interaction));
    await interaction.editReply({
      embeds: [noticeEmbed(`Removed ${removed} tracks from the queue.`)],
    });
  },
};

export const removeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove one track from the queue")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Its number in /queue")
        .setRequired(true)
        .setMinValue(1),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const position = interaction.options.getInteger("position", true);
    const removed = await players.removeAt(
      actorFromInteraction(interaction),
      position - 1,
    );
    await interaction.editReply({
      embeds: [noticeEmbed(`Removed **${removed.title}**.`)],
    });
  },
};

export const moveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("move")
    .setDescription("Move a track to another place in the queue")
    .addIntegerOption((option) =>
      option
        .setName("from")
        .setDescription("Current position")
        .setRequired(true)
        .setMinValue(1),
    )
    .addIntegerOption((option) =>
      option
        .setName("to")
        .setDescription("New position")
        .setRequired(true)
        .setMinValue(1),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const from = interaction.options.getInteger("from", true);
    const to = interaction.options.getInteger("to", true);
    const track = await players.move(
      actorFromInteraction(interaction),
      from - 1,
      to - 1,
    );
    await interaction.editReply({
      embeds: [noticeEmbed(`Moved **${track.title}** to #${to}.`)],
    });
  },
};

export const seekCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Jump to a position in the current track")
    .addStringOption((option) =>
      option
        .setName("to")
        .setDescription("1:23, 83, or 1h02m")
        .setRequired(true),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const raw = interaction.options.getString("to", true);
    const ms = parseTimestamp(raw);
    if (ms === null) {
      throw new ServiceError(
        "INVALID_INPUT",
        `"${raw}" is not a position. Try 1:23, 83, or 1h02m.`,
      );
    }
    await players.seek(actorFromInteraction(interaction), ms);
    await interaction.editReply({
      embeds: [noticeEmbed(`Jumped to ${formatDuration(ms)}.`)],
    });
  },
};

export const joinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Bring Tsuki into your voice channel"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    await players.joinVoice(
      actorFromInteraction(interaction),
      interaction.channelId,
    );
    await interaction.editReply({ embeds: [noticeEmbed("Joined.")] });
  },
};

export const leaveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Send Tsuki out of the voice channel"),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    await players.stop(actorFromInteraction(interaction), true);
    await interaction.editReply({ embeds: [noticeEmbed("Left the channel.")] });
  },
};

export const playbackCommands: Command[] = [
  playCommand,
  skipCommand,
  pauseCommand,
  resumeCommand,
  stopCommand,
  nowPlayingCommand,
  queueCommand,
  volumeCommand,
  loopCommand,
  shuffleCommand,
  clearCommand,
  removeCommand,
  moveCommand,
  seekCommand,
  joinCommand,
  leaveCommand,
];
