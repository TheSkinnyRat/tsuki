import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth.ts";
import { bot } from "@/lib/bot.ts";
import { guildsForSession } from "@/lib/session-guilds.ts";
import { DashboardClient } from "@/components/DashboardClient.tsx";

export default async function GuildDashboard({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/");

  const { guildId } = await params;
  const guilds = await guildsForSession(session);
  let guild = guilds.find((candidate) => candidate.id === guildId);

  // Not in the list: ask the bot about this one server before giving up, so a
  // list that is a few seconds stale cannot hide a server the member just
  // joined. Every action is authorised again on the bot's side regardless.
  if (!guild) {
    const membership = await bot
      .membership(guildId, userId)
      .catch(() => ({ member: false, canManage: false }));
    const known = membership.member
      ? (await bot.botGuilds().catch(() => [])).find((g) => g.id === guildId)
      : undefined;
    if (!known) notFound();
    guild = { ...known, canManage: membership.canManage };
    guilds.unshift(guild);
  }

  return (
    <DashboardClient
      guildId={guildId}
      guildName={guild.name}
      guildIcon={guild.icon}
      guilds={guilds.map(({ id, name, icon }) => ({ id, name, icon }))}
      userImage={session?.user?.image ?? null}
      userName={session?.user?.name ?? null}
    />
  );
}
