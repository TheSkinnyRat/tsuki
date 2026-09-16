import { test } from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES } from "./capabilities.ts";
import { commands } from "../discord/commands/index.ts";
import { createApi } from "../http/server.ts";

/**
 * The parity gate.
 *
 * It reads the real route table and the real command definitions rather than a
 * description of them, so a route or a command added on one side and forgotten
 * on the other fails here instead of shipping as a dashboard that quietly
 * cannot do something Discord can.
 */

const API_PREFIX = "/api/guilds/:guildId";

function declaredWebRoutes(): Set<string> {
  const out = new Set<string>();
  for (const capability of CAPABILITIES) {
    if (capability.web) {
      out.add(`${capability.web.method} ${capability.web.path}`);
    }
  }
  return out;
}

function actualWebRoutes(): Set<string> {
  // The handlers are never called, so stand-ins are enough to build the app.
  const app = createApi({
    players: {} as never,
    manager: {} as never,
    client: {} as never,
  });
  const out = new Set<string>();
  for (const route of app.routes) {
    if (!route.path.startsWith(API_PREFIX)) continue;
    const path = route.path.slice(API_PREFIX.length) || "/";
    if (route.method === "ALL") continue;
    out.add(`${route.method} ${path}`);
  }
  return out;
}

function declaredDiscord(): Set<string> {
  const out = new Set<string>();
  for (const capability of CAPABILITIES) {
    if (capability.discord) out.add(capability.discord);
  }
  return out;
}

function actualDiscord(): Set<string> {
  const out = new Set<string>();
  for (const command of commands) {
    const json = command.data.toJSON() as {
      name: string;
      options?: Array<{ name: string; type: number }>;
    };
    const subcommands = (json.options ?? []).filter(
      (option) => option.type === 1,
    );
    if (subcommands.length === 0) {
      out.add(json.name);
      continue;
    }
    for (const sub of subcommands) out.add(`${json.name} ${sub.name}`);
  }
  return out;
}

test("every capability's web route exists", () => {
  const actual = actualWebRoutes();
  const missing = [...declaredWebRoutes()].filter(
    (route) => !actual.has(route),
  );
  assert.deepEqual(missing, [], `declared but not routed: ${missing.join(", ")}`);
});

test("every web route is a declared capability", () => {
  // The direction that catches a dashboard-only action: a route added without
  // a slash command has nowhere to be declared without admitting that.
  const declared = declaredWebRoutes();
  const extra = [...actualWebRoutes()].filter((route) => !declared.has(route));
  assert.deepEqual(
    extra,
    [],
    `routed but not declared in CAPABILITIES: ${extra.join(", ")}`,
  );
});

test("every capability's slash command exists", () => {
  const actual = actualDiscord();
  const missing = [...declaredDiscord()].filter((name) => !actual.has(name));
  assert.deepEqual(
    missing,
    [],
    `declared but not registered: ${missing.join(", ")}`,
  );
});

test("every slash command is a declared capability", () => {
  const declared = declaredDiscord();
  const extra = [...actualDiscord()].filter((name) => !declared.has(name));
  assert.deepEqual(
    extra,
    [],
    `registered but not declared in CAPABILITIES: ${extra.join(", ")}`,
  );
});

test("a capability reachable from neither surface is not a capability", () => {
  const orphans = CAPABILITIES.filter((c) => !c.discord && !c.web).map(
    (c) => c.id,
  );
  assert.deepEqual(orphans, []);
});

test("anything missing from one surface says why", () => {
  // A gap is allowed, but only as a stated decision rather than an oversight.
  const unexplained = CAPABILITIES.filter(
    (c) => (!c.discord || !c.web) && !c.why,
  ).map((c) => c.id);
  assert.deepEqual(unexplained, []);
});
