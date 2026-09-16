import { test } from "node:test";
import assert from "node:assert/strict";
import type { Actor, ChannelRuleSummary, GuildSettings } from "@tsuki/shared";
import { assertCan, isDj, type PermissionContext } from "./permissions.ts";
import { ServiceError } from "./errors.ts";

const DJ_ROLE = "role-dj";
const VOICE = "voice-1";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: "user-1",
    guildId: "guild-1",
    roleIds: [],
    voiceChannelId: VOICE,
    isGuildManager: false,
    surface: "discord",
    ...overrides,
  };
}

function settings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    id: "guild-1",
    name: "Test",
    defaultVolume: 30,
    stay247: false,
    autoplay: false,
    djMode: false,
    djRoleId: DJ_ROLE,
    ...overrides,
  };
}

function rule(overrides: Partial<ChannelRuleSummary> = {}): ChannelRuleSummary {
  return {
    channelId: VOICE,
    djRequired: false,
    canRequest: true,
    locked: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<PermissionContext> = {}): PermissionContext {
  return {
    actor: actor(),
    settings: settings(),
    rule: null,
    player: {
      connected: true,
      voiceChannelId: VOICE,
      currentRequesterId: null,
      listenerCount: 3,
    },
    ...overrides,
  };
}

function refusal(fn: () => void): ServiceError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ServiceError, "expected a ServiceError");
    return error;
  }
  throw new assert.AssertionError({ message: "expected a refusal, got none" });
}

// ------------------------------------------------------------------- voice

test("a member outside voice cannot request or control", () => {
  const c = ctx({ actor: actor({ voiceChannelId: null }) });
  assert.equal(refusal(() => assertCan("request", c)).code, "NOT_IN_VOICE");
  assert.equal(refusal(() => assertCan("control", c)).code, "NOT_IN_VOICE");
});

test("a member in a different voice channel is refused", () => {
  const c = ctx({ actor: actor({ voiceChannelId: "voice-2" }) });
  assert.equal(
    refusal(() => assertCan("control", c)).code,
    "WRONG_VOICE_CHANNEL",
  );
});

test("settings can be changed from outside voice", () => {
  // Managing a guild is not a listening activity.
  const c = ctx({
    actor: actor({ voiceChannelId: null, isGuildManager: true }),
  });
  assert.doesNotThrow(() => assertCan("manage", c));
});

// ---------------------------------------------------------------- dj mode

test("with DJ mode off anyone in the channel may control playback", () => {
  assert.doesNotThrow(() => assertCan("control", ctx()));
});

test("with DJ mode on a plain member may not control playback", () => {
  const c = ctx({ settings: settings({ djMode: true }) });
  assert.equal(refusal(() => assertCan("control", c)).code, "DJ_REQUIRED");
});

test("with DJ mode on the DJ role may control playback", () => {
  const c = ctx({
    settings: settings({ djMode: true }),
    actor: actor({ roleIds: [DJ_ROLE] }),
  });
  assert.doesNotThrow(() => assertCan("control", c));
});

test("a guild manager is always a DJ", () => {
  const c = ctx({
    settings: settings({ djMode: true }),
    actor: actor({ isGuildManager: true }),
  });
  assert.doesNotThrow(() => assertCan("control", c));
  assert.equal(isDj(c), true);
});

test("DJ mode with no role set still refuses, and says so", () => {
  const c = ctx({ settings: settings({ djMode: true, djRoleId: null }) });
  const error = refusal(() => assertCan("control", c));
  assert.equal(error.code, "DJ_REQUIRED");
  assert.match(error.message, /no DJ role/i);
});

test("the only human in the channel may control it despite DJ mode", () => {
  const c = ctx({
    settings: settings({ djMode: true }),
    player: {
      connected: true,
      voiceChannelId: VOICE,
      currentRequesterId: null,
      listenerCount: 1,
    },
  });
  assert.doesNotThrow(() => assertCan("control", c));
});

test("being alone somewhere else does not grant DJ over this player", () => {
  const c = ctx({
    settings: settings({ djMode: true }),
    actor: actor({ voiceChannelId: "voice-2" }),
    player: {
      connected: true,
      voiceChannelId: VOICE,
      currentRequesterId: null,
      listenerCount: 1,
    },
  });
  assert.equal(isDj(c), false);
});

test("a member may skip the track they requested themselves", () => {
  const c = ctx({
    settings: settings({ djMode: true }),
    targetRequesterId: "user-1",
  });
  assert.doesNotThrow(() => assertCan("control", c));
});

test("a member may not skip someone else's track under DJ mode", () => {
  const c = ctx({
    settings: settings({ djMode: true }),
    targetRequesterId: "user-2",
  });
  assert.equal(refusal(() => assertCan("control", c)).code, "DJ_REQUIRED");
});

// ---------------------------------------------------------- channel rules

test("a channel with requests disabled refuses new tracks", () => {
  const c = ctx({ rule: rule({ canRequest: false }) });
  assert.equal(
    refusal(() => assertCan("request", c)).code,
    "REQUESTS_DISABLED",
  );
});

test("a channel marked djRequired restricts control even with DJ mode off", () => {
  const c = ctx({ rule: rule({ djRequired: true }) });
  assert.equal(refusal(() => assertCan("control", c)).code, "DJ_REQUIRED");
  assert.equal(refusal(() => assertCan("request", c)).code, "DJ_REQUIRED");
});

test("a locked channel refuses everyone but a DJ", () => {
  const c = ctx({ rule: rule({ locked: true }) });
  assert.equal(refusal(() => assertCan("request", c)).code, "CHANNEL_LOCKED");

  const asDj = ctx({
    rule: rule({ locked: true }),
    actor: actor({ roleIds: [DJ_ROLE] }),
  });
  assert.doesNotThrow(() => assertCan("request", asDj));
});

// ------------------------------------------------------------- management

test("a plain member cannot manage the guild's settings", () => {
  assert.equal(refusal(() => assertCan("manage", ctx())).code, "DJ_REQUIRED");
});

test("the DJ role can manage settings", () => {
  const c = ctx({ actor: actor({ roleIds: [DJ_ROLE] }) });
  assert.doesNotThrow(() => assertCan("manage", c));
});

// ----------------------------------------------------------- the two surfaces

test("the surface a request arrives on never changes the answer", () => {
  // Parity is the point: the dashboard must not be a way around DJ mode.
  const base = { settings: settings({ djMode: true }) };
  const fromDiscord = ctx({ ...base, actor: actor({ surface: "discord" }) });
  const fromWeb = ctx({ ...base, actor: actor({ surface: "web" }) });

  assert.equal(
    refusal(() => assertCan("control", fromDiscord)).code,
    refusal(() => assertCan("control", fromWeb)).code,
  );

  const djDiscord = ctx({
    ...base,
    actor: actor({ surface: "discord", roleIds: [DJ_ROLE] }),
  });
  const djWeb = ctx({
    ...base,
    actor: actor({ surface: "web", roleIds: [DJ_ROLE] }),
  });
  assert.doesNotThrow(() => assertCan("control", djDiscord));
  assert.doesNotThrow(() => assertCan("control", djWeb));
});
