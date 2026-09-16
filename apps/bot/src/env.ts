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

function once<T>(read: () => T): () => T {
  let value: T;
  let done = false;
  return () => {
    if (!done) {
      value = read();
      done = true;
    }
    return value;
  };
}

const encryptionKey = once(() => loadSecretKey(required("ENCRYPTION_KEY")));

/**
 * Read on use, not on import.
 *
 * Importing a module must not demand a secret: the parity test builds the HTTP
 * app to read its route table, and a tool that only wants the command list
 * should not need a Discord token to load one. Reading eagerly turned both of
 * those into "DISCORD_TOKEN is required" from a file that never touches it.
 */
export const env = {
  get discordToken(): string {
    return required("DISCORD_TOKEN");
  },
  get discordClientId(): string {
    return required("DISCORD_CLIENT_ID");
  },
  get encryptionKey(): Buffer {
    return encryptionKey();
  },
  get apiToken(): string {
    return required("BOT_API_TOKEN");
  },
  get apiPort(): number {
    return int("BOT_API_PORT", 3856);
  },
  get apiHost(): string {
    return process.env["BOT_API_HOST"] ?? "127.0.0.1";
  },
  get allowPrivateNodeHosts(): boolean {
    return bool("ALLOW_PRIVATE_NODE_HOSTS", false);
  },

  /**
   * A node the instance offers to guilds that have configured none. The public
   * instance leaves this empty on purpose — bringing your own node is the
   * point — but a self-hoster almost always wants one.
   */
  get defaultNode(): {
    host: string;
    port: number;
    password: string;
    secure: boolean;
  } | null {
    const host = optional("DEFAULT_NODE_HOST");
    const password = optional("DEFAULT_NODE_PASSWORD");
    if (!host || !password) return null;
    return {
      host,
      port: int("DEFAULT_NODE_PORT", 2333),
      password,
      secure: bool("DEFAULT_NODE_SECURE", false),
    };
  },

  get nodeEnv(): string {
    return process.env["NODE_ENV"] ?? "development";
  },
  get logLevel(): string {
    return process.env["LOG_LEVEL"] ?? "info";
  },
};

export type Env = typeof env;
