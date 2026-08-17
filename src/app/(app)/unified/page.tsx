"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { loadCredentials } from "@/app/lib/credentials";
import {
  fetchLinks,
  LinkMap,
  WorkflowCard,
  Connection,
  ModuleInfo,
  NodeId,
} from "@/app/lib/api";
import { workflowHref, WorkflowRef } from "@/lib/portals";
import { appColor } from "@/lib/apps";
import ScenarioCanvas from "@/components/canvas/ScenarioCanvas";

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

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-full border border-line text-[10px] font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="cursor-pointer px-2.5 py-[4px] transition-colors"
          style={
            value === o.value
              ? { background: "var(--text)", color: "var(--bg)" }
              : { color: "var(--t3)" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const cardId = (w: { source: string; refId: string }) =>
  `${w.source}:${w.refId}`;

export default function UnifiedPage() {
  const router = useRouter();
  const [linkMap, setLinkMap] = useState<LinkMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [linkedOnly, setLinkedOnly] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const creds = loadCredentials();
    if (!creds) {
      router.push("/");
      return;
    }
    fetchLinks(creds.organizationId)
      .then((m) => {
        setLinkMap(m);
        if (m.stats.links === 0) setLinkedOnly(false);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  /* Per-workflow link involvement (for filtering + list badges). */
  const linkInfo = useMemo(() => {
    const info = new Map<string, { in: number; out: number; dead: boolean }>();
    if (!linkMap) return info;
    const bump = (
      key: string,
      dir: "in" | "out",
      dead: boolean
    ) => {
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
      const s = String(nodeId);
      const sep = s.indexOf(":");
      if (sep < 0) return;
      const ref: WorkflowRef = {
        source: s.slice(0, sep) as "make" | "ghl",
        refId: s.slice(sep + 1),
      };
      router.push(workflowHref(ref));
    },
    [router]
  );

  /* List data: grouped + searchable. */
  const listData = useMemo(() => {
    if (!linkMap) return { ghl: [] as WorkflowCard[], make: [] as WorkflowCard[] };
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
    return {
      ghl: linkMap.workflows.filter((w) => w.source === "ghl" && match(w)).sort(sortByLinks),
      make: linkMap.workflows.filter((w) => w.source === "make" && match(w)).sort(sortByLinks),
    };
  }, [linkMap, query, linkedOnly, linkInfo]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-7 animate-spin rounded-full border-2 border-t1 border-t-transparent" />
          <p className="mt-3 text-[12px] text-t3">Loading workflow map…</p>
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
            Failed to load workflow map
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

  if (!linkMap) return null;

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
        <div className="h-[18px] w-px bg-line" />
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
          Workflow map
        </span>
        <Segmented
          value={mode}
          options={[
            { value: "map", label: "Map" },
            { value: "list", label: "List" },
          ]}
          onChange={setMode}
        />
        <Segmented
          value={linkedOnly ? "linked" : "all"}
          options={[
            { value: "linked", label: "Linked only" },
            { value: "all", label: `All (${linkMap.stats.workflows})` },
          ]}
          onChange={(v) => setLinkedOnly(v === "linked")}
        />
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 md:flex">
          <StatChip label="Showing" value={String(showing)} />
          <div className="h-[22px] w-px bg-line" />
          <StatChip label="Cross-links" value={String(linkMap.stats.links)} />
          <div className="h-[22px] w-px bg-line" />
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
                className="inline-block h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: "#f59e0b" }}
              />
              link · click a workflow to open it
            </span>
          </motion.div>
        </div>
      ) : (
        <div className="overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {/* search */}
            <div className="flex items-center gap-2 rounded-control border border-line bg-panel px-3 py-2">
              <Search className="size-3.5 text-t3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workflows…"
                className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-t3"
              />
            </div>

            {(
              [
                ["ghl", "GHL workflows", listData.ghl],
                ["make", "Make scenarios", listData.make],
              ] as const
            ).map(([source, title, rows]) => (
              <div key={source}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="size-[8px] rounded-[2px]"
                    style={{ background: appColor(source) }}
                  />
                  <h2 className="text-[11px] font-semibold text-t3">
                    {title}
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
                          className="size-[7px] flex-none rounded-full"
                          style={{
                            background: appColor(w.source),
                            boxShadow: `0 0 5px color-mix(in srgb, ${appColor(w.source)} 60%, transparent)`,
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                          {w.name}
                        </span>
                        {w.source === "ghl" && w.stepCount != null && (
                          <span className="font-mono text-[10px] text-t3">
                            {w.stepCount} steps
                          </span>
                        )}
                        {w.talksToGhl && (
                          <span className="rounded-full border border-line bg-pill px-2 py-[2px] text-[9.5px] font-semibold text-t3">
                            uses GHL
                          </span>
                        )}
                        {li && (
                          <span
                            className="rounded-full border px-2 py-[2px] text-[9.5px] font-semibold"
                            style={{
                              color: li.dead ? "#ef4444" : "#f59e0b",
                              borderColor: `color-mix(in srgb, ${li.dead ? "#ef4444" : "#f59e0b"} 40%, transparent)`,
                              background: `color-mix(in srgb, ${li.dead ? "#ef4444" : "#f59e0b"} 10%, transparent)`,
                            }}
                          >
                            {li.out > 0 && `${li.out} out`}
                            {li.out > 0 && li.in > 0 && " · "}
                            {li.in > 0 && `${li.in} in`}
                            {li.dead && " · broken"}
                          </span>
                        )}
                        <span className="text-[11px] text-t3">→</span>
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
