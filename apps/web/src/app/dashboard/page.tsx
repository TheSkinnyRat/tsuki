import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth.ts";
import { bot } from "@/lib/bot.ts";

export default async function GuildPicker() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/");

  // Asked of the bot: it knows which servers it is actually in, which is the
  // set that matters here. Discord's OAuth guild list does not.
  const guilds = await bot.guildsFor(userId).catch(() => []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-medium">Your servers</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Servers you and Tsuki are both in.
      </p>

      {guilds.length === 0 ? (
        <p className="mt-8 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
          Tsuki is not in any server you belong to yet. Invite it to one you
          run, then come back.
        </p>
      ) : (
        <ul className="mt-8 grid gap-2">
          {guilds.map((guild) => (
            <li key={guild.id}>
              <Link
                href={`/dashboard/${guild.id}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 transition-colors duration-150 hover:border-[var(--color-accent)]"
              >
                {guild.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                    alt=""
                    className="size-8 rounded-md object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-8 place-items-center rounded-md bg-[var(--color-soft)] text-xs font-medium text-[var(--color-ink)]"
                  >
                    {guild.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="text-sm font-medium">{guild.name}</span>
                {guild.canManage ? (
                  <span className="ml-auto font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                    manager
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
