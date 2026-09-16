import { loadSecretKey } from "@tsuki/shared";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required — see .env.example`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function int(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

const defaultNodeHost = optional("DEFAULT_NODE_HOST");
const defaultNodePassword = optional("DEFAULT_NODE_PASSWORD");

export const env = {
  discordToken: required("DISCORD_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),

  encryptionKey: loadSecretKey(required("ENCRYPTION_KEY")),

  apiToken: required("BOT_API_TOKEN"),
  apiPort: int("BOT_API_PORT", 3856),
  apiHost: process.env["BOT_API_HOST"] ?? "127.0.0.1",

  allowPrivateNodeHosts: bool("ALLOW_PRIVATE_NODE_HOSTS", false),

  /**
   * A node the instance offers to guilds that have configured none. The public
   * instance leaves this empty on purpose — bringing your own node is the
   * point — but a self-hoster almost always wants one.
   */
  defaultNode:
    defaultNodeHost && defaultNodePassword
      ? {
          host: defaultNodeHost,
          port: int("DEFAULT_NODE_PORT", 2333),
          password: defaultNodePassword,
          secure: bool("DEFAULT_NODE_SECURE", false),
        }
      : null,

  nodeEnv: process.env["NODE_ENV"] ?? "development",
  logLevel: process.env["LOG_LEVEL"] ?? "info",
} as const;

export type Env = typeof env;
