import type { Player } from "lavalink-client";
import { ServiceError } from "./errors.ts";

/**
 * Skipping sponsor reads and intros on YouTube tracks, done by a plugin on the
 * guild's node. Like lyrics, most nodes do not have it, so a missing plugin is
 * named rather than answered with a silent success.
 */

export const SEGMENT_CATEGORIES = [
  "sponsor",
  "selfpromo",
  "interaction",
  "intro",
  "outro",
  "preview",
  "music_offtopic",
  "filler",
] as const;

export type SegmentCategory = (typeof SEGMENT_CATEGORIES)[number];

function assertPlugin(player: Player): void {
  const plugins = player.node.info?.plugins ?? [];
  if (plugins.some((plugin) => plugin.name.toLowerCase().includes("sponsorblock"))) {
    return;
  }
  throw new ServiceError(
    "SOURCE_UNSUPPORTED",
    "This server's audio node has no SponsorBlock plugin. Install `sponsorblock-plugin` on it and Tsuki will use it.",
    { needed: "sponsorblock-plugin" },
  );
}

export function parseCategories(input: string[]): SegmentCategory[] {
  const wanted = [...new Set(input.map((value) => value.trim().toLowerCase()))];
  const unknown = wanted.filter(
    (value) => !(SEGMENT_CATEGORIES as readonly string[]).includes(value),
  );
  if (unknown.length > 0) {
    throw new ServiceError(
      "INVALID_INPUT",
      `Unknown segment ${unknown.length === 1 ? "category" : "categories"}: ${unknown.join(", ")}. Choose from ${SEGMENT_CATEGORIES.join(", ")}.`,
    );
  }
  if (wanted.length === 0) {
    throw new ServiceError("INVALID_INPUT", "Pick at least one category.");
  }
  return wanted as SegmentCategory[];
}

export async function readSegments(player: Player): Promise<string[]> {
  assertPlugin(player);
  return (await player.getSponsorBlock()) as string[];
}

export async function setSegments(
  player: Player,
  categories: SegmentCategory[],
): Promise<void> {
  assertPlugin(player);
  await player.setSponsorBlock(categories);
}

export async function clearSegments(player: Player): Promise<void> {
  assertPlugin(player);
  await player.deleteSponsorBlock();
}
