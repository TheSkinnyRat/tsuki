import { test } from "node:test";
import assert from "node:assert/strict";
import { forwardBody } from "./forward.ts";

test("a userId sent by the page is replaced by the session's", () => {
  const body = forwardBody({ userId: "someone-else", query: "x" }, "me");
  assert.equal(body["userId"], "me");
  assert.equal(body["query"], "x");
});

test("the session id is set even when the page sent none", () => {
  assert.equal(forwardBody({ volume: 50 }, "me")["userId"], "me");
});

test("a non-object body cannot carry an identity either", () => {
  assert.deepEqual(forwardBody(["userId", "x"], "me"), { userId: "me" });
  assert.deepEqual(forwardBody(null, "me"), { userId: "me" });
  assert.deepEqual(forwardBody("userId=x", "me"), { userId: "me" });
});

test("the page's object is not mutated", () => {
  const original = { userId: "someone-else" };
  forwardBody(original, "me");
  assert.equal(original.userId, "someone-else");
});
