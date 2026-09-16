import {
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { listPlaylists } from "../../core/playlists.ts";
import { actorFromInteraction } from "../actor.ts";
import { addedEmbed, formatDuration, noticeEmbed } from "../embeds.ts";
import type { Command, CommandContext } from "./types.ts";

export const SEARCH_SELECT_ID = "tsuki:search-pick";

export const searchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search, then pick which result to queue")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("What to search for")
        .setRequired(true),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const query = interaction.options.getString("query", true);
    const result = await players.search(actor, query);

    const tracks = result.tracks.slice(0, 20);
    if (tracks.length === 0) {
      await interaction.editReply({
        embeds: [noticeEmbed(`Nothing found for "${query}".`)],
      });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(SEARCH_SELECT_ID)
      .setPlaceholder("Pick a track")
      .setMinValues(1)
      .setMaxValues(Math.min(5, tracks.length))
      .addOptions(
        tracks.map((track, index) =>
          new StringSelectMenuOptionBuilder()
            // The encoded blob can exceed a select value's 100-character
            // limit, so the index is the value and the list is re-searched
            // when the choice comes back.
            .setValue(`${index}`)
            .setLabel(track.title.slice(0, 100))
            .setDescription(
              `${track.author} · ${track.isStream ? "live" : formatDuration(track.lengthMs)}`.slice(
                0,
                100,
              ),
            ),
        ),
      );

    await interaction.editReply({
      embeds: [
        noticeEmbed(
          `**${tracks.length}** results for "${query}". Pick up to five.`,
        ),
      ],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      ],
    });

    // The query is kept on the message so the follow-up can reproduce the
    // same result list without a cache that would not survive a restart.
    searchQueries.set(interaction.id, query);
    setTimeout(() => searchQueries.delete(interaction.id), 15 * 60_000);
  },
};

/** Query text per search message, so a pick can resolve back to a track. */
const searchQueries = new Map<string, string>();

export async function handleSearchSelect(
  interaction: StringSelectMenuInteraction,
  context: CommandContext,
): Promise<boolean> {
  if (interaction.customId !== SEARCH_SELECT_ID) return false;
  if (!interaction.inGuild() || !interaction.guildId) return true;

  await interaction.deferReply();

  const sourceId = interaction.message.interactionMetadata?.id ?? "";
  const query = searchQueries.get(sourceId);
  if (!query) {
    await interaction.editReply({
      embeds: [
        noticeEmbed(
          "That search is too old to pick from. Run `/search` again.",
        ),
      ],
    });
    return true;
  }

  const actor = actorFromInteraction(interaction);
  const result = await context.players.search(actor, query);
  const picked = interaction.values
    .map((value) => result.tracks[Number(value)])
    .filter((track): track is NonNullable<typeof track> => Boolean(track));

  if (picked.length === 0) {
    await interaction.editReply({
      embeds: [noticeEmbed("Those results have changed. Search again.")],
    });
    return true;
  }

  let queued = 0;
  for (const track of picked) {
    if (!track.uri) continue;
    await context.players.enqueue(actor, track.uri, {
      textChannelId: interaction.channelId,
    });
    queued += 1;
  }

  await interaction.editReply({
    embeds: [
      queued === 1 && picked[0]
        ? addedEmbed([picked[0]], null, 1)
        : noticeEmbed(`Queued ${queued} tracks.`),
    ],
  });
  return true;
}

export const playlistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Playlists saved on this server")
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Show the saved playlists"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("save")
        .setDescription("Save what is playing and queued")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("What to call it")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option.setName("description").setDescription("Optional note"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("load")
        .setDescription("Queue a saved playlist")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Which playlist")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addBooleanOption((option) =>
          option.setName("shuffle").setDescription("Shuffle it on the way in"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a playlist you saved")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Which playlist")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const playlists = await listPlaylists(actor.guildId);
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            playlists.length === 0
              ? "No playlists saved yet. Queue something and run `/playlist save`."
              : playlists
                  .map(
                    (playlist) =>
                      `**${playlist.name}** — ${playlist.trackCount} tracks · \`${formatDuration(playlist.totalLengthMs)}\` · by <@${playlist.createdBy}>`,
                  )
                  .join("\n"),
          ),
        ],
      });
      return;
    }

    const name = interaction.options.getString("name", true);

    if (sub === "save") {
      const saved = await players.savePlaylistFromQueue(
        actor,
        name,
        interaction.options.getString("description") ?? undefined,
      );
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            `Saved **${saved.name}** — ${saved.trackCount} tracks, \`${formatDuration(saved.totalLengthMs)}\`.`,
          ),
        ],
      });
      return;
    }

    if (sub === "load") {
      const result = await players.loadPlaylist(actor, name, {
        shuffle: interaction.options.getBoolean("shuffle") ?? false,
        textChannelId: interaction.channelId,
      });
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            [
              `Queued **${result.queued}** tracks from **${result.playlistName}**.`,
              result.skipped > 0
                ? `${result.skipped} could not be read by this server's node and were left out.`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ],
      });
      return;
    }

    await players.removePlaylist(actor, name);
    await interaction.editReply({
      embeds: [noticeEmbed(`Deleted **${name}**.`)],
    });
  },
};

export const libraryCommands: Command[] = [searchCommand, playlistCommand];
