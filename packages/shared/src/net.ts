import { lookup } from "node:dns/promises";

/**
 * Guard for Lavalink hosts typed in by a guild.
 *
 * On the hosted instance the bot connects to whatever address a stranger
 * writes in a form. Without this check that turns Tsuki into a port scanner
 * for private networks and cloud metadata endpoints (169.254.169.254), which
 * is why the block list is applied to every address a name resolves to, not
 * to the name itself.
 *
 * Self-hosters run their node on the same LAN, so `allowPrivate` turns the
 * guard off for them.
 */

export class HostNotAllowedError extends Error {
  // Written out rather than declared as parameter properties: Node runs this
  // repo's TypeScript in strip-only mode, which rejects that syntax.
  readonly host: string;
  readonly address: string;
  readonly range: string;

  constructor(host: string, address: string, range: string) {
    super(
      `${host} resolves to ${address}, which is inside ${range}. ` +
        `Hosted Tsuki only connects to public addresses. ` +
        `Self-hosting? Set ALLOW_PRIVATE_NODE_HOSTS=true.`,
    );
    this.name = "HostNotAllowedError";
    this.host = host;
    this.address = address;
    this.range = range;
  }
}

type V4Range = { cidr: string; base: number; bits: number };

function v4(cidr: string): V4Range {
  const [addr, prefix] = cidr.split("/") as [string, string];
  return { cidr, base: v4ToInt(addr)!, bits: Number(prefix) };
}

const V4_BLOCKED: V4Range[] = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
].map(v4);

const V6_BLOCKED: Array<{ prefix: string; cidr: string }> = [
  { prefix: "::1", cidr: "::1/128" },
  { prefix: "::", cidr: "::/128" },
  { prefix: "fc", cidr: "fc00::/7" },
  { prefix: "fd", cidr: "fc00::/7" },
  { prefix: "fe8", cidr: "fe80::/10" },
  { prefix: "fe9", cidr: "fe80::/10" },
  { prefix: "fea", cidr: "fe80::/10" },
  { prefix: "feb", cidr: "fe80::/10" },
  { prefix: "ff", cidr: "ff00::/8" },
];

function v4ToInt(addr: string): number | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out >>> 0;
}

/**
 * Returns the CIDR that covers this address, or null when it is a public one.
 * IPv4-mapped and NAT64 IPv6 addresses are unwrapped first — otherwise
 * `::ffff:127.0.0.1` walks straight past an IPv4-only block list.
 */
export function blockedRangeFor(address: string): string | null {
  let addr = address.trim().toLowerCase();

  const zone = addr.indexOf("%"); // fe80::1%eth0
  if (zone !== -1) addr = addr.slice(0, zone);

  const mapped = addr.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) addr = mapped[1]!;

  const asInt = v4ToInt(addr);
  if (asInt !== null) {
    if (asInt === 0xffffffff) return "255.255.255.255/32";
    for (const range of V4_BLOCKED) {
      const mask = range.bits === 0 ? 0 : (~0 << (32 - range.bits)) >>> 0;
      if ((asInt & mask) === (range.base & mask)) return range.cidr;
    }
    return null;
  }

  if (!addr.includes(":")) return null; // a name, not an address
  for (const { prefix, cidr } of V6_BLOCKED) {
    if (addr === prefix || addr.startsWith(prefix)) return cidr;
  }
  return null;
}

export function isPrivateAddress(address: string): boolean {
  return blockedRangeFor(address) !== null;
}

export interface HostCheckOptions {
  allowPrivate?: boolean;
  /** Injected in tests so the check can run without touching DNS. */
  resolver?: (host: string) => Promise<string[]>;
}

async function defaultResolver(host: string): Promise<string[]> {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

/**
 * Resolves `host` and throws unless every address it answers with is public.
 * Returns the addresses so the caller can log what it actually dialled.
 */
export async function assertHostAllowed(
  host: string,
  options: HostCheckOptions = {},
): Promise<string[]> {
  if (options.allowPrivate) return [];

  const literal = blockedRangeFor(host);
  if (literal) throw new HostNotAllowedError(host, host, literal);

  const resolve = options.resolver ?? defaultResolver;
  const addresses = await resolve(host);
  if (addresses.length === 0) {
    throw new HostNotAllowedError(host, "nothing", "an empty DNS answer");
  }
  for (const address of addresses) {
    const range = blockedRangeFor(address);
    if (range) throw new HostNotAllowedError(host, address, range);
  }
  return addresses;
}
