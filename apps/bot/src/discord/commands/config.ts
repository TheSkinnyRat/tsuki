import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { ServiceError } from "../../core/errors.ts";
import {
  getGuildSettings,
  setChannelRule,
  updateGuildSettings,
} from "../../core/guilds.ts";
import { assertCan } from "../../core/permissions.ts";
import {
  addNode,
  listNodes,
  removeNode,
  setNodeEnabled,
} from "../../core/nodes.ts";
import { actorFromInteraction } from "../actor.ts";
import { nodesEmbed, noticeEmbed } from "../embeds.ts";
import type { Command, CommandContext } from "./types.ts";

export const NODE_MODAL_ID = "tsuki:node-add";

/**
 * Adding a node happens in a modal, not in command options.
 *
 * Discord prints a slash command's arguments into the channel for everyone to
 * read, so a `password:` option would publish the node's password the moment
 * it is used. Modal input is never echoed.
 */
function nodeModal(): ModalBuilder {
  const field = (
    id: string,
    label: string,
    placeholder: string,
    required = true,
  ) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short)
        .setRequired(required),
    );

  return new ModalBuilder()
    .setCustomId(NODE_MODAL_ID)
    .setTitle("Add a Lavalink node")
    .addComponents(
      field("name", "Name", "main"),
      field("host", "Host", "lavalink.example.com"),
      field("port", "Port", "2333"),
      field("password", "Password", "the node's authorization value"),
      field("secure", "HTTPS? (yes/no)", "no", false),
    );
}

