"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  WorkflowCard,
  Connection,
  ModuleInfo,
  NodeId,
} from "@/app/lib/api";
import { parseWorkflowId, workflowHref } from "@/lib/portals";
import { useConnections } from "@/components/app/ConnectionsProvider";
import { allConnectors, badgeTooltip, providerColor } from "@/lib/connectors";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import { StatChip } from "@/components/shared/StatChip";
import { Segmented } from "@/components/shared/Segmented";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorCard } from "@/components/shared/ErrorCard";

const EASE = [0.22, 1, 0.36, 1] as const;

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
  const [mode, setMode] = useState<"map" | "list">("map");
  // null = no explicit choice yet → default to linked-only unless there are no links
  const [linkedChoice, setLinkedChoice] = useState<boolean | null>(null);
  const linkedOnly = linkedChoice ?? (linkMap ? linkMap.stats.links > 0 : true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Workflow map — Rippit";
  }, []);

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

  /* Map data: one node per workflow, links as orange edges. */
  const mapData = useMemo(() => {
    if (!linkMap) return null;
    let workflows = linkMap.workflows;
    if (linkedOnly) workflows = workflows.filter((w) => linkInfo.has(cardId(w)));
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
    return { modules, connections };
  }, [linkMap, linkedOnly, linkInfo]);

  const handleMapClick = useCallback(
    (nodeId: NodeId) => {
      const ref = parseWorkflowId(nodeId);
      if (ref) router.push(workflowHref(ref));
    },
    [router]
  );

  /* List data: one section per connector, searchable. */
  const listSections = useMemo(() => {
    if (!linkMap) return [];
    const q = query.trim().toLowerCase();
    const match = (w: WorkflowCard) =>
      (!q || w.name.toLowerCase().includes(q)) &&
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
  }, [linkMap, query, linkedOnly, linkInfo]);

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
            Open Connections
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
            { value: "list", label: "List" },
          ]}
          onChange={setMode}
        />
        <Segmented
          label="Workflow filter"
          value={linkedOnly ? "linked" : "all"}
          options={[
            { value: "linked", label: "Linked only" },
            { value: "all", label: `All (${linkMap.stats.workflows})` },
          ]}
          onChange={(v) => setLinkedChoice(v === "linked")}
        />
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 md:flex">
          <StatChip label="Showing" value={String(showing)} />
          <div className="h-[22px] w-px bg-line" aria-hidden="true" />
          <StatChip label="Cross-links" value={String(linkMap.stats.links)} />
          <div className="h-[22px] w-px bg-line" aria-hidden="true" />
          <StatChip label="Broken" value={String(linkMap.stats.deadLinks)} />
        </div>
      </header>

      {mode === "map" ? (
        <div className="relative overflow-hidden">
          <ScenarioCanvas
            key={linkedOnly ? "linked" : "all"}
            modules={mapData!.modules}
            connections={mapData!.connections}
            onNodeClick={handleMapClick}
            defaultTilt={false}
          />
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
