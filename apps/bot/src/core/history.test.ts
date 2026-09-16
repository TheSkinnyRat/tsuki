import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

/**
 * Runs against a real SQLite database rather than a stand-in.
 *
 * What is worth checking here is the scoping — that pruning a track removes
 * this guild's rows for it and nobody else's — and a fake that records the
 * arguments would only check that this file passes what this file passes. The
 * schema is pushed into a throwaway file, so nothing touches the dev data.
 */

const workdir = mkdtempSync(join(tmpdir(), "tsuki-history-"));
const databaseUrl = `file:${join(workdir, "test.db")}`;

let forgetUnplayable: typeof import("./history.ts").forgetUnplayable;
let prisma: typeof import("@tsuki/db").prisma;

before(async () => {
  process.env["DATABASE_URL"] = databaseUrl;
  const repoRoot = join(import.meta.dirname, "../../../..");
  const schema = join(repoRoot, "packages/db/prisma/schema.prisma");
  // Resolved rather than guessed at a path: pnpm does not hoist, so the CLI
  // does not sit where a flat node_modules would put it.
  const prismaCli = createRequire(import.meta.url).resolve(
    "prisma/build/index.js",
    { paths: [join(repoRoot, "packages/db")] },
  );
  execFileSync("node", [prismaCli, "db", "push", "--skip-generate", "--schema", schema], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  ({ forgetUnplayable } = await import("./history.ts"));
  ({ prisma } = await import("@tsuki/db"));

  for (const id of ["guild-a", "guild-b"]) {
    await prisma.guild.create({ data: { id, name: id } });
  }
});

after(async () => {
  await prisma?.$disconnect().catch(() => undefined);
  rmSync(workdir, { recursive: true, force: true });
});

async function addHistory(guildId: string, encoded: string): Promise<void> {
  await prisma.playHistory.create({
    data: {
      guildId,
      encoded,
      title: `title ${encoded}`,
      author: "someone",
      lengthMs: 1000,
    },
  });
}

test("every copy of an unplayable track leaves that guild's history", async () => {
  await addHistory("guild-a", "bad-track");
  await addHistory("guild-a", "bad-track");
  await addHistory("guild-a", "good-track");

  const removed = await forgetUnplayable("guild-a", "bad-track");
  assert.equal(removed, 2);

  const left = await prisma.playHistory.findMany({
    where: { guildId: "guild-a" },
    select: { encoded: true },
  });
  assert.deepEqual(
    left.map((row) => row.encoded),
    ["good-track"],
  );
});

test("another guild's copy of the same track is left alone", async () => {
  // The same track may play perfectly well on a different server's node.
  await addHistory("guild-b", "shared-track");
  await addHistory("guild-a", "shared-track");

  await forgetUnplayable("guild-a", "shared-track");

  const theirs = await prisma.playHistory.count({
    where: { guildId: "guild-b", encoded: "shared-track" },
  });
  assert.equal(theirs, 1);
});

test("pruning nothing is not an error", async () => {
  assert.equal(await forgetUnplayable("guild-a", null), 0);
  assert.equal(await forgetUnplayable("guild-a", undefined), 0);
  assert.equal(await forgetUnplayable("guild-a", "never-existed"), 0);
});