async function handleNodeModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const value = (id: string) => interaction.fields.getTextInputValue(id).trim();
  const port = Number.parseInt(value("port"), 10);
  if (Number.isNaN(port)) {
    throw new ServiceError("INVALID_INPUT", "The port has to be a number.");
  }
  const secureRaw = value("secure").toLowerCase();

  const node = await addNode(interaction.guildId, {
    name: value("name"),
    host: value("host"),
    port,
    secure: ["yes", "y", "true", "1", "https"].includes(secureRaw),
    password: value("password"),
  });

  const caps = node.capabilities;
  await interaction.editReply({
    embeds: [
      noticeEmbed(
        [
          `**${node.name}** is connected — Lavalink ${caps?.version ?? "?"}.`,
          caps && caps.sources.length > 0
            ? `It can play from: ${caps.sources.join(", ")}.`
            : "It reported no sources, which means it cannot play anything yet.",
          caps && !caps.sources.includes("youtube")
            ? "\nIt has no YouTube source. Lavalink v4 ships that as a separate plugin — install `youtube-source` on the node if you want YouTube links to work."
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ],
  });
}

export const nodeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("node")
    .setDescription("Manage the Lavalink nodes this server plays through")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a node (opens a form so the password stays private)"),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Show this server's nodes"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Forget a node")
        .addStringOption((option) =>
          option.setName("name").setDescription("Node name").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Use this node again")
        .addStringOption((option) =>
          option.setName("name").setDescription("Node name").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Stop using this node without deleting it")
        .addStringOption((option) =>
          option.setName("name").setDescription("Node name").setRequired(true),
        ),
    ),

  async execute(interaction, { players, manager }) {
    const actor = actorFromInteraction(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      await interaction.deferReply();
      const nodes = await listNodes(manager, actor.guildId);
      await interaction.editReply({ embeds: [nodesEmbed(nodes)] });
      return;
    }

    // Everything else changes configuration.
    const context = await players.buildContext(actor);
    assertCan("manage", context);

    if (sub === "add") {
      await interaction.showModal(nodeModal());
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString("name", true);

    if (sub === "remove") {
      await removeNode(actor.guildId, name);
      await interaction.editReply({
        embeds: [noticeEmbed(`Forgot the node **${name}**.`)],
      });
      return;
    }

    const enabled = sub === "enable";
    await setNodeEnabled(actor.guildId, name, enabled);
    await interaction.editReply({
      embeds: [
        noticeEmbed(`**${name}** is now ${enabled ? "enabled" : "disabled"}.`),
      ],
    });
  },
};

export const settingsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("How Tsuki behaves in this server")
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Show the current settings"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dj")
        .setDescription("Require a role to change playback")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Turn DJ mode on or off")
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option.setName("role").setDescription("The DJ role"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("stay")
        .setDescription("Keep Tsuki in voice when the channel empties")
        .addBooleanOption((option) =>
          option.setName("enabled").setDescription("On or off").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("autoplay")
        .setDescription("Keep playing from this server's history when the queue ends")
        .addBooleanOption((option) =>
          option.setName("enabled").setDescription("On or off").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("volume")
        .setDescription("The volume Tsuki starts at")
        .addIntegerOption((option) =>
          option
            .setName("level")
            .setDescription("0 to 200")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(200),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Rules for one channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel these rules apply to")
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("requests")
            .setDescription("May tracks be queued from here"),
        )
        .addBooleanOption((option) =>
          option.setName("dj-only").setDescription("Require the DJ role here"),
        )
        .addBooleanOption((option) =>
          option
            .setName("locked")
            .setDescription("Only a DJ may start Tsuki here"),
        ),
    ),

  async execute(interaction, { players }) {
    const actor = actorFromInteraction(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === "show") {
      await interaction.deferReply();
      const settings = await getGuildSettings(actor.guildId);
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            [
              `DJ mode: **${settings.djMode ? "on" : "off"}**${settings.djRoleId ? ` (<@&${settings.djRoleId}>)` : ""}`,
              `Stay in voice: **${settings.stay247 ? "on" : "off"}**`,
              `Autoplay: **${settings.autoplay ? "on" : "off"}**`,
              `Starting volume: **${settings.defaultVolume}**`,
            ].join("\n"),
          ),
        ],
      });
      return;
    }

    const context = await players.buildContext(actor);
    assertCan("manage", context);
    await interaction.deferReply();

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      const patch: Record<string, boolean> = {};
      const requests = interaction.options.getBoolean("requests");
      const djOnly = interaction.options.getBoolean("dj-only");
      const locked = interaction.options.getBoolean("locked");
      if (requests !== null) patch["canRequest"] = requests;
      if (djOnly !== null) patch["djRequired"] = djOnly;
      if (locked !== null) patch["locked"] = locked;
      if (Object.keys(patch).length === 0) {
        throw new ServiceError(
          "INVALID_INPUT",
          "Pick at least one rule to change.",
        );
      }
      const rule = await setChannelRule(actor.guildId, channel.id, patch);
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            [
              `Rules for <#${rule.channelId}>:`,
              `requests **${rule.canRequest ? "allowed" : "off"}**`,
              `DJ only **${rule.djRequired ? "yes" : "no"}**`,
              `locked **${rule.locked ? "yes" : "no"}**`,
            ].join("\n"),
          ),
        ],
      });
      return;
    }

    if (sub === "dj") {
      const enabled = interaction.options.getBoolean("enabled", true);
      const role = interaction.options.getRole("role");
      const settings = await updateGuildSettings(actor.guildId, {
        djMode: enabled,
        ...(role ? { djRoleId: role.id } : {}),
      });
      if (enabled && !settings.djRoleId) {
        await interaction.editReply({
          embeds: [
            noticeEmbed(
              "DJ mode is on, but no DJ role is set — until one is, only members with Manage Server can change playback. Run this again with a role.",
            ),
          ],
        });
        return;
      }
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            enabled
              ? `DJ mode on. <@&${settings.djRoleId}> controls playback.`
              : "DJ mode off — anyone in the channel can control playback.",
          ),
        ],
      });
      return;
    }

    if (sub === "stay") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await updateGuildSettings(actor.guildId, { stay247: enabled });
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            enabled
              ? "Tsuki will hold the channel when it empties."
              : "Tsuki will leave when the channel empties.",
          ),
        ],
      });
      return;
    }

    if (sub === "autoplay") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await updateGuildSettings(actor.guildId, { autoplay: enabled });
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            enabled
              ? "Autoplay on — when the queue runs out, Tsuki keeps going from what this server has played before."
              : "Autoplay off.",
          ),
        ],
      });
      return;
    }

    if (sub === "volume") {
      const level = interaction.options.getInteger("level", true);
      await updateGuildSettings(actor.guildId, { defaultVolume: level });
      await interaction.editReply({
        embeds: [noticeEmbed(`Tsuki will start at volume ${level}.`)],
      });
      return;
    }
  },
};

export async function handleModal(
  interaction: ModalSubmitInteraction,
  _context: CommandContext,
): Promise<boolean> {
  if (interaction.customId !== NODE_MODAL_ID) return false;
  await handleNodeModal(interaction);
  return true;
}

export type { ChatInputCommandInteraction };

export const configCommands: Command[] = [nodeCommand, settingsCommand];
