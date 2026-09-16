import { serve, type ServerType } from "@hono/node-server";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { PermissionsBitField, type Client } from "discord.js";
import type { LavalinkManager } from "lavalink-client";
import { safeEqual, type RepeatMode } from "@tsuki/shared";
import { z } from "zod";
import { env } from "../env.ts";
import { createLogger } from "../logger.ts";
import { isServiceError, ServiceError, statusForCode } from "../core/errors.ts";
import type { PlayerService } from "../core/player.ts";
import {
  getGuildSettings,
  listChannelRules,
  setChannelRule,
  updateGuildSettings,
} from "../core/guilds.ts";
import { assertCan } from "../core/permissions.ts";
import { addNode, listNodes, removeNode, setNodeEnabled } from "../core/nodes.ts";
import { EFFECTS, EQ_PRESETS, type EffectName, type EqPreset } from "../core/filters.ts";
import { listPlaylists } from "../core/playlists.ts";
import { actorFromWeb } from "./actor.ts";

const log = createLogger("api");

export interface ApiDeps {
  players: PlayerService;
  manager: LavalinkManager;
  client: Client;
}

const actorBody = z.object({ userId: z.string().min(1) });

export function createApi(deps: ApiDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  // Everything below is the dashboard's door, and it is not on the internet:
  // the server binds loopback and the shared token is checked in constant time.
  app.use("/api/*", async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !safeEqual(token, env.apiToken)) {
      return c.json({ error: { code: "UNAUTHORISED" } }, 401);
    }
    await next();
  });

  app.onError((error, c) => {
    if (isServiceError(error)) {
      return c.json(
        { error: error.toJSON() },
        statusForCode(error.code) as ContentfulStatusCode,
      );
    }
    if (error instanceof z.ZodError) {
      return c.json(
        { error: { code: "INVALID_INPUT", message: "Malformed request." } },
        400,
      );
    }
    log.error("unhandled api error", error);
    return c.json({ error: { code: "INTERNAL", message: "Internal error." } }, 500);
  });

  /**
   * Servers this member and Tsuki are both in.
   *
   * Asked of the bot rather than of Discord's OAuth guild list, because that
   * list includes every server the member is in — most of which do not have
   * Tsuki — and says nothing about whether the bot is there. This answers the
   * question the picker actually has.
   */
  app.get("/api/members/:userId/guilds", async (c) => {
    const userId = c.req.param("userId");
    const out: Array<{
      id: string;
      name: string;
      icon: string | null;
      canManage: boolean;
    }> = [];

    for (const [guildId, guild] of deps.client.guilds.cache) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      out.push({
        id: guildId,
        name: guild.name,
        icon: guild.icon,
        canManage: member.permissions.has(
          PermissionsBitField.Flags.ManageGuild,
        ),
      });
    }
    return c.json(out);
  });

  const guild = app.basePath("/api/guilds/:guildId");

  async function actorOf(c: {
    req: { param: (k: string) => string | undefined; json: () => Promise<unknown> };
  }) {
    const guildId = c.req.param("guildId");
    if (!guildId) throw new ServiceError("INVALID_INPUT", "Missing guild.");
    const body = actorBody.parse(await c.req.json());
    return actorFromWeb(deps.client, guildId, body.userId);
  }

  // ------------------------------------------------------------- reading

  guild.get("/player", async (c) => {
    const guildId = c.req.param("guildId")!;
    return c.json(await deps.players.snapshot(guildId));
  });

  guild.get("/settings", async (c) => {
    const guildId = c.req.param("guildId")!;
    return c.json({
      settings: await getGuildSettings(guildId),
      channelRules: await listChannelRules(guildId),
    });
  });

  // Discord's own pickers do these jobs inside /settings; the dashboard has no
  // picker to borrow, so it asks for the lists instead.
  guild.get("/roles", (c) => {
    const target = deps.client.guilds.cache.get(c.req.param("guildId")!);
    if (!target) throw new ServiceError("NOT_FOUND", "Tsuki is not in that server.");
    const roles = [...target.roles.cache.values()]
      .filter((role) => role.id !== target.id && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({ id: role.id, name: role.name, color: role.hexColor }));
    return c.json(roles);
  });

  guild.get("/channels", (c) => {
    const target = deps.client.guilds.cache.get(c.req.param("guildId")!);
    if (!target) throw new ServiceError("NOT_FOUND", "Tsuki is not in that server.");
    const channels = [...target.channels.cache.values()]
      .filter((channel) => channel.isVoiceBased())
      .sort((a, b) => ("position" in a && "position" in b ? a.position - b.position : 0))
      .map((channel) => ({ id: channel.id, name: channel.name }));
    return c.json(channels);
  });

  guild.get("/nodes", async (c) => {
    const guildId = c.req.param("guildId")!;
    return c.json(await listNodes(deps.manager, guildId));
  });

  // ------------------------------------------------------------ playback

  guild.post("/search", async (c) => {
    const body = actorBody.extend({ query: z.string().min(1) }).parse(
      await c.req.json(),
    );
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json(await deps.players.search(actor, body.query));
  });

  guild.post("/play", async (c) => {
    const body = actorBody
      .extend({
        query: z.string().min(1),
        next: z.boolean().optional(),
        textChannelId: z.string().nullish(),
      })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    const result = await deps.players.enqueue(actor, body.query, {
      playNext: body.next ?? false,
      textChannelId: body.textChannelId ?? null,
    });
    return c.json(result);
  });

  guild.post("/previous", async (c) => {
    return c.json(await deps.players.previous(await actorOf(c)));
  });

  guild.post("/pause", async (c) => {
    await deps.players.pause(await actorOf(c));
    return c.json({ ok: true });
  });

  guild.post("/resume", async (c) => {
    await deps.players.resume(await actorOf(c));
    return c.json({ ok: true });
  });

  guild.post("/skip", async (c) => {
    const body = actorBody.extend({ to: z.number().int().optional() }).parse(
      await c.req.json(),
    );
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json({ next: await deps.players.skip(actor, body.to) });
  });

  guild.post("/stop", async (c) => {
    await deps.players.stop(await actorOf(c));
    return c.json({ ok: true });
  });

  guild.post("/shuffle", async (c) => {
    await deps.players.shuffle(await actorOf(c));
    return c.json({ ok: true });
  });

  guild.post("/clear", async (c) => {
    const removed = await deps.players.clearQueue(await actorOf(c));
    return c.json({ removed });
  });

  guild.post("/volume", async (c) => {
    const body = actorBody
      .extend({ volume: z.number().int().min(0).max(200) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    await deps.players.setVolume(actor, body.volume);
    return c.json({ ok: true });
  });

  guild.post("/seek", async (c) => {
    const body = actorBody
      .extend({ positionMs: z.number().int().min(0) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    await deps.players.seek(actor, body.positionMs);
    return c.json({ ok: true });
  });

  guild.post("/repeat", async (c) => {
    const body = actorBody
      .extend({ mode: z.enum(["off", "track", "queue"]) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    await deps.players.setRepeatMode(actor, body.mode as RepeatMode);
    return c.json({ ok: true });
  });

  guild.post("/queue/remove", async (c) => {
    const body = actorBody
      .extend({ index: z.number().int().min(0) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json({ removed: await deps.players.removeAt(actor, body.index) });
  });

  guild.post("/queue/move", async (c) => {
    const body = actorBody
      .extend({ from: z.number().int().min(0), to: z.number().int().min(0) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json({ moved: await deps.players.move(actor, body.from, body.to) });
  });

  guild.get("/lyrics", async (c) =>
    c.json(await deps.players.lyrics(c.req.param("guildId")!)),
  );

  guild.get("/sponsorblock", async (c) =>
    c.json({ categories: await deps.players.sponsorBlock(c.req.param("guildId")!) }),
  );

  guild.put("/sponsorblock", async (c) => {
    const body = actorBody
      .extend({ categories: z.array(z.string()).min(1) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(deps.client, c.req.param("guildId")!, body.userId);
    return c.json({ categories: await deps.players.setSponsorBlock(actor, body.categories) });
  });

  guild.delete("/sponsorblock", async (c) => {
    await deps.players.clearSponsorBlock(await actorOf(c));
    return c.json({ ok: true });
  });

  // ------------------------------------------------------------- filters

  guild.get("/filters", (c) =>
    c.json(deps.players.filterState(c.req.param("guildId")!)),
  );

  guild.post("/filters/toggle", async (c) => {
    const body = actorBody
      .extend({
        effect: z.enum(Object.keys(EFFECTS) as [EffectName, ...EffectName[]]),
      })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json({ on: await deps.players.toggleFilter(actor, body.effect) });
  });

  guild.post("/filters/eq", async (c) => {
    const body = actorBody
      .extend({ preset: z.enum(EQ_PRESETS as unknown as [EqPreset, ...EqPreset[]]) })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    await deps.players.setEqualizer(actor, body.preset);
    return c.json({ ok: true });
  });

  guild.post("/filters/timescale", async (c) => {
    const body = actorBody
      .extend({
        speed: z.number().min(0.25).max(3).optional(),
        pitch: z.number().min(0.25).max(3).optional(),
      })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    if (body.speed !== undefined) await deps.players.setSpeed(actor, body.speed);
    if (body.pitch !== undefined) await deps.players.setPitch(actor, body.pitch);
    return c.json({ ok: true });
  });

  guild.post("/filters/reset", async (c) => {
    await deps.players.clearFilters(await actorOf(c));
    return c.json({ ok: true });
  });

  // ----------------------------------------------------------- playlists

  guild.get("/playlists", async (c) =>
    c.json(await listPlaylists(c.req.param("guildId")!)),
  );

  guild.post("/playlists", async (c) => {
    const body = actorBody
      .extend({
        name: z.string().min(1),
        description: z.string().optional(),
      })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json(
      await deps.players.savePlaylistFromQueue(
        actor,
        body.name,
        body.description,
      ),
    );
  });

  guild.post("/playlists/:name/load", async (c) => {
    const body = actorBody
      .extend({ shuffle: z.boolean().optional() })
      .parse(await c.req.json());
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    return c.json(
      await deps.players.loadPlaylist(actor, c.req.param("name")!, {
        shuffle: body.shuffle ?? false,
      }),
    );
  });

  guild.delete("/playlists/:name", async (c) => {
    const actor = await actorOf(c);
    await deps.players.removePlaylist(actor, c.req.param("name")!);
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------- management

  guild.patch("/settings", async (c) => {
    const body = actorBody
      .extend({
        defaultVolume: z.number().int().min(0).max(200).optional(),
        stay247: z.boolean().optional(),
        autoplay: z.boolean().optional(),
        djMode: z.boolean().optional(),
        djRoleId: z.string().nullable().optional(),
      })
      .parse(await c.req.json());
    const { userId, ...patch } = body;
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      userId,
    );
    assertCan("manage", await deps.players.buildContext(actor));
    return c.json(await updateGuildSettings(actor.guildId, patch));
  });

  guild.put("/channel-rules/:channelId", async (c) => {
    const body = actorBody
      .extend({
        djRequired: z.boolean().optional(),
        canRequest: z.boolean().optional(),
        locked: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const { userId, ...patch } = body;
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      userId,
    );
    assertCan("manage", await deps.players.buildContext(actor));
    return c.json(
      await setChannelRule(actor.guildId, c.req.param("channelId")!, patch),
    );
  });

  guild.post("/nodes", async (c) => {
    const body = actorBody
      .extend({
        name: z.string().min(1),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        secure: z.boolean().default(false),
        password: z.string().min(1),
        priority: z.number().int().optional(),
      })
      .parse(await c.req.json());
    const { userId, ...input } = body;
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      userId,
    );
    assertCan("manage", await deps.players.buildContext(actor));
    return c.json(await addNode(actor.guildId, input));
  });

  guild.delete("/nodes/:name", async (c) => {
    const actor = await actorOf(c);
    assertCan("manage", await deps.players.buildContext(actor));
    await removeNode(actor.guildId, c.req.param("name")!);
    return c.json({ ok: true });
  });

  guild.post("/nodes/:name/enabled", async (c) => {
    const body = actorBody.extend({ enabled: z.boolean() }).parse(
      await c.req.json(),
    );
    const actor = await actorFromWeb(
      deps.client,
      c.req.param("guildId")!,
      body.userId,
    );
    assertCan("manage", await deps.players.buildContext(actor));
    await setNodeEnabled(actor.guildId, c.req.param("name")!, body.enabled);
    return c.json({ ok: true });
  });

  return app;
}

export function startApiServer(deps: ApiDeps): { close: () => void } {
  const app = createApi(deps);
  let server: ServerType | null = null;
  server = serve(
    { fetch: app.fetch, port: env.apiPort, hostname: env.apiHost },
    (info) => log.info(`internal api on ${env.apiHost}:${info.port}`),
  );
  return {
    close: () => {
      server?.close();
    },
  };
}
