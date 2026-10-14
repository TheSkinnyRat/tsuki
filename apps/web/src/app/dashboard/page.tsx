import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth.ts";
import { guildsForSession } from "@/lib/session-guilds.ts";
import { LogOut, Plus } from "lucide-react";
import { inviteUrl } from "@/lib/invite.ts";
import { signOutAction } from "@/app/actions.ts";

export default async function GuildPicker() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/");

  const guilds = await guildsForSession(session);
  const invite = inviteUrl(process.env["DISCORD_CLIENT_ID"]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium">Your servers</h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-transparent px-[11px] text-[12.5px] text-[var(--color-muted)] transition-colors duration-150 hover:border-[var(--color-halo)] hover:text-[var(--color-ink)]"
          >
            <LogOut size={13} strokeWidth={2} aria-hidden />
            Sign out
          </button>
        </form>
      </div>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Servers you and Tsuki are both in.
      </p>

      {guilds.length === 0 ? (
        <div className="mt-8 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
          <p className="m-0">
            Tsuki is not in any server you belong to yet. Invite it to one you
            run, then come back.
          </p>
          {invite ? (
            <a
              href={invite}
              className="mt-3 inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 text-[12.5px] font-medium text-[var(--color-on-accent)] transition-opacity duration-150 hover:opacity-90"
            >
              <Plus size={13} strokeWidth={2.25} aria-hidden />
              Add to Discord
            </a>
          ) : null}
        </div>
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
