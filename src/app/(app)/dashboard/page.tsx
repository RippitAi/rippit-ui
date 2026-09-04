"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Boxes, ChevronDown, Link2, Network, Search, Unplug, type LucideIcon } from "lucide-react";
import { useConnections, useWorkflowIndex, WorkflowIndexEntry } from "@/components/app/ConnectionsProvider";
import { getConnector } from "@/lib/connectors";
import { Segmented } from "@/components/shared/Segmented";
import { useTags } from "@/components/tags/tags-context";
import { TagChip } from "@/components/tags/TagChip";
import { TagFilter, matchesTags } from "@/components/tags/TagFilter";
import type { Tag, LastRun } from "@/app/lib/api";
import { LastRunChip, relativeTime } from "@/components/shared/RunsPanel";
import { SaveViewButton } from "@/components/shared/SaveViewButton";
import { fetchMembers, fetchViews } from "@/app/lib/api";
import { useAuth } from "@/components/app/AuthProvider";
import { useWorkspace } from "@/components/app/WorkspaceProvider";
import { workflowHref } from "@/lib/portals";
import { AppPuck } from "@/components/shared/AppPuck";
import { StatusPill } from "@/components/shared/StatusPill";
import { RowCard, ViewBar, ViewBody, ViewTitle } from "@/components/views/ViewFrame";
import { CaptureBadge } from "@/components/shared/CaptureBadge";
import type { CaptureState } from "@/app/lib/api";
import { useCountUp } from "@/lib/useCountUp";

/*
 * Dashboard = the library. Four stat cards, then every workflow as a card
 * list you can group (platform · folder · tag · owner · status · changed),
 * filter (tags · All/Mine/Watched · status · search) and save as a view.
 */

type Tone = "active" | "paused" | "inactive";
type GroupBy = "platform" | "folder" | "tag" | "owner" | "status" | "changed";

function toneOf(w: WorkflowIndexEntry): Tone {
  if (w.status === "paused") return "paused";
  return w.live ? "active" : "inactive";
}
const PILL_TONE: Record<Tone, "ok" | "warn" | "muted"> = { active: "ok", paused: "warn", inactive: "muted" };

function Stat({ label, value, icon: Icon, delay, danger }: { label: string; value: number; icon: LucideIcon; delay: number; danger?: boolean }) {
  const n = useCountUp(value, delay * 1000);
  return (
    <div className="flex items-center gap-[11px] rounded-card border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow-card)] anim-fade-up" style={{ animationDelay: `${delay}s` }}>
      <span className="inline-flex size-[30px] flex-none items-center justify-center rounded-control border border-line bg-hover" style={{ color: danger && value > 0 ? "var(--err-text)" : "var(--t2)" }}>
        <Icon aria-hidden="true" className="size-[13px]" />
      </span>
      <span>
        <span className="tabular block text-[18px] font-bold leading-none">{n}</span>
        <span className="mt-[3px] block text-[10.5px] text-t3">{label}</span>
      </span>
    </div>
  );
}

function WorkflowRow({ workflow, tags, lastRun, changed, accountName, capture }: { workflow: WorkflowIndexEntry; tags?: Tag[]; lastRun?: LastRun; changed?: number; accountName?: string; capture?: CaptureState }) {
  const connector = getConnector(workflow.provider);
  const tone = toneOf(workflow);
  const folder = workflow.groupPath.length > 1 ? workflow.groupPath[workflow.groupPath.length - 1] : null;
  return (
    <Link href={workflowHref({ source: workflow.provider, refId: workflow.refId })} className="group flex w-full items-center gap-2.5 border-b border-line2 px-3.5 py-2.5 text-left transition-[background] duration-[var(--dur-fast)] ease-[var(--ease-out)] last:border-b-0 hover:bg-hover">
      <span className="transition-transform duration-[var(--dur-fast)] group-hover:-translate-y-[2px]">
        <AppPuck app={workflow.provider} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-t1">{workflow.name}</span>
        <span className="tabular mt-[1px] block truncate font-mono text-[9.5px] text-t3">
          {connector.shortLabel}
          {accountName ? ` · ${accountName}` : ""}
          {folder ? ` · ${folder}` : ""}
          {lastRun?.at ? ` · last run ${relativeTime(lastRun.at)}` : ""}
        </span>
      </span>
      {tags && tags.length > 0 && (
        <span className="hidden items-center gap-1 md:flex">
          {tags.slice(0, 2).map((t) => (
            <TagChip key={t.id} tag={t} size="xs" />
          ))}
          {tags.length > 2 && <span className="text-[10.5px] text-t3">+{tags.length - 2}</span>}
        </span>
      )}
      {/* Rippit failing to read is shown separately from the estate being
          broken — never merged into the status pill. */}
      <CaptureBadge capture={capture} compact />
      {lastRun && (lastRun.status === "error" || lastRun.status === "incomplete") && <LastRunChip status={lastRun.status} at={lastRun.at} />}
      {changed ? <StatusPill pill={{ label: String(changed), tone: "info" }} dot={false} /> : null}
      <StatusPill pill={{ label: tone, tone: PILL_TONE[tone] }} />
    </Link>
  );
}

