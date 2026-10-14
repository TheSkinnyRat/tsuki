import { test } from "node:test";
import assert from "node:assert/strict";
import { canManageFrom, sharedGuilds } from "./guilds.ts";

const bot = [
  { id: "a", name: "Alpha", icon: "ia" },
  { id: "b", name: "Beta", icon: null },
  { id: "c", name: "Gamma", icon: "ic" },
];

test("only servers both the member and Tsuki are in are listed", () => {
  const shared = sharedGuilds([{ id: "c" }, { id: "a" }, { id: "z" }], bot);
  assert.deepEqual(
    shared.map((guild) => guild.id),
    ["a", "c"],
  );
});

test("the name and icon come from the bot, not the member's list", () => {
  const [alpha] = sharedGuilds([{ id: "a" }], bot);
  assert.equal(alpha?.name, "Alpha");
  assert.equal(alpha?.icon, "ia");
});

test("Manage Server, Administrator or ownership make a manager", () => {
  assert.equal(canManageFrom({ id: "x", permissions: String(1 << 5) }), true);
  assert.equal(canManageFrom({ id: "x", permissions: String(1 << 3) }), true);
  assert.equal(canManageFrom({ id: "x", owner: true, permissions: "0" }), true);
});

test("other permissions, or none, do not", () => {
  // Send Messages + Connect + Speak: an ordinary member.
  const ordinary = (1n << 11n) | (1n << 20n) | (1n << 21n);
  assert.equal(canManageFrom({ id: "x", permissions: String(ordinary) }), false);
  assert.equal(canManageFrom({ id: "x" }), false);
  assert.equal(canManageFrom({ id: "x", permissions: "not a number" }), false);
});
