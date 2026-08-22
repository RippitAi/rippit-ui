"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ackVersion, fetchWorkflowChanges, NodeId, WorkflowChange, WorkflowChanges } from "@/app/lib/api";
import type { ProviderId } from "@/lib/connectors/types";
import { relativeTime } from "@/components/shared/RunsPanel";

/*
 * What changed in this workflow, newest first, grouped by version (one sync
 * that changed something). Rows carry kind, plain-English summary, who/when
 * hint (Make edit events) and jump to the node. Unseen rows (newer than the
 * viewer's last visit) are marked.
 */

const KIND_TONE: Record<string, { accent: string; label: string }> = {
  "node-added": { accent: "var(--ok)", label: "added" },
  "node-removed": { accent: "var(--err)", label: "removed" },
  "node-changed": { accent: "var(--warn)", label: "changed" },
  "node-reordered": { accent: "var(--off)", label: "moved" },
  "edge-added": { accent: "var(--ok)", label: "connected" },
  "edge-removed": { accent: "var(--err)", label: "disconnected" },
  "ref-added": { accent: "var(--ok)", label: "new reference" },
  "ref-removed": { accent: "var(--warn)", label: "reference dropped" },
  renamed: { accent: "var(--off)", label: "renamed" },
  "status-changed": { accent: "var(--warn)", label: "status" },
};

export function ChangeRow({ c, onSelectNode }: { c: WorkflowChange; onSelectNode?: (id: NodeId) => void }) {
  const t = KIND_TONE[c.kind] ?? { accent: "var(--off)", label: c.kind };
  return (
    <li className={`rounded-control border border-line2 bg-panel px-2.5 py-2 ${c.unseen ? "" : "opacity-80"}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: t.accent, boxShadow: `0 0 6px ${t.accent}` }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-t3">{t.label}</span>
        {c.unseen && <span className="rounded-full border border-line px-1.5 py-[1px] text-[9px] font-semibold text-warn-text">new</span>}
        <span className="ml-auto text-[10px] text-t3" title={new Date(c.detectedAt).toLocaleString()}>
          {relativeTime(c.detectedAt)}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-t1">{c.summary}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-t3">
        {c.authorHint?.name && <span>by {c.authorHint.name}</span>}
        {c.nodeId && onSelectNode && (
          <button
            type="button"
            onClick={() => onSelectNode(c.nodeId!)}
            className="rounded-full border border-line px-2 py-[1px] font-mono text-[9.5px] text-t2 hover:text-t1"
          >
            step {c.nodeId}
          </button>
        )}
        {c.kind === "node-changed" && Array.isArray(c.after?.fields) && (
          <span>· {(c.after!.fields as string[]).map((f) => (f === "config_hash" ? "configuration" : f)).join(", ")}</span>
        )}
      </div>
    </li>
  );
}

export function ChangesPanel({
  provider,
  externalId,
  onClose,
  onSelectNode,
  onData,
}: {
  provider: ProviderId;
  externalId: string;
  onClose: () => void;
  onSelectNode?: (nodeId: NodeId) => void;
  onData?: (data: WorkflowChanges) => void;
}) {
  const [data, setData] = useState<WorkflowChanges | null>(null);
  const [error, setError] = useState("");
  const [gen, setGen] = useState(0);

  useEffect(() => {
    let live = true;
    fetchWorkflowChanges(provider, externalId)
      .then((d) => {
        if (!live) return;
        const lastSeen = d.lastSeenAt;
        const marked = { ...d, changes: d.changes.map((c) => ({ ...c, unseen: !lastSeen || c.detectedAt > lastSeen })) };
        setData(marked);
        onData?.(marked);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, externalId, gen]);

  const byVersion = new Map<number, WorkflowChange[]>();
  for (const c of data?.changes ?? []) byVersion.set(c.version, [...(byVersion.get(c.version) ?? []), c]);
  const versions = [...byVersion.keys()].sort((a, b) => b - a);
  const versionMeta = new Map((data?.versions ?? []).map((v) => [v.version, v]));

  return (
    <aside
      role="dialog"
      aria-label="Changes"
      className="absolute bottom-3 right-3 top-3 z-[3] flex w-[380px] max-w-[calc(100%-24px)] flex-col rounded-card border border-line bg-pill shadow-[0_16px_40px_var(--ambient)]"
    >
      <header className="flex items-center gap-2 border-b border-line2 px-3.5 py-2.5">
        <h2 className="text-[12.5px] font-semibold">Changes</h2>
        {data && (
          <span className="text-[10.5px] text-t3">
            {data.changes.length} · {data.unseen} new since you last looked
          </span>
        )}
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close changes" className="flex size-6 items-center justify-center rounded-control border border-line text-t3 hover:text-t1">
          <X aria-hidden="true" className="size-3" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {error && <p role="alert" className="px-1.5 text-[11px] text-err-text">{error}</p>}
        {!data && !error && <p className="px-1.5 text-[11px] text-t3">Loading…</p>}
        {data && data.changes.length === 0 && (
          <p className="px-1.5 text-[11px] text-t3">
            No changes recorded yet. Rippit snapshots this workflow on every sync and lists what differs from the previous snapshot.
          </p>
        )}
        {versions.map((v) => {
          const meta = versionMeta.get(v);
          const rows = byVersion.get(v) ?? [];
          return (
            <section key={v} className="mb-3">
              <h3 className="mb-1 flex items-center gap-2 px-1 text-[10px] font-semibold text-t3">
                <span>Sync #{v}</span>
                {meta?.syncedAt && <span title={new Date(meta.syncedAt).toLocaleString()}>· {relativeTime(meta.syncedAt)}</span>}
                {meta?.authorHint?.name && <span>· edited by {meta.authorHint.name}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  {meta?.acks && meta.acks.length > 0 && (
                    <span className="text-ok-text" title={meta.acks.map((a) => a.name).join(", ")}>
                      reviewed by {meta.acks.map((a) => a.name).slice(0, 2).join(", ")}{meta.acks.length > 2 ? ` +${meta.acks.length - 2}` : ""}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => ackVersion(provider, externalId, v).then(() => setGen((g) => g + 1)).catch(() => {})}
                    className="rounded-full border border-line px-2 py-[1px] text-[9.5px] font-semibold text-t2 hover:text-t1"
                  >
                    Mark reviewed
                  </button>
                </span>
              </h3>
              <ul className="flex flex-col gap-1">
                {rows.map((c) => (
                  <ChangeRow key={c.id} c={c} onSelectNode={onSelectNode} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <footer className="border-t border-line2 px-3.5 py-1.5 text-[10px] text-t3">
        Detected by Rippit at sync (platform-independent); who/when comes from Make&apos;s edit log where available.
      </footer>
    </aside>
  );
}
