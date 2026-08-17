"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { loadCredentials } from "@/app/lib/credentials";
import { appColor, appName } from "@/lib/apps";
import {
  fetchScenarioDetail,
  fetchScenarioSummary,
  fetchModuleDetail,
  fetchLinks,
  LinkMap,
  ScenarioDetail,
  ScenarioSummary,
  ModuleDetail,
  NodeId,
} from "@/app/lib/api";
import {
  parsePortalId,
  withPortals,
  workflowHref,
  WorkflowRef,
} from "@/lib/portals";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import ModuleDetailPanel from "./ModuleDetailPanel";
import { ConnectedChips } from "@/components/canvas/ConnectedChips";

const EASE = [0.22, 1, 0.36, 1] as const;

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-[10px] leading-none text-t3">{label}</span>
      <span className="tabular text-[13px] font-semibold leading-tight">
        {value}
      </span>
    </div>
  );
}

export default function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [summary, setSummary] = useState<ScenarioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleDetail | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [linkMap, setLinkMap] = useState<LinkMap | null>(null);

  const self: WorkflowRef = useMemo(
    () => ({ source: "make", refId: id }),
    [id]
  );

  useEffect(() => {
    const creds = loadCredentials();
    if (!creds) {
      router.push("/");
      return;
    }

    const scenarioId = parseInt(id);
    Promise.all([
      fetchScenarioDetail(creds, scenarioId),
      fetchScenarioSummary(creds, scenarioId),
    ])
      .then(([d, s]) => {
        setDetail(d);
        setSummary(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Cross-workflow links (portals) — degrade silently if unavailable
    fetchLinks(creds.organizationId)
      .then(setLinkMap)
      .catch(() => setLinkMap(null));
  }, [id, router]);

  const canvasData = useMemo(
    () => (summary ? withPortals(summary, linkMap, self) : null),
    [summary, linkMap, self]
  );

  const handleNodeClick = useCallback(
    (nodeId: NodeId) => {
      const portal = parsePortalId(nodeId);
      if (portal) {
        router.push(workflowHref(portal));
        return;
      }
      const scenarioId = parseInt(id);
      const moduleId = Number(nodeId); // Make module ids are always numeric
      setSelectedId(moduleId);
      setModuleLoading(true);
      setSelectedModule(null);
      fetchModuleDetail(scenarioId, moduleId)
        .then(setSelectedModule)
        .catch(() => setSelectedModule(null))
        .finally(() => setModuleLoading(false));
    },
    [id, router]
  );

  const closePanel = useCallback(() => {
    setSelectedId(null);
    setSelectedModule(null);
    setModuleLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-7 animate-spin rounded-full border-2 border-t1 border-t-transparent" />
          <p className="mt-3 text-[12px] text-t3">Loading scenario…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-card border border-line bg-panel p-6 text-center backdrop-blur-[14px]">
          <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full border border-[rgba(239,68,68,.32)] bg-[rgba(239,68,68,.1)] text-[15px] font-bold text-err">
            !
          </div>
          <h2 className="mb-1.5 text-[14px] font-semibold">
            Failed to load scenario
          </h2>
          <p className="mb-4 text-[12px] text-t2">{error}</p>
          <Link
            href="/dashboard"
            className="text-[12px] font-semibold text-t1 underline-offset-4 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!detail || !summary) return null;

  const st = detail.isActive
    ? detail.isPaused
      ? { color: "#f59e0b", bg: "rgba(245,158,11,.1)", border: "rgba(245,158,11,.32)", label: "Paused" }
      : { color: "#22c55e", bg: "rgba(34,197,94,.1)", border: "rgba(34,197,94,.3)", label: "Active" }
    : { color: "#a1a1aa", bg: "rgba(128,128,140,.1)", border: "rgba(128,128,140,.3)", label: "Inactive" };

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
          className="flex size-[30px] items-center justify-center rounded-control border border-line text-t3 transition-colors hover:border-t1 hover:text-t1"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
        <div className="h-[18px] w-px bg-line" />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
            {detail.name}
          </span>
          <span
            className="flex-none rounded-full border px-[9px] py-[3px] text-[10px] font-semibold"
            style={{ color: st.color, background: st.bg, borderColor: st.border }}
          >
            {st.label}
          </span>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 md:flex">
          <StatChip label="Modules" value={String(summary.totalModules)} />
          <div className="h-[22px] w-px bg-line" />
          <StatChip label="Apps" value={String(summary.appsUsed.length)} />
          <div className="h-[22px] w-px bg-line" />
          <StatChip
            label="Connections"
            value={String(summary.connections.length)}
          />
          <div className="h-[22px] w-px bg-line" />
          <StatChip
            label="Last edit"
            value={
              detail.lastEdit
                ? new Date(detail.lastEdit).toLocaleDateString()
                : "—"
            }
          />
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

        {/* floating chips: scenario id + apps used + connected workflows */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
          className="absolute left-4 top-3 z-[2] flex max-w-[70%] flex-col gap-1.5"
        >
          <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-line bg-glass px-2.5 py-1 font-mono text-[10px] text-t3 backdrop-blur-[8px]">
              #{detail.id}
            </span>
            {summary.appsUsed.map((app) => (
              <span
                key={app}
                className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]"
              >
                <span
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
          {(selectedModule || moduleLoading) && (
            <ModuleDetailPanel
              key="panel"
              module={selectedModule}
              loading={moduleLoading}
              onClose={closePanel}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
