"use client";

import { useState } from "react";
import type { NodeSummary } from "@tsuki/shared";
import { api } from "@/lib/api.ts";
import { Panel, PanelHeader, SmallButton, Switch } from "./ui.tsx";

type Act = (run: () => Promise<unknown>, success?: string) => Promise<void>;

export function NodesPanel({
  guildId,
  nodes,
  onAct,
}: {
  guildId: string;
  nodes: NodeSummary[];
  onAct: Act;
}) {
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: "2333",
    password: "",
    secure: false,
  });
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onAct(
      () =>
        api.post(guildId, "nodes", {
          name: form.name.trim(),
          host: form.host.trim(),
          port: Number(form.port),
          password: form.password,
          secure: form.secure,
        }),
      "Node added.",
    );
    setForm({ name: "", host: "", port: "2333", password: "", secure: false });
    setBusy(false);
  }

  return (
    <div className="grid gap-4">
      <p className="text-[13px] text-[var(--color-muted)]">
        Tsuki plays through the Lavalink node this server provides. What it can
        play is whatever that node supports.
      </p>

      <Panel>
        <PanelHeader title="Audio nodes" meta={`${nodes.length} configured`} />
        {nodes.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--color-muted)]">
            No node yet, so Tsuki cannot play anything here.
          </div>
        ) : (
          nodes.map((node, index) => {
            const caps = node.capabilities;
            return (
              <div
                key={node.id}
                className={`px-4 py-[13px] ${
                  index === nodes.length - 1
                    ? ""
                    : "border-b border-[var(--color-line)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`size-[5px] flex-none rounded-full ${
                      node.connected
                        ? "bg-emerald-500"
                        : node.enabled
                          ? "bg-amber-500"
                          : "bg-[var(--color-muted)]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">
                      {node.name}
                    </span>
                    <span className="block truncate font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-muted)]">
                      {node.instanceProvided
                        ? "operator's node · not yours to change"
                        : `${node.host}:${node.port}${node.secure ? " · tls" : ""}`}
                    </span>
                  </span>
                  {node.instanceProvided ? null : (
                    <>
                      <Switch
                        label={`${node.name} enabled`}
                        on={node.enabled}
                        onChange={(next) =>
                          onAct(
                            () =>
                              api.post(
                                guildId,
                                `nodes/${encodeURIComponent(node.name)}/enabled`,
                                { enabled: next },
                              ),
                            next ? "Node enabled." : "Node disabled.",
                          )
                        }
                      />
                      <button
                        type="button"
                        title={`Remove ${node.name}`}
                        aria-label={`Remove ${node.name}`}
                        onClick={() =>
                          onAct(
                            () =>
                              api.del(
                                guildId,
                                `nodes/${encodeURIComponent(node.name)}`,
                              ),
                            "Node removed.",
                          )
                        }
                        className="size-[22px] flex-none cursor-pointer rounded-md border border-transparent bg-transparent text-[13px] leading-none text-[var(--color-muted)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>

                {caps ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[15px]">
                    <Tag>lavalink {caps.version}</Tag>
                    {caps.sources.map((source) => (
                      <Tag key={source}>{source}</Tag>
                    ))}
                    {caps.plugins.map((plugin) => (
                      <Tag key={plugin} halo>
                        {plugin}
                      </Tag>
                    ))}
                  </div>
                ) : null}
                {caps && !caps.sources.includes("youtube") ? (
                  <p className="mt-2 pl-[15px] text-xs text-[var(--color-muted)]">
                    No YouTube source — Lavalink v4 ships it as the separate
                    youtube-source plugin.
                  </p>
                ) : null}
                {node.lastError ? (
                  <p className="mt-2 pl-[15px] text-xs text-amber-600 dark:text-amber-400">
                    {node.lastError}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Add a node" />
        <form onSubmit={submit} className="grid gap-3 px-4 py-[13px]">
          <div className="grid grid-cols-[1fr_1fr] gap-3 max-sm:grid-cols-1">
            <Field label="Name" value={form.name} placeholder="main" onChange={(name) => setForm({ ...form, name })} />
            <Field label="Host" value={form.host} placeholder="lavalink.example.com" onChange={(host) => setForm({ ...form, host })} />
            <Field label="Port" value={form.port} placeholder="2333" onChange={(port) => setForm({ ...form, port })} />
            <Field label="Password" type="password" value={form.password} placeholder="authorization value" onChange={(password) => setForm({ ...form, password })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13.5px]">Behind HTTPS</span>
            <Switch
              label="Behind HTTPS"
              on={form.secure}
              onChange={(secure) => setForm({ ...form, secure })}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !form.name.trim() || !form.host.trim()}
            className="h-9 cursor-pointer rounded-[9px] border-0 bg-[var(--color-accent)] text-[13px] text-[var(--color-on-accent)] hover:opacity-[0.88] disabled:cursor-default disabled:opacity-40"
          >
            {busy ? "Checking the node…" : "Add node"}
          </button>
          <p className="text-xs text-[var(--color-muted)]">
            Tsuki connects once to read what the node supports before saving it,
            and stores the password encrypted. Private addresses are refused on
            the hosted instance.
          </p>
        </form>
      </Panel>
    </div>
  );
}

function Tag({ children, halo }: { children: React.ReactNode; halo?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-px font-[family-name:var(--font-mono)] text-[11px] ${
        halo
          ? "border-[var(--color-halo)] text-[var(--color-halo)]"
          : "border-[var(--color-line)] text-[var(--color-muted)]"
      }`}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[9px] border border-[var(--color-line)] bg-transparent px-3 text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-halo)]"
      />
    </label>
  );
}
