"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { appColor, appName } from "@/lib/apps";
import { fetchLinks, LinkMap, NodeId } from "@/app/lib/api";
import { getConnector, isProviderId, providerColor } from "@/lib/connectors";
import type { WorkflowData } from "@/lib/connectors/types";
import { parsePortalId, withPortals, workflowHref, WorkflowRef } from "@/lib/portals";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import { ConnectedChips } from "@/components/canvas/ConnectedChips";
import { usePaletteScope } from "@/components/palette/palette-context";
import { StatChip } from "@/components/shared/StatChip";
import { StatusPill } from "@/components/shared/StatusPill";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorCard } from "@/components/shared/ErrorCard";

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
      .then(setLinkMap)
      .catch(() => setLinkMap(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, id, reloadKey]);

  useEffect(() => {
    if (data?.summary.name) {
      document.title = `${data.summary.name} — Rippit`;
    }
  }, [data]);

  const canvasData = useMemo(
    () => (data ? withPortals(data.summary, linkMap, self) : null),
    [data, linkMap, self]
  );

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
                label: m.label || m.module,
              })),
              onSelect: handleNodeClick,
            }
          : null,
      [data, handleNodeClick]
    )
  );

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
        </motion.div>

        <AnimatePresence>
          {(nodeDetail || nodeLoading || nodeError) && (
            <DetailPanel
              key="panel"
              data={nodeError ? null : nodeDetail}
              loading={nodeLoading}
              error={nodeError}
              onClose={closePanel}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
