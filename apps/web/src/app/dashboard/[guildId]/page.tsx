import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth.ts";
import { bot } from "@/lib/bot.ts";
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
  const guilds = await bot.guildsFor(userId).catch(() => []);
  const guild = guilds.find((candidate) => candidate.id === guildId);

  // Membership is checked again on the bot's side for every action; this only
  // decides whether the page is worth rendering.
  if (!guild) notFound();

  return (
    <DashboardClient
      guildId={guildId}
      guildName={guild.name}
      guildIcon={guild.icon}
      guilds={guilds.map(({ id, name, icon }) => ({ id, name, icon }))}
      userImage={session?.user?.image ?? null}
    />
  );
}
