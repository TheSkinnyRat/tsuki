import { auth, signIn } from "@/auth.ts";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const devLoginEnabled =
    process.env.NODE_ENV !== "production" && Boolean(process.env["DEV_LOGIN"]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <div className="flex items-center gap-2 text-[var(--color-accent)]">
        <MoonMark />
        <span className="font-medium">tsuki</span>
      </div>

      <h1 className="mt-10 text-4xl leading-tight font-medium sm:text-5xl">
        Music for your server,
        <br />
        run from the browser.
      </h1>

      <p className="mt-5 max-w-xl text-[var(--color-muted)]">
        Tsuki plays through the Lavalink node your server brings, so what it can
        play — and who pays for it — stays with you. The dashboard mirrors every
        slash command; the sound stays in the voice channel.
      </p>

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-halo)]"
        >
          Sign in with Discord
        </button>
      </form>

      <p className="mt-4 font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
        in development · AGPL-3.0 · bring your own audio node
      </p>

      {devLoginEnabled ? (
        <form
          className="mt-10 flex max-w-sm gap-2 border-t border-[var(--color-line)] pt-6"
          action={async (formData: FormData) => {
            "use server";
            await signIn("dev", {
              discordId: String(formData.get("discordId") ?? ""),
              redirectTo: "/dashboard",
            });
          }}
        >
          <input
            name="discordId"
            placeholder="Discord user id"
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm transition-colors duration-150 hover:border-[var(--color-accent)]"
          >
            Dev sign-in
          </button>
        </form>
      ) : null}
    </main>
  );
}

function MoonMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
