import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategories } from "./sponsorblock.ts";
import { ServiceError } from "./errors.ts";

test("known categories pass through, deduplicated and lower-cased", () => {
  assert.deepEqual(parseCategories(["Sponsor", "intro", "sponsor"]), [
    "sponsor",
    "intro",
  ]);
});

test("an unknown category is refused by name", () => {
  assert.throws(
    () => parseCategories(["sponsor", "adverts"]),
    (error: unknown) =>
      error instanceof ServiceError &&
      error.code === "INVALID_INPUT" &&
      error.message.includes("adverts"),
  );
});

test("an empty choice is refused", () => {
  assert.throws(() => parseCategories([]), ServiceError);
  assert.throws(() => parseCategories(["  "]), ServiceError);
});
