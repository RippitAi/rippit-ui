"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter, useSearchParams, notFound } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { appColor, appName } from "@/lib/apps";
import { fetchLinks, LinkMap, NodeId } from "@/app/lib/api";
import { getConnector, isProviderId, providerColor } from "@/lib/connectors";
import type { WorkflowData } from "@/lib/connectors/types";
import { parsePortalId, withPortals, workflowHref, WorkflowRef } from "@/lib/portals";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import { ConnectedChips } from "@/components/canvas/ConnectedChips";
import { Legend } from "@/components/canvas/Legend";
import { usePaletteScope } from "@/components/palette/palette-context";
import { StatChip } from "@/components/shared/StatChip";
import { StatusPill } from "@/components/shared/StatusPill";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorCard } from "@/components/shared/ErrorCard";
import { FindUsesDialog } from "@/components/shared/FindUsesDialog";
import { IssueCountChips } from "@/components/shared/IssuesSection";
import { TagPicker } from "@/components/tags/TagPicker";
import type { Tag, ExecutionsResponse, Issue } from "@/app/lib/api";
import { RunsPanel, LastRunChip } from "@/components/shared/RunsPanel";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ provider: string; id: string }>;
}) {
  const { provider, id } = use(params);
  if (!isProviderId(provider)) notFound();
  const connector = getConnector(provider);

  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNode = searchParams.get("node");
  const [findUses, setFindUses] = useState<{ kind: string; value: string; label?: string | null } | null>(null);
  const [wfTags, setWfTags] = useState<Tag[] | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const [runs, setRuns] = useState<ExecutionsResponse | null>(null);
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const [nodeDetail, setNodeDetail] = useState<unknown | null>(null);
  const [nodeError, setNodeError] = useState(false);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [linkMap, setLinkMap] = useState<LinkMap | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const self: WorkflowRef = useMemo(
    () => ({ source: provider, refId: id }),
    [provider, id]
  );

  useEffect(() => {
    setLoading(true);
    setError("");
    connector
      .loadWorkflow(id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Cross-workflow links (portals) — degrade gracefully if unavailable
    fetchLinks()
      .then((m) => {
        setLinkMap(m);
        const me = m.workflows.find((w) => w.source === provider && w.refId === id);
        setWfTags(me?.tags ?? []);
      })
      .catch(() => setLinkMap(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, id, reloadKey]);

  useEffect(() => {
    if (data?.summary.name) {
      document.title = `${data.summary.name} — Rippit`;
    }
  }, [data]);

  // The latest failed run marks its failing module on the canvas as a
  // runtime issue (same dot / Issues section as structural ones).
  const runtimeIssueByNode = useMemo(() => {
    const latest = runs?.executions?.[0];
    if (!latest || latest.status !== "error" || !latest.causeModuleId) return new Map<string, Issue>();
    return new Map<string, Issue>([[String(latest.causeModuleId), {
      code: "last-run-failed",
      severity: "error",
      provider,
      workflowExternalId: id,
      nodeId: latest.causeModuleId,
      message: `Last run failed here${latest.errorMessage ? `: ${latest.errorMessage}` : ""}`,
      data: { executionId: latest.executionId, startedAt: latest.startedAt, runtime: true },
    }]]);
  }, [runs, provider, id]);

  const canvasData = useMemo(() => {
    if (!data) return null;
    const base = withPortals(data.summary, linkMap, self);
    if (runtimeIssueByNode.size === 0) return base;
    return {
      ...base,
      modules: base.modules.map((m) => {
        const extra = runtimeIssueByNode.get(String(m.id));
        if (!extra) return m;
        const existing = (m.issues ?? []).filter((i) => i.code !== "last-run-failed");
        return { ...m, issues: [extra, ...existing] };
      }),
    };
  }, [data, linkMap, self, runtimeIssueByNode]);

  const handleNodeClick = useCallback(
    (nodeId: NodeId) => {
      const portal = parsePortalId(nodeId);
      if (portal) {
        router.push(workflowHref(portal));
        return;
      }
      setSelectedId(nodeId);
      setNodeLoading(true);
      setNodeDetail(null);
      setNodeError(false);
      connector
        .fetchNodeDetail(id, nodeId)
        .then(setNodeDetail)
        .catch(() => setNodeError(true))
        .finally(() => setNodeLoading(false));
    },
    [connector, id, router]
  );

  // Palette: "Focus: <step>" entries for the open workflow
  usePaletteScope(
    useMemo(
      () =>
        data
          ? {
              label: data.summary.name,
              nodes: data.summary.modules.map((m) => ({
                id: m.id,
                label: m.label || m.summary || m.module,
              })),
              onSelect: handleNodeClick,
            }
          : null,
      [data, handleNodeClick]
    )
  );

  // Deep link from search / tracing: /w/{provider}/{id}?node=<id> selects
  // that node (and opens its detail) once the workflow has loaded.
  useEffect(() => {
    if (!data || !requestedNode) return;
    const match = data.summary.modules.find((m) => String(m.id) === requestedNode);
    if (match) handleNodeClick(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, requestedNode]);

  const closePanel = useCallback(() => {
    setSelectedId(null);
    setNodeDetail(null);
    setNodeError(false);
    setNodeLoading(false);
  }, []);

  if (loading) {
    return <LoadingState message={`Loading ${connector.nouns.workflow}…`} />;
  }

  if (error) {
    return (
      <ErrorCard
        title={`Failed to load ${connector.nouns.workflow}`}
        message={error}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  if (!data) return null;

  const { summary, meta } = data;
  const DetailPanel = connector.DetailPanel;
  const nativeUrl = summary.nativeUrl ?? connector.nativeUrl?.(id) ?? null;
  const issueCounts = (summary.issues ?? []).reduce(
    (acc, i) => ({ ...acc, [i.severity]: acc[i.severity] + 1 }),
    { error: 0, warn: 0, info: 0 }
  );
  const selectedIssues =
    selectedId != null
      ? (canvasData ?? summary).modules.find((m) => String(m.id) === String(selectedId))?.issues
      : undefined;
  const lastRun =
    runs?.executions?.[0] ??
    null;
  const linkMapLastRun = linkMap?.workflows.find((w) => w.source === provider && w.refId === id)?.lastRun;
  const linkedSetHref = (() => {
    if (!linkMap) return null;
    const keys = new Set<string>([`${self.source}:${self.refId}`]);
    for (const l of linkMap.links) {
      const touches =
        (l.from.source === self.source && l.from.refId === self.refId) ||
        (l.to.source === self.source && l.to.refId === self.refId);
      if (!touches) continue;
      keys.add(`${l.from.source}:${l.from.refId}`);
      keys.add(`${l.to.source}:${l.to.refId}`);
    }
    return keys.size > 1 ? `/unified?view=detail&focus=${encodeURIComponent([...keys].join(","))}` : null;
  })();

  return (
    <div
      className="grid h-full overflow-hidden bg-bg text-t1"
      style={{ gridTemplateRows: "54px 1fr" }}
    >
      {/* header */}
      <header className="flex items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t2 hover:text-t1" />
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="flex size-[30px] items-center justify-center rounded-control border border-line-strong text-t3 transition-colors hover:border-t1 hover:text-t1"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
        </Link>
        <div className="h-[18px] w-px bg-line" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em]">
            {summary.name}
          </h1>
          <StatusPill pill={meta.statusPill} />
          <IssueCountChips counts={issueCounts} />
          <TagPicker
            provider={provider}
            externalId={id}
            tags={wfTags ?? []}
            onChange={setWfTags}
            compact
          />
          {provider === "make" && (
            <button
              type="button"
              onClick={() => setRunsOpen((o) => !o)}
              aria-pressed={runsOpen}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-[3px] text-[10.5px] font-semibold text-t2 transition-colors hover:border-t1 hover:text-t1"
            >
              Runs
              {(lastRun || linkMapLastRun) && (
                <LastRunChip
                  status={(lastRun?.status ?? linkMapLastRun?.status ?? "unknown")}
                  at={lastRun?.startedAt ?? linkMapLastRun?.at ?? null}
                />
              )}
            </button>
          )}
          {nativeUrl && (
            <a
              href={nativeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line-strong px-2.5 py-[3px] text-[10.5px] font-semibold text-t2 transition-colors hover:border-t1 hover:text-t1"
            >
              Open in {connector.shortLabel}
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </a>
          )}
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 md:flex">
          {connector.headerStats(data).map((s, i) => (
            <span key={s.label} className="flex items-center gap-3.5">
              {i > 0 && (
                <span className="h-[22px] w-px bg-line" aria-hidden="true" />
              )}
              <StatChip label={s.label} value={s.value} />
            </span>
          ))}
        </div>
      </header>

      {/* canvas area */}
      <div className="relative overflow-hidden">
        <ScenarioCanvas
          modules={(canvasData ?? summary).modules}
          connections={(canvasData ?? summary).connections}
          selectedId={selectedId}
          onNodeClick={handleNodeClick}
        />

        {/* floating chips: id + provider + apps used + connected workflows */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
          className="absolute left-4 top-3 z-[2] flex max-w-[70%] flex-col gap-1.5"
        >
          <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
            {meta.idChip && (
              <span className="rounded-full border border-line bg-glass px-2.5 py-1 font-mono text-[10px] text-t3 backdrop-blur-[8px]">
                {meta.idChip}
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]">
              <span
                aria-hidden="true"
                className="size-[7px] rounded-[2px]"
                style={{ background: providerColor(provider) }}
              />
              {connector.shortLabel}
            </span>
            {summary.appsUsed
              .filter((app) => app !== provider)
              .map((app) => (
                <span
                  key={app}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]"
                >
                  <span
                    aria-hidden="true"
                    className="size-[7px] rounded-[2px]"
                    style={{ background: appColor(app) }}
                  />
                  {appName(app)}
                </span>
              ))}
          </div>
          <ConnectedChips linkMap={linkMap} self={self} />
          {linkedSetHref && (
            <Link
              href={linkedSetHref}
              className="pointer-events-auto w-fit rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px] hover:text-t1"
            >
              View linked set (node-level) →
            </Link>
          )}
        </motion.div>

        <div className="absolute bottom-3 left-4 z-[2]">
          <Legend />
        </div>

        <AnimatePresence>
          {(nodeDetail || nodeLoading || nodeError) && (
            <DetailPanel
              key="panel"
              data={nodeError ? null : nodeDetail}
              loading={nodeLoading}
              error={nodeError}
              onClose={closePanel}
              onFindUses={setFindUses}
              issues={selectedIssues}
            />
          )}
        </AnimatePresence>

        <FindUsesDialog target={findUses} onClose={() => setFindUses(null)} />

        {runsOpen && (
          <RunsPanel
            provider={provider}
            externalId={id}
            onClose={() => setRunsOpen(false)}
            onSelectNode={(n) => {
              const match = summary.modules.find((m) => String(m.id) === String(n));
              if (match) handleNodeClick(match.id);
            }}
            onData={setRuns}
          />
        )}
      </div>
    </div>
  );
}
