import type { Command } from "./types.ts";
import { playbackCommands } from "./playback.ts";
import { configCommands } from "./config.ts";
import { effectCommands } from "./effects.ts";
import { libraryCommands } from "./library.ts";

export const commands: Command[] = [
  ...playbackCommands,
  ...libraryCommands,
  ...effectCommands,
  ...configCommands,
];

export const commandsByName = new Map(
  commands.map((command) => [command.data.name, command]),
);

export { handleModal } from "./config.ts";
export { handleSearchSelect } from "./library.ts";
export { handleQueuePage } from "./playback.ts";
export type { Command, CommandContext } from "./types.ts";
