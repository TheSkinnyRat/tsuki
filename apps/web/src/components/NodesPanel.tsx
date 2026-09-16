"use client";

import { useState } from "react";
import type { NodeSummary } from "@tsuki/shared";
import { api } from "@/lib/api.ts";

export function NodesPanel({
  guildId,
  nodes,
  onAct,
}: {
  guildId: string;
  nodes: NodeSummary[];
  onAct: (run: () => Promise<unknown>, success?: string) => Promise<void>;
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
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Audio nodes</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Tsuki plays through the Lavalink node this server provides. What it
          can play is whatever that node supports.
        </p>

        {nodes.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
            No node yet, so Tsuki cannot play anything here. Add one on the
            right.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {nodes.map((node) => (
              <li
                key={node.id}
                className="rounded-lg border border-[var(--color-line)] p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${
                      node.connected
                        ? "bg-emerald-500"
                        : node.enabled
                          ? "bg-amber-500"
                          : "bg-[var(--color-muted)]"
                    }`}
                  />
                  <span className="text-sm font-medium">{node.name}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                    {/* An instance node is the operator's machine, not this
                        guild's, so its address is not theirs to read. */}
                    {node.instanceProvided
                      ? "operator's node"
                      : `${node.host}:${node.port}${node.secure ? " · tls" : ""}`}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {node.instanceProvided ? (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)]">
                        not yours to change
                      </span>
                    ) : null}
                    <button
                      type="button"
                      hidden={node.instanceProvided}
                      onClick={() =>
                        onAct(
                          () =>
                            api.post(guildId, `nodes/${node.name}/enabled`, {
                              enabled: !node.enabled,
                            }),
                          node.enabled ? "Node disabled." : "Node enabled.",
                        )
                      }
                      className="rounded border border-[var(--color-line)] px-2 py-0.5 text-xs transition-colors duration-150 hover:border-[var(--color-accent)]"
                    >
                      {node.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      hidden={node.instanceProvided}
                      onClick={() =>
                        onAct(
                          () => api.del(guildId, `nodes/${node.name}`),
                          "Node removed.",
                        )
                      }
                      className="rounded border border-[var(--color-line)] px-2 py-0.5 text-xs transition-colors duration-150 hover:border-[var(--color-accent)]"
                    >
                      Remove
                    </button>
                  </span>
                </div>

                {node.capabilities ? (
                  <dl className="mt-2 grid gap-1 text-xs text-[var(--color-muted)]">
                    <div>
                      <dt className="inline font-medium">Lavalink</dt>{" "}
                      <dd className="inline">{node.capabilities.version}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Sources</dt>{" "}
                      <dd className="inline">
                        {node.capabilities.sources.join(", ") || "none"}
                      </dd>
                    </div>
                    {node.capabilities.plugins.length > 0 ? (
                      <div>
                        <dt className="inline font-medium">Plugins</dt>{" "}
                        <dd className="inline">
                          {node.capabilities.plugins.join(", ")}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                {!node.capabilities?.sources.includes("youtube") ? (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    No YouTube source. Lavalink v4 ships that as a separate
                    plugin — install <code>youtube-source</code> on the node for
                    YouTube links to work.
                  </p>
                ) : null}

                {node.lastError ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {node.lastError}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Add a node</h2>
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <Field
            label="Name"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            placeholder="main"
          />
          <Field
            label="Host"
            value={form.host}
            onChange={(host) => setForm({ ...form, host })}
            placeholder="lavalink.example.com"
          />
          <Field
            label="Port"
            value={form.port}
            onChange={(port) => setForm({ ...form, port })}
            placeholder="2333"
          />
          <Field
            label="Password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
            placeholder="the node's authorization value"
            type="password"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(event) =>
                setForm({ ...form, secure: event.target.checked })
              }
              className="accent-[var(--color-accent)]"
            />
            The node is behind HTTPS
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-halo)] disabled:opacity-40"
          >
            {busy ? "Checking the node…" : "Add node"}
          </button>
          <p className="text-xs text-[var(--color-muted)]">
            Tsuki connects once to read what the node supports before saving it,
            and stores the password encrypted. Private addresses are refused on
            the hosted instance.
          </p>
        </form>
      </section>
    </div>
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
      <span className="text-xs font-medium text-[var(--color-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
    </label>
  );
}
