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
import { StatusPill } from "@/components/shared/StatusPill";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorCard } from "@/components/shared/ErrorCard";
import { FindUsesDialog } from "@/components/shared/FindUsesDialog";
import { IssueCountChips } from "@/components/shared/IssuesSection";
import type { Tag, ExecutionsResponse, Issue } from "@/app/lib/api";
import { RunsPanel } from "@/components/shared/RunsPanel";
import { ChangesPanel } from "@/components/shared/ChangesPanel";
import { CommentsDrawer } from "@/components/shared/CommentsDrawer";
import { NotesPanel, useWorkflowMeta } from "@/components/shared/OwnerNotes";
import { InspectorRail, RAIL_ICONS, RailTool } from "@/components/canvas/InspectorRail";
import { InfoPanel } from "@/components/shared/InfoPanel";
import { fetchComments } from "@/app/lib/api";
import { fetchWorkflowChanges, markWorkflowSeen, WorkflowChanges } from "@/app/lib/api";

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
  const [openPanel, setOpenPanel] = useState<RailTool | null>(null);
  const togglePanel = useCallback((t: RailTool) => setOpenPanel((cur) => (cur === t ? null : t)), []);
  const runsOpen = openPanel === "runs";
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
  const changesOpen = openPanel === "changes";
  const [changes, setChanges] = useState<WorkflowChanges | null>(null);
  const commentsOpen = openPanel === "comments";
  const notesOpen = openPanel === "notes";
  const { meta: wfMeta, setMeta: setWfMeta } = useWorkflowMeta(provider, id);

  // Recent workflows for the sidebar (last 8, most recent first).
  useEffect(() => {
    if (!data) return;
    try {
      const key = "rippit.recent";
      const prev: { provider: string; id: string; name: string; at: number }[] = JSON.parse(localStorage.getItem(key) || "[]");
      const next = [{ provider, id, name: data.summary.name, at: Date.now() }, ...prev.filter((r) => !(r.provider === provider && r.id === id))].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("rippit:recent"));
    } catch {
      /* ignore */
    }
  }, [data, provider, id]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [wfOpenComments, setWfOpenComments] = useState<number>(0);
  const [commentGen, setCommentGen] = useState(0);

  // Open comment threads per node (prefix query) + on the workflow itself.
  useEffect(() => {
    let live = true;
    Promise.all([
      fetchComments({ prefix: `node:${provider}:${id}:` }),
      fetchComments({ target: `wf:${provider}:${id}` }),
    ])
      .then(([nodes, wf]) => {
        if (!live) return;
        const byNode: Record<string, number> = {};
        for (const [key, c] of Object.entries(nodes.counts)) {
          const nodeId = key.slice(`node:${provider}:${id}:`.length);
          if (c.open > 0) byNode[nodeId] = c.open;
        }
        setCommentCounts(byNode);
        setWfOpenComments(wf.counts[`wf:${provider}:${id}`]?.open ?? 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [provider, id, commentGen, selectedId]);

  // "Changed since you last looked": fetch changes with the previous
  // last-seen marker, mark the affected nodes, then record this visit.
  useEffect(() => {
    let live = true;
    fetchWorkflowChanges(provider, id)
      .then((d) => {
        if (!live) return;
        const lastSeen = d.lastSeenAt;
        setChanges({ ...d, changes: d.changes.map((c) => ({ ...c, unseen: !lastSeen || c.detectedAt > lastSeen })) });
        markWorkflowSeen(provider, id).catch(() => {});
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [provider, id, reloadKey]);

  const changedNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of changes?.changes ?? []) {
      if (!c.unseen) continue;
      if (c.nodeId) s.add(String(c.nodeId));
      const ids = c.after?.nodeIds;
      if (Array.isArray(ids)) for (const n of ids) s.add(String(n));
    }
    return s;
  }, [changes]);

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
    const hasComments = Object.keys(commentCounts).length > 0;
    if (runtimeIssueByNode.size === 0 && changedNodeIds.size === 0 && !hasComments) return base;
    return {
      ...base,
      modules: base.modules.map((m) => {
        const extra = runtimeIssueByNode.get(String(m.id));
        const changed = changedNodeIds.has(String(m.id));
        const cc = commentCounts[String(m.id)];
        if (!extra && !changed && !cc) return m;
        const existing = (m.issues ?? []).filter((i) => i.code !== "last-run-failed");
        return {
          ...m,
          ...(changed ? { changed: true } : {}),
          ...(cc ? { commentCount: cc } : {}),
          ...(extra ? { issues: [extra, ...existing] } : {}),
        };
      }),
    };
  }, [data, linkMap, self, runtimeIssueByNode, changedNodeIds, commentCounts]);

  const handleNodeClick = useCallback(
    (nodeId: NodeId) => {
      const portal = parsePortalId(nodeId);
      if (portal) {
        router.push(workflowHref(portal));
        return;
      }
      setSelectedId(nodeId);
      setOpenPanel(null);
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em]">
            {summary.name}
          </h1>
          <StatusPill pill={meta.statusPill} />
          {issueCounts.error > 0 && <IssueCountChips counts={{ error: issueCounts.error, warn: 0, info: 0 }} />}
          {wfMeta?.ownerName && (
            <button
              type="button"
              onClick={() => togglePanel("info")}
              className="hidden truncate text-[10.5px] text-t3 hover:text-t1 md:inline"
              title="Owner — open Info"
            >
              owner · {wfMeta.ownerName}
            </button>
          )}
        </div>
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

        {summary.stepsUnavailable && (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center p-4">
            <div className="pointer-events-auto card-sharp max-w-md rounded-card border border-line bg-panel p-5 text-center">
              <h2 className="mb-1.5 text-[13px] font-semibold">Steps unavailable via OAuth</h2>
              <p className="text-[12px] text-t2">
                HighLevel&apos;s official API returns workflow names and status only. Connect
                this location with the Rippit Chrome extension to see its steps, triggers and
                links here.
              </p>
              <Link href="/settings/connections" className="mt-3 inline-block text-[12px] font-semibold underline-offset-4 hover:underline">
                Open Settings → Connections
              </Link>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 left-4 z-[2]">
          <Legend />
        </div>

        <InspectorRail
          active={openPanel}
          onToggle={togglePanel}
          items={[
            { id: "info", label: "Info — owner, tags, stats", icon: RAIL_ICONS.info,
              badge: wfTags && wfTags.length > 0 ? wfTags.length : null, tone: "muted" },
            { id: "changes", label: "Changes", icon: RAIL_ICONS.changes,
              badge: changes && changes.unseen > 0 ? changes.unseen : null, tone: "warn" },
            { id: "comments", label: "Comments", icon: RAIL_ICONS.comments,
              badge: wfOpenComments > 0 ? wfOpenComments : null, tone: "muted" },
            { id: "runs", label: "Runs", icon: RAIL_ICONS.runs, hidden: provider !== "make",
              badge: (lastRun?.status ?? linkMapLastRun?.status) === "error" || (lastRun?.status ?? linkMapLastRun?.status) === "incomplete" ? "!" : null, tone: "err" },
            { id: "notes", label: "Notes", icon: RAIL_ICONS.notes, badge: wfMeta?.notes ? "•" : null, tone: "ok" },
          ]}
        />

        {openPanel === "info" && (
          <InfoPanel
            provider={provider}
            externalId={id}
            name={summary.name}
            stats={connector.headerStats(data)}
            issueCounts={issueCounts}
            nativeUrl={nativeUrl}
            linkedSetHref={linkedSetHref}
            tags={wfTags ?? []}
            onTagsChange={setWfTags}
            meta={wfMeta}
            onMetaChange={(m) => (typeof m === "function" ? setWfMeta(m) : setWfMeta(m))}
            lastRun={lastRun}
            linkMapLastRun={linkMapLastRun}
            onClose={() => setOpenPanel(null)}
          />
        )}

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
              commentTarget={selectedId != null ? `node:${provider}:${id}:${String(selectedId)}` : undefined}
            />
          )}
        </AnimatePresence>

        <FindUsesDialog target={findUses} onClose={() => setFindUses(null)} />

        {notesOpen && (
          <NotesPanel provider={provider} externalId={id} meta={wfMeta} onChange={setWfMeta} onClose={() => setOpenPanel(null)} />
        )}
        {commentsOpen && (
          <CommentsDrawer
            provider={provider}
            externalId={id}
            onClose={() => {
              setOpenPanel(null);
              setCommentGen((g) => g + 1);
            }}
            onCountChange={(open) => setWfOpenComments(open)}
          />
        )}
        {changesOpen && (
          <ChangesPanel
            provider={provider}
            externalId={id}
            onClose={() => setOpenPanel(null)}
            onSelectNode={(n) => {
              const match = summary.modules.find((m) => String(m.id) === String(n));
              if (match) handleNodeClick(match.id);
            }}
          />
        )}
        {runsOpen && (
          <RunsPanel
            provider={provider}
            externalId={id}
            onClose={() => setOpenPanel(null)}
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
