/**
 * The body the proxy forwards to the bot for a signed-in member.
 *
 * Whatever the page put under `userId` is dropped and the session's id is
 * used. The bot trusts this proxy to say who is asking precisely because the
 * proxy never lets the page say it — so this one function is the difference
 * between a dashboard and a way to act as somebody else.
 */
export function forwardBody(
  body: unknown,
  sessionUserId: string,
): Record<string, unknown> {
  const copy: Record<string, unknown> =
    body && typeof body === "object" && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {};
  delete copy["userId"];
  return { ...copy, userId: sessionUserId };
}
