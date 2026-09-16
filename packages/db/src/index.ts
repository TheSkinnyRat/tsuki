import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __tsukiPrisma: PrismaClient | undefined;
}

// Next.js reloads modules in development; without the global the dev server
// opens a new pool on every edit until SQLite refuses further connections.
export const prisma: PrismaClient =
  globalThis.__tsukiPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalThis.__tsukiPrisma = prisma;
