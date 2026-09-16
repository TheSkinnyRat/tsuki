import { SlashCommandBuilder } from "discord.js";
import {
  EFFECTS,
  EQ_PRESETS,
  type EffectName,
  type EqPreset,
} from "../../core/filters.ts";
import { SEGMENT_CATEGORIES } from "../../core/sponsorblock.ts";
import { actorFromInteraction } from "../actor.ts";
import { noticeEmbed } from "../embeds.ts";
import type { Command } from "./types.ts";

const effectChoices = (Object.keys(EFFECTS) as EffectName[]).map((name) => ({
  name: `${name} — ${EFFECTS[name].describe}`,
  value: name,
}));

export const filterCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Audio effects")
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Turn one effect on or off")
        .addStringOption((option) =>
          option
            .setName("effect")
            .setDescription("Which effect")
            .setRequired(true)
            .addChoices(...effectChoices),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("eq")
        .setDescription("Apply an equaliser preset")
        .addStringOption((option) =>
          option
            .setName("preset")
            .setDescription("Which preset")
            .setRequired(true)
            .addChoices(
              ...EQ_PRESETS.map((preset) => ({ name: preset, value: preset })),
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("speed")
        .setDescription("Play faster or slower without changing pitch")
        .addNumberOption((option) =>
          option
            .setName("value")
            .setDescription("0.25 to 3 — 1 is normal")
            .setRequired(true)
            .setMinValue(0.25)
            .setMaxValue(3),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("pitch")
        .setDescription("Raise or lower pitch without changing speed")
        .addNumberOption((option) =>
          option
            .setName("value")
            .setDescription("0.25 to 3 — 1 is normal")
            .setRequired(true)
            .setMinValue(0.25)
            .setMaxValue(3),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("What is applied right now"),
    )
    .addSubcommand((sub) =>
      sub.setName("reset").setDescription("Clear every effect"),
    ),

  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === "show") {
      const state = players.filterState(actor.guildId);
      const on = Object.entries(state.effects)
        .filter(([, active]) => active)
        .map(([name]) => name);
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            [
              on.length > 0 ? `On: **${on.join(", ")}**` : "No effects are on.",
              `speed ${state.speed.toFixed(2)}× · pitch ${state.pitch.toFixed(2)}× · output ${state.audioOutput}`,
              state.equalizerApplied ? "An equaliser preset is applied." : "",
              state.availableOnNode.length > 0
                ? `This node offers: ${state.availableOnNode.join(", ")}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ],
      });
      return;
    }

    if (sub === "reset") {
      await players.clearFilters(actor);
      await interaction.editReply({
        embeds: [noticeEmbed("Every effect cleared.")],
      });
      return;
    }

    if (sub === "toggle") {
      const effect = interaction.options.getString("effect", true) as EffectName;
      const now = await players.toggleFilter(actor, effect);
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            now
              ? `**${effect}** on — ${EFFECTS[effect].describe}.`
              : `**${effect}** off.`,
          ),
        ],
      });
      return;
    }

    if (sub === "eq") {
      const preset = interaction.options.getString("preset", true) as EqPreset;
      await players.setEqualizer(actor, preset);
      await interaction.editReply({
        embeds: [noticeEmbed(`Equaliser set to **${preset}**.`)],
      });
      return;
    }

    const value = interaction.options.getNumber("value", true);
    if (sub === "speed") {
      await players.setSpeed(actor, value);
      await interaction.editReply({
        embeds: [noticeEmbed(`Speed set to ${value}×.`)],
      });
      return;
    }
    await players.setPitch(actor, value);
    await interaction.editReply({
      embeds: [noticeEmbed(`Pitch set to ${value}×.`)],
    });
  },
};

export const sponsorBlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("sponsorblock")
    .setDescription("Skip sponsor reads and intros (needs the plugin on your node)")
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Which segment types are skipped"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Choose segment types to skip")
        .addStringOption((option) =>
          option
            .setName("categories")
            .setDescription(`Comma-separated: ${SEGMENT_CATEGORIES.join(", ")}`)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("off").setDescription("Stop skipping segments"),
    ),
  async execute(interaction, { players }) {
    await interaction.deferReply();
    const actor = actorFromInteraction(interaction);
    const sub = interaction.options.getSubcommand();
    if (sub === "show") {
      const segments = await players.sponsorBlock(actor.guildId);
      await interaction.editReply({
        embeds: [
          noticeEmbed(
            segments.length > 0
              ? `Skipping: **${segments.join(", ")}**.`
              : "No segments are skipped.",
          ),
        ],
      });
      return;
    }
    if (sub === "off") {
      await players.clearSponsorBlock(actor);
      await interaction.editReply({ embeds: [noticeEmbed("SponsorBlock off.")] });
      return;
    }
    const chosen = await players.setSponsorBlock(
      actor,
      interaction.options.getString("categories", true).split(","),
    );
    await interaction.editReply({
      embeds: [noticeEmbed(`Now skipping **${chosen.join(", ")}**.`)],
    });
  },
};

export const effectCommands: Command[] = [filterCommand, sponsorBlockCommand];