export default function DashboardPage() {
  const { connections, loading, linkMap } = useConnections();
  const all = useWorkflowIndex();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Tone | "all">("all");
  const { tags: allTags } = useTags();
  const searchParams = useSearchParams();
  const [tagFilter, setTagFilter] = useState<string[]>(() => {
    const t = searchParams.get("tag");
    return t ? [t] : [];
  });
  const [scope, setScope] = useState<"all" | "mine" | "watched">("all");
  const { user } = useAuth();
  const { current: workspace } = useWorkspace();
  const [groupBy, setGroupBy] = useState<GroupBy>("platform");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    document.title = "Dashboard — Rippit";
  }, []);
  useEffect(() => {
    if (!workspace) return;
    let live = true;
    fetchMembers(workspace.id)
      .then((d) => live && setMemberNames(new Map(d.members.map((m) => [m.user_id, m.display_name || m.email || m.user_id]))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [workspace]);
  const viewId = searchParams.get("view");
  useEffect(() => {
    if (!viewId) return;
    let live = true;
    fetchViews()
      .then((d) => {
        const v = d.views.find((x) => x.id === viewId && x.kind === "dashboard");
        if (!v || !live) return;
        const f = v.filters as { tags?: string[]; status?: Tone | "all"; scope?: "all" | "mine" | "watched"; query?: string; groupBy?: GroupBy };
        if (f.groupBy) setGroupBy(f.groupBy);
        if (f.tags) setTagFilter(f.tags);
        if (f.status) setStatusFilter(f.status);
        if (f.scope) setScope(f.scope);
        if (typeof f.query === "string") setQuery(f.query);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [viewId]);

  const byKey = useMemo(() => {
    const m = new Map<string, { owner?: string; watching?: boolean; changed?: number; lastRun?: LastRun; tags?: Tag[]; capture?: CaptureState }>();
    for (const w of linkMap?.workflows ?? []) m.set(`${w.source}:${w.refId}`, { owner: w.ownerUserId, watching: w.watching, changed: w.changedSince?.count, lastRun: w.lastRun, tags: w.tags, capture: w.capture });
    return m;
  }, [linkMap]);
  const accountOf = useMemo(() => new Map(connections.map((c) => [c.id, c.displayName])), [connections]);

  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, inactive: 0 };
    for (const w of all) c[toneOf(w)]++;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((w) => {
      const k = byKey.get(`${w.provider}:${w.refId}`);
      if (statusFilter !== "all" && toneOf(w) !== statusFilter) return false;
      if (!matchesTags(k?.tags, tagFilter)) return false;
      if (scope === "mine" && k?.owner !== user?.id) return false;
      if (scope === "watched" && !k?.watching) return false;
      if (!q) return true;
      return w.name.toLowerCase().includes(q) || w.groupPath.some((g) => g.toLowerCase().includes(q)) || w.provider.includes(q);
    });
  }, [all, query, statusFilter, tagFilter, byKey, scope, user]);

  const groups = useMemo(() => {
    const keyOf = (w: WorkflowIndexEntry): { id: string; label: string; sub?: string }[] => {
      const k = byKey.get(`${w.provider}:${w.refId}`);
      switch (groupBy) {
        case "platform":
          return [{ id: `p:${w.connectionId}`, label: `${getConnector(w.provider).shortLabel} · ${accountOf.get(w.connectionId) ?? getConnector(w.provider).label}` }];
        case "folder":
          return [{ id: `f:${w.provider}:${w.groupPath.join("/")}`, label: w.groupPath.length ? w.groupPath.join(" / ") : "No folder", sub: getConnector(w.provider).shortLabel }];
        case "tag": {
          const ts = k?.tags ?? [];
          return ts.length ? ts.map((t) => ({ id: `t:${t.id}`, label: t.name })) : [{ id: "t:none", label: "Untagged" }];
        }
        case "owner": {
          const o = k?.owner;
          return [{ id: `o:${o ?? "none"}`, label: o ? memberNames.get(o) ?? "Owner" : "No owner" }];
        }
        case "status":
          return [{ id: `s:${toneOf(w)}`, label: toneOf(w) }];
        case "changed": {
          const n = k?.changed ?? 0;
          return [{ id: n ? "c:changed" : "c:same", label: n ? "Changed since you last looked" : "Unchanged" }];
        }
      }
    };
    const map = new Map<string, { id: string; label: string; sub?: string; items: WorkflowIndexEntry[] }>();
    for (const w of filtered) {
      for (const g of keyOf(w)) {
        const entry = map.get(g.id) ?? { ...g, items: [] };
        entry.items.push(w);
        map.set(g.id, entry);
      }
    }
    const order = (g: { id: string }) => (g.id.endsWith(":none") || g.id === "c:same" ? 1 : 0);
    return [...map.values()].sort((a, b) => order(a) - order(b) || b.items.length - a.items.length || a.label.localeCompare(b.label));
  }, [filtered, groupBy, byKey, accountOf, memberNames]);

  const nothingConnected = !loading && connections.length === 0;
  const platformsMeta = connections.length > 0 ? connections.map((c) => `${getConnector(c.provider).shortLabel} · ${c.displayName}`).join(", ") : "no platforms connected";
  const broken = (linkMap?.stats.deadLinks ?? 0) + (linkMap?.stats.issueErrors ?? 0);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ViewBar title="Dashboard" meta={platformsMeta}>
        <Segmented
          label="Group by"
          value={groupBy}
          options={[
            { value: "platform", label: "Platform" },
            { value: "folder", label: "Folder" },
            { value: "tag", label: "Tag" },
            { value: "owner", label: "Owner" },
            { value: "status", label: "Status" },
            { value: "changed", label: "Changed" },
          ]}
          onChange={setGroupBy}
        />
        <SaveViewButton kind="dashboard" filters={{ tags: tagFilter, status: statusFilter, scope, query, groupBy }} />
      </ViewBar>
      <ViewBody width={760}>
        <ViewTitle title="Dashboard" sub={loading ? "loading workspace…" : `${all.length} workflow${all.length === 1 ? "" : "s"} · ${counts.active} active · ${linkMap?.stats.links ?? 0} cross-links`} />
        <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Workflows" value={all.length} icon={Network} delay={0} />
          <Stat label="Active" value={counts.active} icon={Boxes} delay={0.05} />
          <Stat label="Cross-links" value={linkMap?.stats.links ?? 0} icon={Link2} delay={0.1} />
          <Link href="/health" aria-label={`Health — ${broken} broken`} title="Open the health board" className="block rounded-card transition-transform duration-[var(--dur-fast)] hover:-translate-y-[1px]">
            <Stat label="Broken · Health board" value={broken} icon={Unplug} delay={0.15} danger />
          </Link>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <TagFilter tags={allTags} selected={tagFilter} onChange={setTagFilter} />
          <Segmented label="Scope" value={scope} options={[{ value: "all", label: "All" }, { value: "mine", label: "Mine" }, { value: "watched", label: "Watched" }]} onChange={setScope} />
          <Segmented label="Filter workflows by status" value={statusFilter} options={(["all", "active", "paused", "inactive"] as const).map((f) => ({ value: f, label: f }))} onChange={setStatusFilter} />
          <div className="flex-1" />
          <label className="flex h-[26px] items-center gap-[7px] rounded-control border border-line bg-hover px-[9px] transition-[border-color] duration-[var(--dur-fast)] focus-within:border-line-strong">
            <Search aria-hidden="true" className="size-[11px] text-t3" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search workflows" className="w-[140px] min-w-0 border-0 bg-transparent text-[12px] text-t1 outline-none placeholder:text-t3" />
          </label>
          <span className="tabular font-mono text-[10px] text-t3">{filtered.length}</span>
        </div>

        <RowCard delay={0.18}>
          {loading && (
            <div role="status" aria-label="Loading workflows" className="flex flex-col gap-2 p-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} aria-hidden="true" className="h-[38px] animate-pulse rounded-row bg-hover motion-reduce:animate-none" />
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-t3">
              {nothingConnected ? (
                <>
                  No workflows yet —{" "}
                  <Link href="/settings/connections" className="font-semibold text-t1 underline-offset-4 hover:underline">
                    connect a platform
                  </Link>{" "}
                  to pull them in.
                </>
              ) : all.length === 0 ? (
                "Nothing synced yet — try Sync now in Settings."
              ) : (
                "No workflows match"
              )}
            </p>
          )}
          {!loading &&
            groups.map((g) => {
              const isCollapsed = collapsed.has(g.id);
              return (
                <section key={g.id} aria-label={g.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => {
                        const n = new Set(c);
                        if (n.has(g.id)) n.delete(g.id);
                        else n.add(g.id);
                        return n;
                      })
                    }
                    aria-expanded={!isCollapsed}
                    className="sticky top-0 z-[1] flex w-full cursor-pointer items-center gap-2 border-b border-line2 bg-panel/95 px-3.5 py-1.5 text-left backdrop-blur-[6px]"
                  >
                    <ChevronDown aria-hidden="true" className={`size-3 text-t3 transition-transform duration-[var(--dur-fast)] ${isCollapsed ? "-rotate-90" : ""}`} />
                    <span className="text-[12px] font-semibold text-t1">{g.label}</span>
                    {g.sub && <span className="text-[11px] text-t3">{g.sub}</span>}
                    <span className="tabular rounded-[5px] border border-line bg-hover px-1.5 py-0.5 font-mono text-[10px] text-t2">{g.items.length}</span>
                  </button>
                  {!isCollapsed &&
                    g.items.map((w) => {
                      const k = byKey.get(`${w.provider}:${w.refId}`);
                      return <WorkflowRow key={`${g.id}|${w.provider}:${w.refId}`} workflow={w} tags={k?.tags} lastRun={k?.lastRun} changed={k?.changed} accountName={accountOf.get(w.connectionId)} capture={k?.capture} />;
                    })}
                </section>
              );
            })}
        </RowCard>
      </ViewBody>
    </div>
  );
}
