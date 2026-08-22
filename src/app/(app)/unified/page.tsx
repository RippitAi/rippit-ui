"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  WorkflowCard,
  Connection,
  ModuleInfo,
  NodeId,
  fetchGraph,
  GraphData,
} from "@/app/lib/api";
import { parseWorkflowId, workflowHref, WorkflowRef } from "@/lib/portals";
import { isProviderId } from "@/lib/connectors";
import { kindLabel } from "@/components/shared/AssetsSection";
import { IssueCountChips } from "@/components/shared/IssuesSection";
import { LastRunChip } from "@/components/shared/RunsPanel";
import { useTags } from "@/components/tags/tags-context";
import { TagChip } from "@/components/tags/TagChip";
import { TagFilter, matchesTags } from "@/components/tags/TagFilter";
import { SaveViewButton } from "@/components/shared/SaveViewButton";
import { fetchViews } from "@/app/lib/api";
import { useConnections } from "@/components/app/ConnectionsProvider";
import { allConnectors, badgeTooltip, providerColor } from "@/lib/connectors";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import { StatChip } from "@/components/shared/StatChip";
import { Legend } from "@/components/canvas/Legend";
import { Segmented } from "@/components/shared/Segmented";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorCard } from "@/components/shared/ErrorCard";

const EASE = [0.22, 1, 0.36, 1] as const;
/* Node-level view renders at most this many auto-selected workflows; bigger
   estates must pick a linked set (readability — see brainstorm/mvp/04). */
const DETAIL_AUTO_MAX = 12;

const cardId = (w: { source: string; refId: string }) =>
  `${w.source}:${w.refId}`;

