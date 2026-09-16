import type { Command } from "./types.ts";
import { playbackCommands } from "./playback.ts";
import { configCommands } from "./config.ts";

export const commands: Command[] = [...playbackCommands, ...configCommands];

export const commandsByName = new Map(
  commands.map((command) => [command.data.name, command]),
);

export { handleModal } from "./config.ts";
export type { Command, CommandContext } from "./types.ts";
