"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { loadCredentials } from "@/app/lib/credentials";
import {
  fetchUnifiedGraph,
  fetchModuleDetail,
  fetchGhlStepDetail,
  UnifiedGraph,
  ModuleDetail,
  NodeId,
} from "@/app/lib/api";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import ModuleDetailPanel from "../scenarios/[id]/ModuleDetailPanel";
import StepDetailPanel, {
  GhlStep,
} from "../workflows/ghl/[id]/StepDetailPanel";

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

/* Unified node ids: "make:{scenarioId}:{moduleId}" | "ghl:{wfId}:{stepId}" */
function parseNodeId(id: NodeId) {
  const parts = String(id).split(":");
  if (parts.length < 3) return null;
  return {
    source: parts[0] as "make" | "ghl",
    refId: parts[1],
    localId: parts.slice(2).join(":"),
  };
}

export default function UnifiedPage() {
  const router = useRouter();
  const [graph, setGraph] = useState<UnifiedGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const [makeModule, setMakeModule] = useState<ModuleDetail | null>(null);
  const [ghlStep, setGhlStep] = useState<GhlStep | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailKind, setDetailKind] = useState<"make" | "ghl" | null>(null);

  useEffect(() => {
    const creds = loadCredentials();
    if (!creds) {
      router.push("/");
      return;
    }
    fetchUnifiedGraph(creds.organizationId)
      .then(setGraph)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleNodeClick = useCallback((nodeId: NodeId) => {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return;
    setSelectedId(nodeId);
    setDetailKind(parsed.source);
    setDetailLoading(true);
    setMakeModule(null);
    setGhlStep(null);
    const done = () => setDetailLoading(false);
    if (parsed.source === "make") {
      fetchModuleDetail(Number(parsed.refId), Number(parsed.localId))
        .then(setMakeModule)
        .catch(() => setMakeModule(null))
        .finally(done);
    } else {
      fetchGhlStepDetail(parsed.refId, parsed.localId)
        .then(setGhlStep)
        .catch(() => setGhlStep(null))
        .finally(done);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelectedId(null);
    setMakeModule(null);
    setGhlStep(null);
    setDetailLoading(false);
    setDetailKind(null);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-7 animate-spin rounded-full border-2 border-t1 border-t-transparent" />
          <p className="mt-3 text-[12px] text-t3">
            Composing unified graph…
          </p>
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
            Failed to compose graph
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

  if (!graph) return null;

  if (graph.groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-card border border-line bg-panel p-6 text-center backdrop-blur-[14px]">
          <h2 className="mb-1.5 text-[14px] font-semibold">Nothing to show yet</h2>
          <p className="text-[12px] text-t2">
            Connect a GHL location (via the Rippit extension) or add a Make
            scenario with a webhook or HighLevel modules — then this canvas
            shows both systems and the links between them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid h-full overflow-hidden bg-bg text-t1"
      style={{ gridTemplateRows: "54px 1fr" }}
    >
      {/* header */}
      <header className="flex items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t2 hover:text-t1" />
        <div className="h-[18px] w-px bg-line" />
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
          Unified view
        </span>
        <span className="rounded-full border border-line bg-glass px-2.5 py-[3px] text-[10px] font-semibold text-t2">
          Make + GHL
        </span>
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 md:flex">
          <StatChip label="Workflows" value={String(graph.stats.groups)} />
          <div className="h-[22px] w-px bg-line" />
          <StatChip label="Cross-links" value={String(graph.stats.crossLinks)} />
          <div className="h-[22px] w-px bg-line" />
          <StatChip
            label="Broken links"
            value={String(graph.stats.deadLinks)}
          />
        </div>
      </header>

      {/* canvas area */}
      <div className="relative overflow-hidden">
        <ScenarioCanvas
          modules={graph.nodes}
          connections={graph.connections}
          groups={graph.groups}
          selectedId={selectedId}
          onNodeClick={handleNodeClick}
        />

        {/* legend */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
          className="pointer-events-none absolute left-4 top-3 z-[2] flex flex-wrap items-center gap-1.5"
        >
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]">
            <span
              className="inline-block h-0 w-5 border-t-2 border-dashed"
              style={{ borderColor: "#f59e0b" }}
            />
            cross-system link
          </span>
          {graph.stats.deadLinks > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]">
              <span
                className="inline-block h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: "#ef4444" }}
              />
              broken link
            </span>
          )}
        </motion.div>

        <AnimatePresence>
          {detailKind === "make" && (makeModule || detailLoading) && (
            <ModuleDetailPanel
              key="make-panel"
              module={makeModule}
              loading={detailLoading}
              onClose={closePanel}
            />
          )}
          {detailKind === "ghl" && (ghlStep || detailLoading) && (
            <StepDetailPanel
              key="ghl-panel"
              step={ghlStep}
              loading={detailLoading}
              onClose={closePanel}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