export default function UnifiedPage() {
  const router = useRouter();
  const {
    linkMap,
    connections,
    loading: connectionsLoading,
    refresh,
  } = useConnections();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view");
  const [mode, setMode] = useState<"map" | "detail" | "list">(
    initialView === "detail" ? "detail" : initialView === "list" ? "list" : "map"
  );
  // Node-level "linked set": explicit ?focus=make:912,ghl:wf1 or the
  // engine's auto-selected linkable set.
  const focus = useMemo<WorkflowRef[]>(() => {
    const raw = searchParams.get("focus") ?? "";
    return raw
      .split(",")
      .map((t) => parseWorkflowId(t.trim()))
      .filter((r): r is WorkflowRef => !!r && isProviderId(r.source));
  }, [searchParams]);
  const [graph, setGraph] = useState<{ key: string; data?: GraphData; error?: string } | null>(null);
  const [showAssets, setShowAssets] = useState(false);
  const { tags: allTags } = useTags();
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [changedOnly, setChangedOnly] = useState(false);
  const viewId = searchParams.get("view");
  useEffect(() => {
    if (!viewId) return;
    let live = true;
    fetchViews()
      .then((d) => {
        const v = d.views.find((x) => x.id === viewId && x.kind === "unified");
        if (!v || !live) return;
        const f = v.filters as { tags?: string[]; linkedOnly?: boolean; showAssets?: boolean; changedOnly?: boolean; mode?: "map" | "detail" | "list" };
        if (f.tags) setTagFilter(f.tags);
        if (typeof f.linkedOnly === "boolean") setLinkedChoice(f.linkedOnly);
        if (typeof f.showAssets === "boolean") setShowAssets(f.showAssets);
        if (typeof f.changedOnly === "boolean") setChangedOnly(f.changedOnly);
        if (f.mode) setMode(f.mode);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [viewId]);
  // null = no explicit choice yet → default to linked-only unless there are no links
  const [linkedChoice, setLinkedChoice] = useState<boolean | null>(null);
  const linkedOnly = linkedChoice ?? (linkMap ? linkMap.stats.links > 0 : true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Workflow map — Rippit";
  }, []);

  const focusKey = focus.map((f) => `${f.source}:${f.refId}`).join(",");
  useEffect(() => {
    if (mode !== "detail") return;
    let live = true;
    fetchGraph(focus)
      .then((d) => live && setGraph({ key: focusKey, data: d }))
      .catch((e: Error) => live && setGraph({ key: focusKey, error: e.message }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, focusKey]);
  const graphCurrent = graph && graph.key === focusKey ? graph : null;

  /* Per-workflow link involvement (for filtering + list badges). */
  const linkInfo = useMemo(() => {
    const info = new Map<string, { in: number; out: number; dead: boolean }>();
    if (!linkMap) return info;
    const bump = (key: string, dir: "in" | "out", dead: boolean) => {
      const cur = info.get(key) ?? { in: 0, out: 0, dead: false };
      cur[dir] += 1;
      cur.dead = cur.dead || dead;
      info.set(key, cur);
    };
    for (const l of linkMap.links) {
      bump(cardId(l.from), "out", l.status === "dead");
      bump(cardId(l.to), "in", l.status === "dead");
    }
    return info;
  }, [linkMap]);

  /* Workflows that share at least one asset with another (for "Linked only"
     when assets are shown). */
  const assetLinkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of linkMap?.assetLinks ?? []) for (const w of a.workflows) ids.add(cardId(w));
    return ids;
  }, [linkMap]);

  /* Map data: one node per workflow, links as orange edges. */
  const mapData = useMemo(() => {
    if (!linkMap) return null;
    let workflows = linkMap.workflows.filter((w) => matchesTags(w.tags, tagFilter) && (!changedOnly || (w.changedSince?.count ?? 0) > 0));
    if (linkedOnly)
      workflows = workflows.filter(
        (w) => linkInfo.has(cardId(w)) || (showAssets && assetLinkedIds.has(cardId(w)))
      );
    const nodeIds = new Set(workflows.map(cardId));
    const modules: ModuleInfo[] = workflows.map((w) => ({
      id: cardId(w),
      module: "workflow",
      app: w.source,
      label: w.name,
      depth: 0,
      x: null,
      y: null,
      hasFilter: false,
      filterName: null,
      hasErrorHandler: false,
      source: w.source,
      kind: "workflow-card",
      badge: w.talksToGhl && !linkInfo.has(cardId(w)) ? "talksToGhl" : undefined,
      issues:
        w.issueCounts && (w.issueCounts.error > 0 || w.issueCounts.warn > 0)
          ? (linkMap.issues ?? []).filter(
              (i) => i.provider === w.source && String(i.workflowExternalId) === String(w.refId) && i.severity !== "info"
            )
          : undefined,
    }));
    const connections: Connection[] = linkMap.links
      .filter((l) => nodeIds.has(cardId(l.from)) && nodeIds.has(cardId(l.to)))
      .map((l) => ({
        from: cardId(l.from),
        to: cardId(l.to),
        kind: l.kind,
        status: l.status,
        label: l.kind === "subflow" ? "subflow" : "webhook",
      }));
    if (showAssets) {
      // "Both touch Sheet X": one dotted edge per pair per asset (chain the
      // workflows so N users of one asset draw N-1 edges, not N²).
      const seen = new Set<string>();
      for (const a of linkMap.assetLinks ?? []) {
        const members = a.workflows.map(cardId).filter((id) => nodeIds.has(id));
        for (let i = 1; i < members.length; i++) {
          const key = `${members[i - 1]}|${members[i]}|${a.kind}:${a.value}`;
          if (seen.has(key)) continue;
          seen.add(key);
          connections.push({
            from: members[i - 1],
            to: members[i],
            kind: "shared-asset",
            label: a.label || kindLabel(a.kind),
          });
        }
      }
    }
    return { modules, connections };
  }, [linkMap, linkedOnly, linkInfo, showAssets, assetLinkedIds, tagFilter, changedOnly]);

  const handleMapClick = useCallback(
    (nodeId: NodeId) => {
      const ref = parseWorkflowId(nodeId);
      if (ref) router.push(workflowHref(ref));
    },
    [router]
  );

  /* Detail (node-level) view: node ids are "{provider}:{wf}:{node}" → open
     that workflow with the node selected. */
  const handleDetailClick = useCallback(
    (nodeId: NodeId) => {
      const s = String(nodeId);
      const first = s.indexOf(":");
      const second = s.indexOf(":", first + 1);
      if (first < 0 || second < 0) return;
      const source = s.slice(0, first);
      if (!isProviderId(source)) return;
      const refId = s.slice(first + 1, second);
      const node = s.slice(second + 1);
      router.push(`${workflowHref({ source, refId })}?node=${encodeURIComponent(node)}`);
    },
    [router]
  );

  /* List data: one section per connector, searchable. */
  const listSections = useMemo(() => {
    if (!linkMap) return [];
    const q = query.trim().toLowerCase();
    const match = (w: WorkflowCard) =>
      (!q || w.name.toLowerCase().includes(q)) &&
      matchesTags(w.tags, tagFilter) &&
      (!changedOnly || (w.changedSince?.count ?? 0) > 0) &&
      (!linkedOnly || linkInfo.has(cardId(w)));
    const sortByLinks = (a: WorkflowCard, b: WorkflowCard) => {
      const la = linkInfo.get(cardId(a));
      const lb = linkInfo.get(cardId(b));
      return (
        (lb ? lb.in + lb.out : 0) - (la ? la.in + la.out : 0) ||
        a.name.localeCompare(b.name)
      );
    };
    return allConnectors().map((connector) => ({
      connector,
      rows: linkMap.workflows
        .filter((w) => w.source === connector.id && match(w))
        .sort(sortByLinks),
    }));
  }, [linkMap, query, linkedOnly, linkInfo, tagFilter, changedOnly]);

  if (connectionsLoading && !linkMap) {
    return <LoadingState message="Loading workflow map…" />;
  }

  if (!linkMap && connections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="card-sharp w-full max-w-md rounded-card border border-line bg-panel p-6 text-center backdrop-blur-[14px]">
          <h1 className="mb-1.5 text-[14px] font-semibold">
            Nothing connected yet
          </h1>
          <p className="mb-4 text-[12px] text-t2">
            The workflow map shows how your automations link across platforms.
            Connect Make or HighLevel to populate it.
          </p>
          <Link
            href="/settings/connections"
            className="text-[12px] font-semibold text-t1 underline-offset-4 hover:underline"
          >
            Open Settings
          </Link>
        </div>
      </div>
    );
  }

  if (!linkMap) {
    return (
      <ErrorCard
        title="Failed to load workflow map"
        message="The cross-platform link map couldn’t be fetched."
        onRetry={refresh}
      />
    );
  }

  const showing = linkedOnly
    ? linkMap.workflows.filter((w) => linkInfo.has(cardId(w))).length
    : linkMap.stats.workflows;

  return (
    <div
      className="grid h-full overflow-hidden bg-bg text-t1"
      style={{ gridTemplateRows: "54px 1fr" }}
    >
      {/* header */}
      <header className="flex items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t2 hover:text-t1" />
        <div className="h-[18px] w-px bg-line" aria-hidden="true" />
        <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em]">
          Workflow map
        </h1>
        <Segmented
          label="View mode"
          value={mode}
          options={[
            { value: "map", label: "Map" },
            { value: "detail", label: "Detail" },
            { value: "list", label: "List" },
          ]}
          onChange={setMode}
        />
        {mode === "map" && (linkMap.assetLinks?.length ?? 0) > 0 && (
          <Segmented
            label="Shared assets"
            value={showAssets ? "on" : "off"}
            options={[
              { value: "off", label: "Calls" },
              { value: "on", label: `+ Assets (${linkMap.assetLinks!.length})` },
            ]}
            onChange={(v) => setShowAssets(v === "on")}
          />
        )}
        <Segmented
          label="Workflow filter"
          value={linkedOnly ? "linked" : "all"}
          options={[
            { value: "linked", label: "Linked only" },
            { value: "all", label: `All (${linkMap.stats.workflows})` },
          ]}
          onChange={(v) => setLinkedChoice(v === "linked")}
        />
        {allTags.length > 0 && mode !== "detail" && (
          <TagFilter tags={allTags} selected={tagFilter} onChange={setTagFilter} />
        )}
        {mode !== "detail" && (linkMap.workflows.some((w) => (w.changedSince?.count ?? 0) > 0)) && (
          <Segmented
            label="Changed filter"
            value={changedOnly ? "changed" : "any"}
            options={[
              { value: "any", label: "Any" },
              { value: "changed", label: "Changed since you looked" },
            ]}
            onChange={(v) => setChangedOnly(v === "changed")}
          />
        )}
        <div className="flex-1" />
        {mode !== "detail" && (
          <SaveViewButton kind="unified" filters={{ tags: tagFilter, linkedOnly, showAssets, changedOnly, mode }} />
        )}
        <div className="hidden items-center gap-3.5 md:flex">
          <StatChip label="Showing" value={String(showing)} />
          <div className="h-[22px] w-px bg-line" aria-hidden="true" />
          <StatChip label="Cross-links" value={String(linkMap.stats.links)} />
          <div className="h-[22px] w-px bg-line" aria-hidden="true" />
          <StatChip label="Broken" value={String(linkMap.stats.deadLinks)} />
          {(linkMap.stats.issueErrors ?? 0) > 0 && (
            <>
              <div className="h-[22px] w-px bg-line" aria-hidden="true" />
              <StatChip label="Errors" value={String(linkMap.stats.issueErrors)} />
            </>
          )}
          {mode === "detail" && graphCurrent?.data && (
            <>
              <div className="h-[22px] w-px bg-line" aria-hidden="true" />
              <StatChip label="Workflows" value={String(graphCurrent.data.stats.groups)} />
            </>
          )}
        </div>
      </header>

      {mode === "detail" ? (
        <div className="relative overflow-hidden">
          {graphCurrent?.data ? (
            graphCurrent.data.groups.length === 0 || (focus.length === 0 && graphCurrent.data.groups.length > DETAIL_AUTO_MAX) ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className="card-sharp max-w-md rounded-card border border-line bg-panel p-6 text-center">
                  <h2 className="mb-1.5 text-[14px] font-semibold">
                    {graphCurrent.data.groups.length === 0 ? "No linked set to show" : "Pick a linked set"}
                  </h2>
                  <p className="text-[12px] text-t2">
                    {graphCurrent.data.groups.length === 0
                      ? "The node-level view composes workflows that call each other. Open a workflow with cross-platform links and use “View linked set”, or connect more platforms."
                      : `${graphCurrent.data.groups.length} linkable workflows is too many to read at node level. Open one of them and use “View linked set” to see just its neighbourhood.`}
                  </p>
                  {graphCurrent.data.groups.length > 0 && (
                    <ul className="mt-3 flex max-h-[40vh] flex-wrap justify-center gap-1.5 overflow-auto">
                      {graphCurrent.data.groups.map((g) => (
                        <li key={g.id}>
                          <Link
                            href={workflowHref({ source: g.source, refId: g.refId })}
                            className="flex items-center gap-1.5 rounded-full border border-line bg-pill px-2.5 py-1 text-[10px] font-semibold text-t2 hover:text-t1"
                          >
                            <span aria-hidden="true" className="size-[7px] rounded-[2px]" style={{ background: providerColor(g.source) }} />
                            <span className="max-w-[200px] truncate">{g.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <ScenarioCanvas
                key={`detail:${focusKey}`}
                modules={graphCurrent.data.nodes}
                connections={graphCurrent.data.connections}
                groups={graphCurrent.data.groups}
                onNodeClick={handleDetailClick}
                defaultTilt={false}
              />
            )
          ) : graphCurrent?.error ? (
            <ErrorCard
              title="Failed to compose the linked set"
              message={graphCurrent.error}
              onRetry={() => setGraph(null)}
            />
          ) : (
            <LoadingState message="Composing linked workflows…" />
          )}
          <div className="absolute bottom-3 left-4 z-[2]">
            <Legend />
          </div>
          {graphCurrent?.data && graphCurrent.data.groups.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
              className="absolute left-4 top-3 z-[2] flex max-w-[70%] flex-wrap items-center gap-1.5"
            >
              <span className="pointer-events-none rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]">
                {focus.length > 0 ? "Linked set" : "Auto-selected linkable set"} · click a step to open it
              </span>
              {graphCurrent.data.groups.map((g) => (
                <Link
                  key={g.id}
                  href={workflowHref({ source: g.source, refId: g.refId })}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px] hover:text-t1"
                >
                  <span aria-hidden="true" className="size-[7px] rounded-[2px]" style={{ background: providerColor(g.source) }} />
                  <span className="max-w-[160px] truncate">{g.name}</span>
                </Link>
              ))}
            </motion.div>
          )}
        </div>
      ) : mode === "map" ? (
        <div className="relative overflow-hidden">
          <ScenarioCanvas
            key={linkedOnly ? "linked" : "all"}
            modules={mapData!.modules}
            connections={mapData!.connections}
            onNodeClick={handleMapClick}
            defaultTilt={false}
          />
          <div className="absolute bottom-3 left-4 z-[2]">
            <Legend />
          </div>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
            className="pointer-events-none absolute left-4 top-3 z-[2] flex flex-wrap items-center gap-1.5"
          >
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]">
              <span
                aria-hidden="true"
                className="inline-block h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: "var(--warn)" }}
              />
              link · click a workflow to open it
            </span>
          </motion.div>
        </div>
      ) : (
        <div className="overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {/* search */}
            <div className="flex items-center gap-2 rounded-control border border-line-strong bg-panel px-3 py-2">
              <Search aria-hidden="true" className="size-3.5 text-t3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workflows…"
                aria-label="Search workflows"
                className="w-full bg-transparent text-[12.5px] placeholder:text-t3"
              />
            </div>

            {listSections.map(({ connector, rows }) => (
              <div key={connector.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-[8px] rounded-[2px]"
                    style={{ background: providerColor(connector.id) }}
                  />
                  <h2 className="text-[11px] font-semibold text-t3">
                    {connector.label} {connector.nouns.workflowPlural}
                  </h2>
                  <span className="font-mono text-[10px] text-t3">
                    {rows.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-card border border-line">
                  {rows.length === 0 && (
                    <div className="px-4 py-3 text-[12px] italic text-t3">
                      Nothing matches
                    </div>
                  )}
                  {rows.map((w) => {
                    const li = linkInfo.get(cardId(w));
                    return (
                      <button
                        key={cardId(w)}
                        onClick={() =>
                          router.push(
                            workflowHref({ source: w.source, refId: w.refId })
                          )
                        }
                        className="flex w-full cursor-pointer items-center gap-3 border-b border-line2 bg-panel px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-hover"
                      >
                        <span
                          aria-hidden="true"
                          className="size-[7px] flex-none rounded-full"
                          style={{
                            background: providerColor(w.source),
                            boxShadow: `0 0 5px color-mix(in srgb, ${providerColor(w.source)} 60%, transparent)`,
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                          {w.name}
                        </span>
                        {w.stepCount != null && (
                          <span className="font-mono text-[10px] text-t3">
                            {w.stepCount} steps
                          </span>
                        )}
                        {w.tags?.slice(0, 2).map((t) => (
                          <TagChip key={t.id} tag={t} size="xs" />
                        ))}
                        {w.lastRun && (w.lastRun.status === "error" || w.lastRun.status === "incomplete") && (
                          <LastRunChip status={w.lastRun.status} at={w.lastRun.at} />
                        )}
                        <IssueCountChips counts={w.issueCounts} />
                        {w.talksToGhl && (
                          <span className="rounded-full border border-line bg-pill px-2 py-[2px] text-[9.5px] font-semibold text-t3">
                            {badgeTooltip("talksToGhl")}
                          </span>
                        )}
                        {li && (
                          <span
                            className={`rounded-full border px-2 py-[2px] text-[9.5px] font-semibold ${
                              li.dead ? "text-err-text" : "text-warn-text"
                            }`}
                            style={{
                              borderColor: `color-mix(in srgb, var(${li.dead ? "--err" : "--warn"}) 40%, transparent)`,
                              background: `color-mix(in srgb, var(${li.dead ? "--err" : "--warn"}) 10%, transparent)`,
                            }}
                          >
                            {li.out > 0 && `${li.out} out`}
                            {li.out > 0 && li.in > 0 && " · "}
                            {li.in > 0 && `${li.in} in`}
                            {li.dead && " · broken"}
                          </span>
                        )}
                        <span aria-hidden="true" className="text-[11px] text-t3">
                          →
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
