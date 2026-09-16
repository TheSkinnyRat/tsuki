function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The dashboard needs it — see .env.example.`,
    );
  }
  return value;
}

/**
 * Read lazily.
 *
 * A build runs this module, and a build machine has no secrets. Reading eagerly
 * turns a missing value into a failure at import time, which surfaces as the
 * whole page failing to compile rather than as the one thing that is actually
 * missing.
 */
export const serverEnv = {
  get botApiUrl(): string {
    return (
      process.env["BOT_API_URL"] ??
      `http://${process.env["BOT_API_HOST"] ?? "127.0.0.1"}:${process.env["BOT_API_PORT"] ?? "3856"}`
    );
  },
  get botApiToken(): string {
    return required("BOT_API_TOKEN");
  },
  get discordClientId(): string {
    return required("DISCORD_CLIENT_ID");
  },
  get discordClientSecret(): string {
    return required("DISCORD_CLIENT_SECRET");
  },
};
