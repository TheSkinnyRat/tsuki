import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@tsuki/db";

/**
 * A way to open the dashboard without registering an OAuth application.
 *
 * Working on the dashboard otherwise needs a Discord app, a client secret and
 * a redirect URL that resolves — a lot of setup to look at a queue. This
 * provider signs in as a Discord id you name, and the bot still decides every
 * permission from that id, so it grants nothing the real login would not.
 *
 * It cannot exist in a deployed build: `next build` sets NODE_ENV to
 * production, and the check below is read at module load, not from a flag
 * somebody could flip afterwards.
 */
const developmentLogin: Provider[] =
  process.env.NODE_ENV === "production" || !process.env["DEV_LOGIN"]
    ? []
    : [
        Credentials({
          id: "dev",
          name: "Development login",
          credentials: { discordId: { label: "Discord user id" } },
          authorize(credentials) {
            const discordId = String(credentials?.["discordId"] ?? "").trim();
            if (!/^\d{5,25}$/.test(discordId)) return null;
            return { id: discordId, name: `dev:${discordId}` };
          },
        }),
      ];

/**
 * Sign-in gives Tsuki an identity, nothing more.
 *
 * `guilds` is requested so the dashboard can show which servers to pick from,
 * but the token is never trusted for permissions: whether this member may skip
 * a track is decided by the bot, from Discord's own answer about their roles
 * and voice state.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    ...developmentLogin,
    Discord({
      // Read here rather than through a module constant: a build has no
      // secrets, and an eager read turns a missing one into a compile failure.
      clientId: process.env["DISCORD_CLIENT_ID"] ?? "",
      clientSecret: process.env["DISCORD_CLIENT_SECRET"] ?? "",
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    jwt({ token, account, profile, user }) {
      if (account?.access_token) token["discordAccessToken"] = account.access_token;
      if (profile?.["id"]) token["discordId"] = profile["id"];
      if (account?.provider === "dev" && user?.id) token["discordId"] = user.id;
      return token;
    },
    session({ session, token }) {
      const discordId = token["discordId"];
      if (typeof discordId === "string") {
        session.user = { ...session.user, id: discordId };
      }
      const accessToken = token["discordAccessToken"];
      if (typeof accessToken === "string") {
        (session as { discordAccessToken?: string }).discordAccessToken =
          accessToken;
      }
      return session;
    },
  },
  pages: { signIn: "/" },
});
