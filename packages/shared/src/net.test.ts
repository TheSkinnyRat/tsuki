import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertHostAllowed,
  blockedRangeFor,
  HostNotAllowedError,
  isPrivateAddress,
} from "./net.ts";

test("loopback and private IPv4 are refused", () => {
  for (const addr of [
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "0.0.0.0",
    "255.255.255.255",
  ]) {
    assert.equal(isPrivateAddress(addr), true, `${addr} should be refused`);
  }
});

test("cloud metadata and CGNAT/tailscale ranges are refused", () => {
  assert.equal(blockedRangeFor("169.254.169.254"), "169.254.0.0/16");
  assert.equal(blockedRangeFor("100.100.1.10"), "100.64.0.0/10");
});

test("addresses just outside a blocked range stay allowed", () => {
  // 172.16/12 ends at 172.31.255.255 — an off-by-one here would silently
  // refuse a large slice of public space.
  assert.equal(blockedRangeFor("172.15.255.255"), null);
  assert.equal(blockedRangeFor("172.32.0.0"), null);
  assert.equal(blockedRangeFor("100.63.255.255"), null);
  assert.equal(blockedRangeFor("100.128.0.0"), null);
  assert.equal(blockedRangeFor("11.0.0.1"), null);
  assert.equal(blockedRangeFor("9.255.255.255"), null);
});

test("public addresses are allowed", () => {
  for (const addr of ["8.8.8.8", "1.1.1.1", "203.0.114.1", "2606:4700::1111"]) {
    assert.equal(isPrivateAddress(addr), false, `${addr} should be allowed`);
  }
});

test("IPv4-mapped and NAT64 IPv6 forms do not smuggle a private address", () => {
  assert.equal(blockedRangeFor("::ffff:127.0.0.1"), "127.0.0.0/8");
  assert.equal(blockedRangeFor("::FFFF:10.0.0.5"), "10.0.0.0/8");
  assert.equal(blockedRangeFor("64:ff9b::169.254.169.254"), "169.254.0.0/16");
});

test("IPv6 loopback, ULA, link-local and multicast are refused", () => {
  assert.equal(blockedRangeFor("::1"), "::1/128");
  assert.equal(blockedRangeFor("fd7a:115c:a1e0::1"), "fc00::/7");
  assert.equal(blockedRangeFor("fe80::1%eth0"), "fe80::/10");
  assert.equal(blockedRangeFor("ff02::1"), "ff00::/8");
});

test("a hostname resolving to a private address is refused", async () => {
  await assert.rejects(
    () =>
      assertHostAllowed("node.example.com", {
        resolver: async () => ["10.0.0.7"],
      }),
    (err: unknown) => {
      assert.ok(err instanceof HostNotAllowedError);
      assert.equal(err.address, "10.0.0.7");
      assert.equal(err.range, "10.0.0.0/8");
      return true;
    },
  );
});

test("one private address among public ones is enough to refuse", async () => {
  await assert.rejects(
    () =>
      assertHostAllowed("node.example.com", {
        resolver: async () => ["8.8.8.8", "192.168.0.5"],
      }),
    HostNotAllowedError,
  );
});

test("an empty DNS answer is refused rather than treated as clean", async () => {
  await assert.rejects(
    () => assertHostAllowed("void.example.com", { resolver: async () => [] }),
    HostNotAllowedError,
  );
});

test("a literal private address is refused without consulting DNS", async () => {
  let asked = false;
  await assert.rejects(
    () =>
      assertHostAllowed("127.0.0.1", {
        resolver: async () => {
          asked = true;
          return ["8.8.8.8"];
        },
      }),
    HostNotAllowedError,
  );
  assert.equal(asked, false, "DNS must not be able to launder a literal");
});

test("allowPrivate lets a self-hoster reach their own LAN", async () => {
  const addresses = await assertHostAllowed("192.168.1.50", {
    allowPrivate: true,
  });
  assert.deepEqual(addresses, []);
});

test("a public hostname returns the addresses it resolved to", async () => {
  const addresses = await assertHostAllowed("node.example.com", {
    resolver: async () => ["203.0.114.9"],
  });
  assert.deepEqual(addresses, ["203.0.114.9"]);
});
