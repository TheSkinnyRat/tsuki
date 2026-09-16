import { prisma } from "@tsuki/db";
import {
  assertHostAllowed,
  decryptSecret,
  encryptSecret,
  HostNotAllowedError,
  type NodeCapabilities,
  type NodeHealth,
  type NodeSummary,
} from "@tsuki/shared";
import type { LavalinkManager } from "lavalink-client";
import { env } from "../env.ts";
import { createLogger } from "../logger.ts";
import {
  DEFAULT_NODE_ID,
  nodeIdFor,
  nodesForGuild,
} from "../lavalink/manager.ts";
import { ServiceError } from "./errors.ts";
import { getGuildSettings } from "./guilds.ts";

const log = createLogger("nodes");

export interface NodeInput {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  password: string;
  priority?: number;
}

const NAME_PATTERN = /^[\w -]{1,32}$/;

/**
 * Asks a node what it can do, and refuses to dial it at all when the address
 * belongs to private space. This is the only place a guild-supplied host
 * turns into a network request, so the guard lives here rather than at the
 * form.
 */
export async function probeNode(input: {
  host: string;
  port: number;
  secure: boolean;
  password: string;
}): Promise<NodeCapabilities> {
  try {
    await assertHostAllowed(input.host, {
      allowPrivate: env.allowPrivateNodeHosts,
    });
  } catch (error) {
    if (error instanceof HostNotAllowedError) {
      throw new ServiceError("HOST_NOT_ALLOWED", error.message);
    }
    throw new ServiceError(
      "NODE_UNREACHABLE",
      `Could not resolve ${input.host}.`,
    );
  }

  const scheme = input.secure ? "https" : "http";
  const url = `${scheme}://${input.host}:${input.port}/v4/info`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: input.password },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ServiceError(
      "NODE_UNREACHABLE",
      `No answer from ${input.host}:${input.port}. Check the node is running and reachable from the internet.`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError(
      "NODE_UNREACHABLE",
      "The node refused that password.",
    );
  }
  if (!response.ok) {
    throw new ServiceError(
      "NODE_UNREACHABLE",
      `The node answered ${response.status} on /v4/info. Tsuki needs Lavalink v4.`,
    );
  }

  const info = (await response.json()) as {
    version?: { semver?: string };
    sourceManagers?: string[];
    plugins?: Array<{ name: string; version: string }>;
    filters?: string[];
  };

  if (!info.version?.semver) {
    throw new ServiceError(
      "NODE_UNREACHABLE",
      "That answered, but not like Lavalink v4 does. Tsuki needs Lavalink v4.",
    );
  }

  return {
    version: info.version.semver,
    sources: info.sourceManagers ?? [],
    plugins: (info.plugins ?? []).map((p) => `${p.name}@${p.version}`),
    filters: info.filters ?? [],
  };
}

function capabilitiesFromRow(row: {
  infoVersion: string | null;
  infoSources: string | null;
  infoPlugins: string | null;
  infoFilters: string | null;
}): NodeCapabilities | null {
  if (!row.infoVersion) return null;
  const split = (value: string | null) =>
    value && value.length > 0 ? value.split(",") : [];
  return {
    version: row.infoVersion,
    sources: split(row.infoSources),
    plugins: split(row.infoPlugins),
    filters: split(row.infoFilters),
  };
}

export async function addNode(
  guildId: string,
  input: NodeInput,
): Promise<NodeSummary> {
  if (!NAME_PATTERN.test(input.name)) {
    throw new ServiceError(
      "INVALID_INPUT",
      "A node name can be up to 32 letters, numbers, spaces, dashes or underscores.",
    );
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new ServiceError("INVALID_INPUT", "That is not a valid port.");
  }

  const capabilities = await probeNode(input);
  await getGuildSettings(guildId);

  const existing = await prisma.node.findUnique({
    where: { guildId_name: { guildId, name: input.name } },
  });
  if (existing) {
    throw new ServiceError(
      "INVALID_INPUT",
      `This server already has a node called "${input.name}".`,
    );
  }

  const row = await prisma.node.create({
    data: {
      guildId,
      name: input.name,
      host: input.host,
      port: input.port,
      secure: input.secure,
      passwordEnc: encryptSecret(input.password, env.encryptionKey),
      priority: input.priority ?? 0,
      infoVersion: capabilities.version,
      infoSources: capabilities.sources.join(","),
      infoPlugins: capabilities.plugins.join(","),
      infoFilters: capabilities.filters.join(","),
      lastOkAt: new Date(),
      lastProbed: new Date(),
      lastError: null,
    },
  });

  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    secure: row.secure,
    enabled: row.enabled,
    priority: row.priority,
    connected: false,
    health: "ok",
    lastError: null,
    lastOkAt: row.lastOkAt?.toISOString() ?? null,
    capabilities,
  };
}

export async function removeNode(guildId: string, name: string): Promise<void> {
  const deleted = await prisma.node
    .delete({ where: { guildId_name: { guildId, name } } })
    .catch(() => null);
  if (!deleted) {
    throw new ServiceError("NOT_FOUND", `No node called "${name}" here.`);
  }
}

export async function setNodeEnabled(
  guildId: string,
  name: string,
  enabled: boolean,
): Promise<void> {
  const updated = await prisma.node
    .update({ where: { guildId_name: { guildId, name } }, data: { enabled } })
    .catch(() => null);
  if (!updated) {
    throw new ServiceError("NOT_FOUND", `No node called "${name}" here.`);
  }
}

async function waitForConnection(
  node: { connected: boolean },
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (node.connected) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return node.connected;
}

