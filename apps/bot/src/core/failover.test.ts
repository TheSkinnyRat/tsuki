import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseFailoverNode } from "./failover.ts";

const A = "guild-a";
const B = "guild-b";
const node = (id: string, connected = true) => ({ id, connected });

test("a player moves to its own guild's other node", () => {
  const target = chooseFailoverNode(
    A,
    `g:${A}:main`,
    [node(`g:${A}:main`, false), node(`g:${A}:backup`)],
    new Map(),
    false,
  );
  assert.equal(target, `g:${A}:backup`);
});

test("another guild's node is never a candidate, however healthy", () => {
  const target = chooseFailoverNode(
    A,
    `g:${A}:main`,
    [node(`g:${A}:main`, false), node(`g:${B}:their-node`)],
    new Map(),
    false,
  );
  assert.equal(target, null);
});

test("the highest-priority healthy node wins", () => {
  const target = chooseFailoverNode(
    A,
    `g:${A}:main`,
    [
      node(`g:${A}:main`, false),
      node(`g:${A}:slow`),
      node(`g:${A}:fast`),
    ],
    new Map([
      ["slow", 1],
      ["fast", 5],
    ]),
    false,
  );
  assert.equal(target, `g:${A}:fast`);
});

test("a disconnected node is not a candidate", () => {
  const target = chooseFailoverNode(
    A,
    `g:${A}:main`,
    [node(`g:${A}:main`, false), node(`g:${A}:backup`, false)],
    new Map(),
    false,
  );
  assert.equal(target, null);
});

test("the instance node is a last resort only when the operator offers one", () => {
  const nodes = [node(`g:${A}:main`, false), node("instance-default")];
  assert.equal(
    chooseFailoverNode(A, `g:${A}:main`, nodes, new Map(), true),
    "instance-default",
  );
  assert.equal(chooseFailoverNode(A, `g:${A}:main`, nodes, new Map(), false), null);
});

test("names containing colons keep their priority", () => {
  const target = chooseFailoverNode(
    A,
    `g:${A}:main`,
    [node(`g:${A}:main`, false), node(`g:${A}:eu:1`), node(`g:${A}:us`)],
    new Map([
      ["eu:1", 9],
      ["us", 1],
    ]),
    false,
  );
  assert.equal(target, `g:${A}:eu:1`);
});
