import { NextResponse } from "next/server";
import { auth } from "@/auth.ts";
import { bot, BotError } from "@/lib/bot.ts";
import { forwardBody } from "@/lib/forward.ts";

/**
 * The browser's door to the bot.
 *
 * Two things happen here and nowhere else: the signed-in member's Discord id
 * is attached to the request, and anything the browser sent under `userId` is
 * discarded. Without that second half the dashboard would be a way to act as
 * somebody else — the bot trusts this proxy precisely because the proxy does
 * not trust the page.
 */

const ALLOWED_POST = new Set([
  "play",
  "search",
  "pause",
  "resume",
  "previous",
  "skip",
  "stop",
  "shuffle",
  "clear",
  "volume",
  "seek",
  "repeat",
  "queue/remove",
  "queue/move",
  "filters/toggle",
  "filters/eq",
  "filters/timescale",
  "filters/reset",
  "nodes",
  "playlists",
]);

function isAllowedPost(action: string): boolean {
  if (ALLOWED_POST.has(action)) return true;
  // Paths that carry a name: /nodes/<name>/enabled, /playlists/<name>/load
  if (/^nodes\/[^/]+\/enabled$/.test(action)) return true;
  if (/^playlists\/[^/]+\/load$/.test(action)) return true;
  return false;
}

async function resolveActor(): Promise<string | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return userId ?? null;
}

function fail(error: unknown): NextResponse {
  if (error instanceof BotError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}

type Params = { params: Promise<{ guildId: string; action: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await resolveActor();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { guildId, action } = await params;
  const path = action.join("/");

  try {
    switch (path) {
      case "player":
        return NextResponse.json(await bot.player(guildId));
      case "settings":
        return NextResponse.json(await bot.settings(guildId));
      case "nodes":
        return NextResponse.json(await bot.nodes(guildId));
      case "playlists":
        return NextResponse.json(await bot.playlists(guildId));
      case "filters":
        return NextResponse.json(await bot.filters(guildId));
      case "lyrics":
        return NextResponse.json(await bot.lyrics(guildId));
      case "sponsorblock":
        return NextResponse.json(await bot.sponsorblock(guildId));
      case "roles":
        return NextResponse.json(await bot.roles(guildId));
      case "channels":
        return NextResponse.json(await bot.channels(guildId));
      default:
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "No such view." } },
          { status: 404 },
        );
    }
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const userId = await resolveActor();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { guildId, action } = await params;
  const path = action.join("/");
  if (!isAllowedPost(path)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such action." } },
      { status: 404 },
    );
  }

  // Whatever the page claimed about who it is, the session decides.
  const body = forwardBody(await request.json().catch(() => ({})), userId);

  try {
    return NextResponse.json(
      await bot.action(guildId, path, body),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await resolveActor();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { guildId, action } = await params;
  const path = action.join("/");
  if (path !== "settings") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such action." } },
      { status: 404 },
    );
  }
  const body = forwardBody(await request.json().catch(() => ({})), userId);

  try {
    return NextResponse.json(
      await bot.patch(guildId, "settings", body),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const userId = await resolveActor();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { guildId, action } = await params;
  const path = action.join("/");
  if (!/^channel-rules\/\d+$/.test(path) && path !== "sponsorblock") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such action." } },
      { status: 404 },
    );
  }
  const body = forwardBody(await request.json().catch(() => ({})), userId);
  try {
    return NextResponse.json(await bot.put(guildId, path, body));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await resolveActor();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { guildId, action } = await params;
  const path = action.join("/");
  if (!/^(nodes|playlists)\/[^/]+$/.test(path) && path !== "sponsorblock") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such action." } },
      { status: 404 },
    );
  }

  try {
    return NextResponse.json(await bot.remove(guildId, path, { userId }));
  } catch (error) {
    return fail(error);
  }
}
