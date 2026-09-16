"use client";

import type { GuildSettings } from "@tsuki/shared";
import { api } from "@/lib/api.ts";

export function SettingsPanel({
  guildId,
  settings,
  onAct,
}: {
  guildId: string;
  settings: GuildSettings | null;
  onAct: (run: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  if (!settings) {
    return (
      <p className="text-sm text-[var(--color-muted)]">Loading settings…</p>
    );
  }

  const patch = (body: Record<string, unknown>, success: string) =>
    onAct(() => api.patch(guildId, "settings", body), success);

  return (
    <section className="max-w-2xl rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <h2 className="border-b border-[var(--color-line)] px-5 py-3 text-sm font-medium">
        How Tsuki behaves here
      </h2>

      <Toggle
        title="Stay in voice"
        detail="Keeps the queue alive when the channel empties instead of leaving."
        on={settings.stay247}
        onChange={(value) =>
          patch(
            { stay247: value },
            value ? "Tsuki will hold the channel." : "Tsuki will leave when empty.",
          )
        }
      />

      <Toggle
        title="Autoplay when the queue ends"
        detail="Continues from what this server has listened to before."
        on={settings.autoplay}
        onChange={(value) =>
          patch({ autoplay: value }, value ? "Autoplay on." : "Autoplay off.")
        }
      />

      <Toggle
        title="DJ mode"
        detail={
          settings.djRoleId
            ? "Only the DJ role and Manage Server can change playback."
            : "No DJ role is set yet — set one with /settings dj in Discord, or only Manage Server will qualify."
        }
        on={settings.djMode}
        onChange={(value) =>
          patch({ djMode: value }, value ? "DJ mode on." : "DJ mode off.")
        }
      />

      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm font-medium">Starting volume</p>
          <p className="text-xs text-[var(--color-muted)]">
            What a fresh player begins at.
          </p>
        </div>
        <input
          type="number"
          min={0}
          max={200}
          defaultValue={settings.defaultVolume}
          onBlur={(event) =>
            patch(
              { defaultVolume: Number(event.currentTarget.value) },
              "Starting volume saved.",
            )
          }
          className="w-20 rounded-lg border border-[var(--color-line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    </section>
  );
}

function Toggle({
  title,
  detail,
  on,
  onChange,
}: {
  title: string;
  detail: string;
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--color-muted)]">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${
          on ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)]"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-all duration-150 ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
