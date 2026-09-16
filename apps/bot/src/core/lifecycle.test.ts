import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldStillLeave } from "./lifecycle.ts";

/**
 * These pin the thing that actually went wrong: the countdown started because
 * the channel emptied, and a check for "is it playing" kept Tsuki in an empty
 * room indefinitely, because it was playing — a two-hour mix to nobody.
 */

test("an empty channel is left even while a track is playing", () => {
  assert.equal(
    shouldStillLeave("channel-empty", {
      playing: true,
      queued: 5,
      listeners: 0,
    }),
    true,
  );
});

test("somebody walking back in cancels the empty-channel countdown", () => {
  assert.equal(
    shouldStillLeave("channel-empty", {
      playing: true,
      queued: 0,
      listeners: 1,
    }),
    false,
  );
});

test("a queue that ran dry is left when nothing was added", () => {
  assert.equal(
    shouldStillLeave("queue-ran-out", {
      playing: false,
      queued: 0,
      listeners: 3,
    }),
    true,
  );
});

test("a track queued during the countdown cancels it", () => {
  assert.equal(
    shouldStillLeave("queue-ran-out", {
      playing: false,
      queued: 1,
      listeners: 3,
    }),
    false,
  );
  assert.equal(
    shouldStillLeave("queue-ran-out", {
      playing: true,
      queued: 0,
      listeners: 3,
    }),
    false,
  );
});

test("an empty room with nothing playing is still left", () => {
  assert.equal(
    shouldStillLeave("channel-empty", {
      playing: false,
      queued: 0,
      listeners: 0,
    }),
    true,
  );
});

import { reasonFor } from "./lifecycle.ts";

test("a Java stack trace becomes one readable reason", () => {
  const trace = [
    "(yts.version: 1.18.2) All clients failed to load the item.",
    "Client [ANDROID_VR] failed: This video requires login.",
    "        at dev.lavalink.youtube.clients.skeleton.Client.getPlayabilityStatus(Client.java:94)",
    "Client [WEB] failed: This video requires login.",
  ].join("\n");
  assert.equal(reasonFor(trace), "This video requires login.");
});

test("a missing or huge message still yields something short", () => {
  assert.equal(reasonFor(undefined), "the node refused it");
  assert.ok(reasonFor("x".repeat(500)).length <= 140);
});
