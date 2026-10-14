import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteUrl } from "./invite.ts";

test("the link invites this instance's bot with the commands scope", () => {
  const url = new URL(inviteUrl("123")!);
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("scope"), "bot applications.commands");
});

test("it asks for exactly the permissions Tsuki uses", () => {
  const url = new URL(inviteUrl("123")!);
  // View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak.
  assert.equal(url.searchParams.get("permissions"), "3230720");
});

test("without an application id there is no link to show", () => {
  assert.equal(inviteUrl(undefined), null);
  assert.equal(inviteUrl(""), null);
});
