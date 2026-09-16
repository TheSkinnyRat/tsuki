"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuildSettings, NodeSummary, PlayerSnapshot } from "@tsuki/shared";
import { api } from "@/lib/api.ts";
import { Panel, PanelHeader, Switch } from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

interface Rule {
  channelId: string;
  djRequired: boolean;
  canRequest: boolean;
  locked: boolean;
}

function KeyValue({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 ${
        last ? "" : "border-b border-[var(--color-line)]"
      }`}
    >
      <span className="text-[13.5px]">{label}</span>
      <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--color-muted)]">
        {children}
      </span>
    </div>
  );
}

const inputClass =
  "h-8 rounded-lg border border-[var(--color-line)] bg-transparent px-2.5 font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-halo)]";

export function SettingsPanel({
  guildId,
  settings,
  player,
  nodes,
  onAct,
}: {
  guildId: string;
  settings: GuildSettings | null;
  player: PlayerSnapshot | null;
  nodes: NodeSummary[];
  onAct: Act;
}) {
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  const load = useCallback(async () => {
    const [roleList, channelList, full] = await Promise.all([
      api.roles(guildId).catch(() => []),
      api.channels(guildId).catch(() => []),
      api.settingsFull(guildId).catch(() => null),
    ]);
    setRoles(roleList);
    setChannels(channelList);
    setRules(full?.channelRules ?? []);
  }, [guildId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!settings) {
    return (
      <p className="text-[13px] text-[var(--color-muted)]">Loading settings…</p>
    );
  }
  const reachable = nodes.filter((node) => node.connected).length;

  const ruleFor = (channelId: string): Rule =>
    rules.find((rule) => rule.channelId === channelId) ?? {
      channelId,
      djRequired: false,
      canRequest: true,
      locked: false,
    };

  const setRule = async (channelId: string, patch: Partial<Rule>) => {
    await onAct(
      () => api.put(guildId, `channel-rules/${channelId}`, patch),
      "Channel rule saved.",
    );
    await load();
  };

  return (
    <div className="grid gap-4">
      <Panel>
        <KeyValue label="Voice channel">
          {player?.voiceChannelName ? `#${player.voiceChannelName}` : "not connected"}
        </KeyValue>
        <KeyValue label="Audio nodes">
          {reachable} of {nodes.length} reachable
        </KeyValue>
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-4 py-3.5">
          <span className="text-[13.5px]">DJ role</span>
          <select
            value={settings.djRoleId ?? ""}
            onChange={(event) =>
              onAct(
                () =>
                  api.patch(guildId, "settings", {
                    djRoleId: event.currentTarget.value || null,
                  }),
                "DJ role saved.",
              )
            }
            className={`${inputClass} max-w-[55%]`}
          >
            <option value="">none</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                @{role.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="text-[13.5px]">Starting volume</span>
          <input
            type="number"
            min={0}
            max={200}
            defaultValue={settings.defaultVolume}
            key={settings.defaultVolume}
            onBlur={(event) => {
              const value = Number(event.currentTarget.value);
              if (value === settings.defaultVolume) return;
              void onAct(
                () => api.patch(guildId, "settings", { defaultVolume: value }),
                "Starting volume saved.",
              );
            }}
            className={`${inputClass} w-20 text-right`}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Per-channel rules" meta="voice channels" />
        {channels.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--color-muted)]">
            No voice channels visible to Tsuki.
          </div>
        ) : (
          channels.map((channel, index) => {
            const rule = ruleFor(channel.id);
            return (
              <div
                key={channel.id}
                className={`px-4 py-[13px] ${
                  index === channels.length - 1
                    ? ""
                    : "border-b border-[var(--color-line)]"
                }`}
              >
                <div className="mb-2.5 font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--color-muted)]">
                  #{channel.name}
                </div>
                <div className="grid gap-2.5">
                  <RuleSwitch
                    label="Requests allowed"
                    on={rule.canRequest}
                    onChange={(next) => setRule(channel.id, { canRequest: next })}
                  />
                  <RuleSwitch
                    label="DJ role only"
                    on={rule.djRequired}
                    onChange={(next) => setRule(channel.id, { djRequired: next })}
                  />
                  <RuleSwitch
                    label="Locked — only a DJ can start Tsuki here"
                    on={rule.locked}
                    onChange={(next) => setRule(channel.id, { locked: next })}
                  />
                </div>
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
}

function RuleSwitch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px]">{label}</span>
      <Switch label={label} on={on} onChange={onChange} />
    </div>
  );
}
