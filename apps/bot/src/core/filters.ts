import type { Actor } from "@tsuki/shared";
import type { Player } from "lavalink-client";
import { ServiceError } from "./errors.ts";

/**
 * Audio effects, gated on what the guild's node actually offers.
 *
 * Lavalink reports its enabled filters in `/v4/info`, and an operator can turn
 * any of them off. Applying one the node lacks produces a silent no-op — the
 * request succeeds, the sound does not change, and the member is left tapping
 * a switch that does nothing. So each effect names the Lavalink filter it
 * needs, and the node is asked first.
 */

export type EffectName =
  | "nightcore"
  | "vaporwave"
  | "8d"
  | "karaoke"
  | "tremolo"
  | "vibrato"
  | "lowpass"
  | "mono";

export interface EffectDefinition {
  /** The filter name as Lavalink lists it in /v4/info. */
  requires: string;
  describe: string;
}

export const EFFECTS: Record<EffectName, EffectDefinition> = {
  nightcore: { requires: "timescale", describe: "faster and higher" },
  vaporwave: { requires: "timescale", describe: "slower and lower" },
  "8d": { requires: "rotation", describe: "sound circling the head" },
  karaoke: { requires: "karaoke", describe: "vocals pushed down" },
  tremolo: { requires: "tremolo", describe: "wobbling volume" },
  vibrato: { requires: "vibrato", describe: "wobbling pitch" },
  lowpass: { requires: "lowPass", describe: "highs cut away" },
  mono: { requires: "channelMix", describe: "both channels merged" },
};

export const EQ_PRESETS = [
  "BassboostLow",
  "BassboostMedium",
  "BassboostHigh",
  "BetterMusic",
  "Rock",
  "Classic",
  "Pop",
  "Electronic",
  "FullSound",
  "Gaming",
] as const;

export type EqPreset = (typeof EQ_PRESETS)[number];

function nodeFilters(player: Player): string[] {
  return player.node.info?.filters ?? [];
}

function assertSupported(player: Player, effect: EffectName): void {
  const definition = EFFECTS[effect];
  const available = nodeFilters(player);
  // An empty list means the node did not tell us; let it answer for itself
  // rather than refusing something that may well work.
  if (available.length === 0) return;
  if (available.includes(definition.requires)) return;
  throw new ServiceError(
    "SOURCE_UNSUPPORTED",
    `This server's node has the ${definition.requires} filter turned off, so ${effect} cannot be applied.`,
    { needed: definition.requires, available },
  );
}

export interface FilterState {
  effects: Partial<Record<EffectName, boolean>>;
  speed: number;
  pitch: number;
  rate: number;
  audioOutput: string;
  equalizerApplied: boolean;
  availableOnNode: string[];
}

export function readFilterState(player: Player): FilterState {
  const filters = player.filterManager.filters;
  return {
    effects: {
      nightcore: filters.nightcore,
      vaporwave: filters.vaporwave,
      "8d": filters.rotation,
      karaoke: filters.karaoke,
      tremolo: filters.tremolo,
      vibrato: filters.vibrato,
      lowpass: filters.lowPass,
      mono: filters.audioOutput === "mono",
    },
    speed: player.filterManager.data.timescale?.speed ?? 1,
    pitch: player.filterManager.data.timescale?.pitch ?? 1,
    rate: player.filterManager.data.timescale?.rate ?? 1,
    audioOutput: filters.audioOutput,
    equalizerApplied: player.filterManager.equalizerBands.length > 0,
    availableOnNode: nodeFilters(player),
  };
}

export async function toggleEffect(
  player: Player,
  effect: EffectName,
): Promise<boolean> {
  assertSupported(player, effect);
  const manager = player.filterManager;

  switch (effect) {
    case "nightcore":
      await manager.toggleNightcore();
      return manager.filters.nightcore;
    case "vaporwave":
      await manager.toggleVaporwave();
      return manager.filters.vaporwave;
    case "8d":
      await manager.toggleRotation();
      return manager.filters.rotation;
    case "karaoke":
      await manager.toggleKaraoke();
      return manager.filters.karaoke;
    case "tremolo":
      await manager.toggleTremolo();
      return manager.filters.tremolo;
    case "vibrato":
      await manager.toggleVibrato();
      return manager.filters.vibrato;
    case "lowpass":
      await manager.toggleLowPass();
      return manager.filters.lowPass;
    case "mono": {
      const next = manager.filters.audioOutput === "mono" ? "stereo" : "mono";
      await manager.setAudioOutput(next);
      return next === "mono";
    }
  }
}

export async function applyEqPreset(
  player: Player,
  preset: EqPreset,
): Promise<void> {
  const available = nodeFilters(player);
  if (available.length > 0 && !available.includes("equalizer")) {
    throw new ServiceError(
      "SOURCE_UNSUPPORTED",
      "This server's node has the equalizer turned off.",
      { needed: "equalizer", available },
    );
  }
  await player.filterManager.setEQPreset(preset);
}

export async function setSpeed(player: Player, speed: number): Promise<void> {
  assertRange(speed, 0.25, 3, "Speed");
  await player.filterManager.setSpeed(speed);
}

export async function setPitch(player: Player, pitch: number): Promise<void> {
  assertRange(pitch, 0.25, 3, "Pitch");
  await player.filterManager.setPitch(pitch);
}

export async function resetFilters(player: Player): Promise<void> {
  await player.filterManager.resetFilters();
  await player.filterManager.clearEQ();
}

function assertRange(
  value: number,
  min: number,
  max: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ServiceError(
      "INVALID_INPUT",
      `${label} has to be between ${min} and ${max}.`,
    );
  }
}

/** Re-exported so both adapters describe an effect the same way. */
export function describeEffect(effect: EffectName): string {
  return EFFECTS[effect].describe;
}

export type { Actor };
