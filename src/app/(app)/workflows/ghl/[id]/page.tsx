"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { appColor, appName } from "@/lib/apps";
import { loadCredentials } from "@/app/lib/credentials";
import {
  fetchGhlWorkflowSummary,
  fetchGhlStepDetail,
  fetchLinks,
  GhlWorkflowSummary,
  LinkMap,
  NodeId,
} from "@/app/lib/api";
import {
  parsePortalId,
  withPortals,
  workflowHref,
  WorkflowRef,
} from "@/lib/portals";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";
import StepDetailPanel, { GhlStep } from "./StepDetailPanel";
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

export default function GhlWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [summary, setSummary] = useState<GhlWorkflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const [selectedStep, setSelectedStep] = useState<GhlStep | null>(null);
  const [stepLoading, setStepLoading] = useState(false);
  const [linkMap, setLinkMap] = useState<LinkMap | null>(null);

  const self: WorkflowRef = useMemo(
    () => ({ source: "ghl", refId: id }),
    [id]
  );

  useEffect(() => {
    fetchGhlWorkflowSummary(id)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Cross-workflow links (portals) need Make credentials; degrade silently
    const creds = loadCredentials();
    if (creds) {
      fetchLinks(creds.organizationId)
        .then(setLinkMap)
        .catch(() => setLinkMap(null));
    }
  }, [id]);

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
      setSelectedId(nodeId);
      setStepLoading(true);
      setSelectedStep(null);
      fetchGhlStepDetail(id, String(nodeId))
        .then(setSelectedStep)
        .catch(() => setSelectedStep(null))
        .finally(() => setStepLoading(false));
    },
    [id, router]
  );

  const closePanel = useCallback(() => {
    setSelectedId(null);
    setSelectedStep(null);
    setStepLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-7 animate-spin rounded-full border-2 border-t1 border-t-transparent" />
          <p className="mt-3 text-[12px] text-t3">Loading workflow…</p>
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
            Failed to load workflow
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

  if (!summary) return null;

  const st =
    summary.status === "published"
      ? { color: "#22c55e", bg: "rgba(34,197,94,.1)", border: "rgba(34,197,94,.3)", label: "Published" }
      : { color: "#a1a1aa", bg: "rgba(128,128,140,.1)", border: "rgba(128,128,140,.3)", label: summary.status || "Draft" };

  const triggerCount = summary.modules.filter((m) => m.kind === "trigger").length;

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
            {summary.name}
          </span>
          <span
            className="flex-none rounded-full border px-[9px] py-[3px] text-[10px] font-semibold capitalize"
            style={{ color: st.color, background: st.bg, borderColor: st.border }}
          >
            {st.label}
          </span>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 md:flex">
          <StatChip
            label="Steps"
            value={String(summary.totalModules - triggerCount)}
          />
          <div className="h-[22px] w-px bg-line" />
          <StatChip label="Triggers" value={String(triggerCount)} />
          <div className="h-[22px] w-px bg-line" />
          <StatChip
            label="Connections"
            value={String(summary.connections.length)}
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

        {/* floating chips: source badge + connected workflows */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
          className="absolute left-4 top-3 z-[2] flex max-w-[70%] flex-col gap-1.5"
        >
          <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-t2 backdrop-blur-[8px]">
              <span
                className="size-[7px] rounded-[2px]"
                style={{ background: appColor("ghl") }}
              />
              {appName("ghl")}
            </span>
          </div>
          <ConnectedChips linkMap={linkMap} self={self} />
        </motion.div>

        <AnimatePresence>
          {(selectedStep || stepLoading) && (
            <StepDetailPanel
              key="panel"
              step={selectedStep}
              loading={stepLoading}
              onClose={closePanel}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
