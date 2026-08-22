"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ActivityItem, fetchActivity, fetchNotifications, markNotificationsRead, NotificationItem } from "@/app/lib/api";
import { Segmented } from "@/components/shared/Segmented";
import { relativeTime } from "@/components/shared/RunsPanel";
import { isProviderId } from "@/lib/connectors";
import { workflowHref } from "@/lib/portals";

/*
 * Workspace activity: what changed (system), who commented / tagged / took
 * ownership, connections added or needing reauth, failed runs — plus the
 * viewer's notifications (mentions, watched workflows, owned workflows).
 */

const KIND_LABEL: Record<string, string> = {
  "workflow.changed": "changed",
  "comment.created": "commented",
  "tag.applied": "tagged",
  "owner.set": "owner set",
  "notes.updated": "notes updated",
  "connection.added": "connected",
  "connection.needs_reauth": "needs reauth",
  "run.failed": "run failed",
};

function hrefFor(targetKey: string | null): string | null {
  if (!targetKey) return null;
  const parts = targetKey.split(":");
  const [kind] = parts;
  let provider: string | undefined, id: string | undefined, node: string | undefined;
  if (kind === "wf") [, provider, id] = parts;
  else if (kind === "node") [, provider, id, node] = parts;
  else if (kind === "issue") [, , provider, id, node] = parts;
  if (!provider || !id || !isProviderId(provider)) return null;
  const base = workflowHref({ source: provider, refId: id });
  return node && node !== "-" ? `${base}?node=${encodeURIComponent(node)}` : base;
}

function describe(a: ActivityItem): string {
  const p = a.payload as Record<string, string | number | string[] | undefined>;
  const name = (p.workflowName as string) || a.targetKey || "";
  switch (a.kind) {
    case "workflow.changed":
      return `${name}: ${p.count} change${p.count === 1 ? "" : "s"} detected (sync #${p.version})`;
    case "comment.created":
      return `commented on ${name}: “${(p.excerpt as string) ?? ""}”`;
    case "tag.applied":
      return `tagged ${name}: ${Array.isArray(p.tags) ? (p.tags as string[]).join(", ") : ""}`;
    case "owner.set":
      return `${p.ownerUserId ? "set the owner of" : "cleared the owner of"} ${name}`;
    case "notes.updated":
      return `updated the notes on ${name}`;
    case "connection.added":
      return `connected ${p.provider} ${p.label ?? p.externalId ?? ""}`;
    case "connection.needs_reauth":
      return `${p.provider} ${p.label ?? p.externalId ?? ""} needs re-authentication`;
    case "run.failed":
      return `${a.targetKey}: last run failed${p.error ? ` — ${p.error}` : ""}`;
    default:
      return a.kind;
  }
}

function Row({ a }: { a: ActivityItem }) {
  const href = hrefFor(a.targetKey);
  const body = (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="mt-[5px] size-[7px] shrink-0 rounded-full" style={{ background: a.kind === "run.failed" || a.kind === "connection.needs_reauth" ? "var(--err)" : a.kind === "workflow.changed" ? "var(--warn)" : "var(--t3)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-t1">
          <span className="font-semibold">{a.actorName ?? "Rippit"}</span> {describe(a)}
        </p>
        <p className="text-[10.5px] text-t3">
          {KIND_LABEL[a.kind] ?? a.kind} · {relativeTime(a.createdAt)}
        </p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-colors hover:bg-hover">{body}</Link>
  ) : (
    <div>{body}</div>
  );
}

export default function ActivityPage() {
  const [mode, setMode] = useState<"all" | "mine" | "watched" | "inbox">("inbox");
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [inbox, setInbox] = useState<{ unread: number; notifications: NotificationItem[] } | null>(null);
  const [error, setError] = useState("");
  const [gen, setGen] = useState(0);

  useEffect(() => {
    document.title = "Activity — Rippit";
  }, []);

  useEffect(() => {
    let live = true;
    if (mode === "inbox") {
      fetchNotifications()
        .then((d) => {
          if (!live) return;
          setInbox(d);
          setError("");
        })
        .catch((e: Error) => live && setError(e.message));
    } else {
      fetchActivity({ mine: mode === "mine", watched: mode === "watched", limit: 200 })
        .then((d) => {
          if (!live) return;
          setActivity(d.activity);
          setError("");
        })
        .catch((e: Error) => live && setError(e.message));
    }
    return () => {
      live = false;
    };
  }, [mode, gen]);

  const unread = inbox?.unread ?? 0;
  const rows = useMemo(() => (mode === "inbox" ? (inbox?.notifications ?? []).map((n) => ({ key: `n${n.id}`, a: n.activity, unread: !n.readAt })) : (activity ?? []).map((a) => ({ key: `a${a.id}`, a, unread: false }))), [mode, inbox, activity]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] flex-none items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t3 hover:text-t1" />
        <div className="h-4 w-px bg-line" aria-hidden="true" />
        <h1 className="text-[13.5px] font-semibold tracking-[-0.01em]">Activity</h1>
        <Segmented
          label="Activity scope"
          value={mode}
          options={[
            { value: "inbox", label: unread > 0 ? `Inbox (${unread})` : "Inbox" },
            { value: "all", label: "Everything" },
            { value: "mine", label: "Mine" },
            { value: "watched", label: "Watched" },
          ]}
          onChange={setMode}
        />
        <div className="flex-1" />
        {mode === "inbox" && unread > 0 && (
          <button
            type="button"
            onClick={() => markNotificationsRead().then(() => setGen((g) => g + 1)).catch(() => {})}
            className="rounded-control border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-t2 hover:text-t1"
          >
            Mark all read
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-card border border-line bg-panel">
          {error && <p role="alert" className="px-4 py-3 text-[12px] text-err-text">{error}</p>}
          {!error && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-[12px] italic text-t3">
              {mode === "inbox"
                ? "Nothing for you yet — you're notified when someone @mentions you, and for changes, comments and failed runs on workflows you watch or own."
                : "No activity yet. Syncs that detect changes, comments, tags, owners and connections show up here."}
            </p>
          )}
          <ul className="divide-y divide-line2">
            {rows.map((r) => (
              <li key={r.key} className={r.unread ? "bg-[color-mix(in_srgb,var(--warn)_6%,transparent)]" : ""}>
                <Row a={r.a} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