export async function listNodes(
  manager: LavalinkManager,
  guildId: string,
): Promise<NodeSummary[]> {
  const rows = await prisma.node.findMany({
    where: { guildId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const summaries: NodeSummary[] = [];

  // The instance's own node, when the operator offers one, is listed first so
  // the panel never says "no node" while music is coming out of it.
  if (env.defaultNode) {
    const live = manager.nodeManager.nodes.get(DEFAULT_NODE_ID);
    const info = live?.info;
    summaries.push({
      id: DEFAULT_NODE_ID,
      instanceProvided: true,
      name: "provided by this instance",
      // Not the guild's machine, so not the guild's address to read.
      host: "",
      port: 0,
      secure: env.defaultNode.secure,
      enabled: true,
      priority: -1,
      connected: live?.connected ?? false,
      health: live?.connected ? "ok" : "unknown",
      lastError: null,
      lastOkAt: null,
      capabilities: info
        ? {
            version: info.version?.semver ?? "unknown",
            sources: info.sourceManagers ?? [],
            plugins: (info.plugins ?? []).map(
              (plugin) => `${plugin.name}@${plugin.version}`,
            ),
            filters: info.filters ?? [],
          }
        : null,
    });
  }

  summaries.push(...rows.map((row) => {
    const live = manager.nodeManager.nodes.get(nodeIdFor(guildId, row.name));
    const health: NodeHealth = live?.connected
      ? "ok"
      : row.lastError
        ? "unreachable"
        : row.lastOkAt
          ? "ok"
          : "unknown";
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      secure: row.secure,
      enabled: row.enabled,
      priority: row.priority,
      connected: live?.connected ?? false,
      health,
      lastError: row.lastError,
      lastOkAt: row.lastOkAt?.toISOString() ?? null,
      capabilities: capabilitiesFromRow(row),
    };
  }));

  return summaries;
}

/**
 * Registers every enabled node this guild owns with the Lavalink manager.
 * Safe to call repeatedly — nodes already registered are left alone.
 */
export async function syncGuildNodes(
  manager: LavalinkManager,
  guildId: string,
): Promise<void> {
  const rows = await prisma.node.findMany({
    where: { guildId, enabled: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  for (const row of rows) {
    const id = nodeIdFor(guildId, row.name);
    if (manager.nodeManager.nodes.has(id)) continue;
    let password: string;
    try {
      password = decryptSecret(row.passwordEnc, env.encryptionKey);
    } catch {
      log.error(
        `cannot decrypt the password for node ${id} — ENCRYPTION_KEY has changed`,
      );
      await prisma.node.update({
        where: { id: row.id },
        data: {
          lastError:
            "Tsuki can no longer read this node's password. Add it again.",
        },
      });
      continue;
    }
    try {
      const node = manager.nodeManager.createNode({
        id,
        host: row.host,
        port: row.port,
        authorization: password,
        secure: row.secure,
        retryAmount: 5,
        retryDelay: 3_000,
      });
      // connect() only starts the socket. Picking a node straight after
      // registering it would find it not yet connected and quietly fall back
      // to the instance node — found when a guild's priority-10 node was
      // skipped on its very first track — so wait briefly for the handshake.
      await node.connect();
      await waitForConnection(node, 5_000);
    } catch (error) {
      log.warn(`could not register node ${id}`, error);
    }
  }
}

/**
 * The node a guild should play through: its own, highest priority first, then
 * the instance default when the operator offers one. Returns null when the
 * guild has nothing usable, which is the normal state on the public instance
 * until someone adds a node.
 */
export async function pickNodeForGuild(
  manager: LavalinkManager,
  guildId: string,
): Promise<string | null> {
  await syncGuildNodes(manager, guildId);

  const rows = await prisma.node.findMany({
    where: { guildId, enabled: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { name: true },
  });

  for (const row of rows) {
    const node = manager.nodeManager.nodes.get(nodeIdFor(guildId, row.name));
    if (node?.connected) return nodeIdFor(guildId, row.name);
  }

  if (env.defaultNode) {
    const fallback = manager.nodeManager.nodes.get(DEFAULT_NODE_ID);
    if (fallback?.connected) return DEFAULT_NODE_ID;
  }

  if (rows.length === 0) return null;
  return null;
}

/** Raised when a guild has no node at all, versus has one that is down. */
export async function assertNodeAvailable(
  manager: LavalinkManager,
  guildId: string,
): Promise<string> {
  const picked = await pickNodeForGuild(manager, guildId);
  if (picked) return picked;

  const count = await prisma.node.count({ where: { guildId } });
  if (count === 0) {
    throw new ServiceError(
      "NO_NODE_CONFIGURED",
      "This server has no audio node yet. Add one with /node add — Tsuki plays through a Lavalink node you provide.",
    );
  }
  throw new ServiceError(
    "NO_NODE_AVAILABLE",
    "None of this server's audio nodes are reachable right now.",
  );
}

/**
 * Which sources the guild can actually play from, read off the node it would
 * use. Lets a request be refused with a reason before it becomes a load error.
 */
export async function sourcesForGuild(
  manager: LavalinkManager,
  guildId: string,
): Promise<string[]> {
  const nodes = nodesForGuild(manager, guildId).filter((n) => n.connected);
  const sources = new Set<string>();
  for (const node of nodes) {
    for (const source of node.info?.sourceManagers ?? []) sources.add(source);
  }
  if (sources.size > 0) return [...sources];

  const rows = await prisma.node.findMany({
    where: { guildId, enabled: true },
    select: { infoSources: true },
  });
  for (const row of rows) {
    for (const source of row.infoSources?.split(",") ?? []) {
      if (source) sources.add(source);
    }
  }
  return [...sources];
}
