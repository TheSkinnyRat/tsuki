/**
 * The "Add to Discord" link, built from this instance's own application id so
 * a self-hosted copy invites its own bot, not the public one.
 *
 * The permissions are what Tsuki uses and nothing more: View Channels, Send
 * Messages, Embed Links, Read Message History (to answer where it was asked),
 * Connect and Speak (to play). Adding a feature that needs another permission
 * means adding its bit here, or servers invited afterwards will lack it.
 */
const PERMISSIONS =
  (1n << 10n) | // View Channels
  (1n << 11n) | // Send Messages
  (1n << 14n) | // Embed Links
  (1n << 16n) | // Read Message History
  (1n << 20n) | // Connect
  (1n << 21n); // Speak

export function inviteUrl(clientId: string | undefined): string | null {
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: PERMISSIONS.toString(),
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}
