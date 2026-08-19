"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Layers,
  Network,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { appColor, appGlyph, appName, onColorGradient } from "@/lib/apps";
import { useMakeHierarchy } from "@/components/app/ConnectionsProvider";
import { ErrorCard } from "@/components/shared/ErrorCard";
import { Segmented } from "@/components/shared/Segmented";
import { workflowHref } from "@/lib/portals";
import type { Scenario } from "@/app/lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;

type Status = "active" | "paused" | "inactive";

function statusOf(s: Scenario): Status {
  if (s.isActive && !s.isPaused) return "active";
  if (s.isPaused) return "paused";
  return "inactive";
}

/* Status colors come from the theme tokens: text role for readable chip
   text, graphic role for dots/tints (see globals.css). */
const STATUS_META: Record<
  Status,
  { color: string; bg: string; border: string; label: string; dot: string }
> = {
  active: {
    color: "var(--ok-text)",
    bg: "color-mix(in srgb, var(--ok) 10%, transparent)",
    border: "color-mix(in srgb, var(--ok) 30%, transparent)",
    label: "Active",
    dot: "var(--ok)",
  },
  paused: {
    color: "var(--warn-text)",
    bg: "color-mix(in srgb, var(--warn) 10%, transparent)",
    border: "color-mix(in srgb, var(--warn) 32%, transparent)",
    label: "Paused",
    dot: "var(--warn)",
  },
  inactive: {
    color: "var(--off-text)",
    bg: "color-mix(in srgb, var(--off) 10%, transparent)",
    border: "color-mix(in srgb, var(--off) 30%, transparent)",
    label: "Inactive",
    dot: "var(--off)",
  },
};

function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: EASE });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

function Card({
  className = "",
  delay = 0,
  hover = false,
  children,
}: {
  className?: string;
  delay?: number;
  hover?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -2 } : undefined}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={`card-sharp rounded-card border border-line bg-panel backdrop-blur-[14px] ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  caption,
  icon,
  delay,
}: {
  label: string;
  value: number;
  caption?: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <Card delay={delay} hover className="flex items-center gap-3.5 px-4 py-3.5">
      <div className="flex size-9 flex-none items-center justify-center rounded-[10px] border border-line bg-hover text-t2">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="tabular text-[21px] font-bold leading-none tracking-[-0.02em]">
          <CountUp value={value} />
        </p>
        <p className="mt-1.5 truncate text-[10.5px] leading-none text-t3">
          {label}
          {caption && <span> · {caption}</span>}
        </p>
      </div>
    </Card>
  );
}

function AppPuck({ app, size = 34 }: { app: string; size?: number }) {
  const col = appColor(app);
  return (
    <div
      aria-hidden="true"
      className="flex flex-none items-center justify-center rounded-[10px] border border-white/25 font-mono text-[11px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: onColorGradient(col),
        boxShadow: `0 3px 0 color-mix(in oklab, ${col} 55%, #000000), 0 6px 14px var(--ambient)`,
        textShadow: "0 1px 2px rgba(0,0,0,.3)",
      }}
    >
      {appGlyph(app)}
    </div>
  );
}

function ScenarioRow({
  scenario,
  team,
  folder,
}: {
  scenario: Scenario;
  team: string;
  folder: string | null;
}) {
  const st = STATUS_META[statusOf(scenario)];
  const primaryApp = scenario.usedPackages[0] || "make";
  return (
    <Link
      href={workflowHref({ source: "make", refId: String(scenario.id) })}
      className="group flex items-center justify-between gap-3 px-4 py-[11px] transition-colors hover:bg-hover"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="transition-transform duration-150 group-hover:-translate-y-[2px]">
          <AppPuck app={primaryApp} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold leading-tight tracking-[-0.01em]">
            {scenario.name}
          </p>
          <p className="mt-[3px] flex items-center gap-1.5 truncate text-[10.5px] leading-none text-t3">
            <span className="font-mono text-[9.5px] text-t3">
              #{scenario.id}
            </span>
            <span className="size-[2px] rounded-full bg-t3" />
            <span className="truncate">
              {team}
              {folder ? ` / ${folder}` : ""}
            </span>
            {scenario.usedPackages.length > 1 && (
              <>
                <span className="size-[2px] rounded-full bg-t3" />
                <span>{scenario.usedPackages.length} apps</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2.5">
        <span
          className="inline-flex w-[74px] items-center justify-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-semibold"
          style={{ color: st.color, background: st.bg, borderColor: st.border }}
        >
          <span
            aria-hidden="true"
            className="size-[5px] rounded-full"
            style={{
              background: st.dot,
              boxShadow:
                st.dot === "var(--off)" ? "none" : `0 0 6px ${st.dot}`,
            }}
          />
          {st.label}
        </span>
        <ChevronRight className="size-3.5 -translate-x-1 text-t3 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { hierarchy, loading, error, connection } = useMakeHierarchy();
  const all = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.teams.flatMap((t) => [
      ...t.folders.flatMap((f) =>
        f.scenarios.map((s) => ({
          scenario: s,
          team: t.name,
          folder: f.name as string | null,
        }))
      ),
      ...t.unfolderedScenarios.map((s) => ({
        scenario: s,
        team: t.name,
        folder: null as string | null,
      })),
    ]);
  }, [hierarchy]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, inactive: 0 };
    for (const { scenario } of all) c[statusOf(scenario)]++;
    return c;
  }, [all]);

  const apps = useMemo(() => {
    const m = new Map<string, number>();
    for (const { scenario } of all)
      for (const p of scenario.usedPackages) m.set(p, (m.get(p) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(({ scenario }) => {
      if (statusFilter !== "all" && statusOf(scenario) !== statusFilter)
        return false;
      if (!q) return true;
      return (
        scenario.name.toLowerCase().includes(q) ||
        String(scenario.id).includes(q) ||
        scenario.usedPackages.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [all, query, statusFilter]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full items-center justify-center"
      >
        <div className="text-center">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 45 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mx-auto flex size-9 items-center justify-center rounded-[10px] bg-t1"
          >
            <div className="size-2.5 animate-pulse rounded-full bg-bg motion-reduce:animate-none" />
          </motion.div>
          <p className="mt-4 text-[12px] text-t3">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorCard
        title="Failed to load"
        message={error}
        backHref="/settings/connections"
        backLabel="Manage connections"
      />
    );
  }

  if (!hierarchy) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="card-sharp w-full max-w-md rounded-card border border-line bg-panel p-6 text-center backdrop-blur-[14px]">
          <h1 className="mb-1.5 text-[14px] font-semibold">
            No Make connection yet
          </h1>
          <p className="mb-4 text-[12px] text-t2">
            The dashboard summarizes your Make scenarios. Connect Make to see
            it, or jump straight to the workflow map for other platforms.
          </p>
          <div className="flex items-center justify-center gap-4 text-[12px] font-semibold">
            <Link
              href="/settings/connections"
              className="text-t1 underline-offset-4 hover:underline"
            >
              Connect Make
            </Link>
            <Link
              href="/unified"
              className="text-t1 underline-offset-4 hover:underline"
            >
              Workflow map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalScenarios = all.length;
  const totalFolders = hierarchy.teams.reduce(
    (sum, t) => sum + t.folders.length,
    0
  );
  const health = totalScenarios
    ? Math.round((counts.active / totalScenarios) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col">
      {/* top bar */}
      <header className="flex h-[52px] flex-none items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t3 hover:text-t1" />
        <div className="h-4 w-px bg-line" />
        <div className="flex items-baseline gap-2">
          <h1 className="text-[13.5px] font-semibold tracking-[-0.01em]">
            Dashboard
          </h1>
          <span className="text-[10px] text-t3">/</span>
          <span className="text-[11px] text-t3">Overview</span>
        </div>
        <div className="flex-1" />
        <span className="hidden rounded-[5px] border border-line bg-hover px-[7px] py-[3px] font-mono text-[9.5px] text-t2 sm:inline">
          {connection?.label || `Make · ${hierarchy.organizationId}`}
        </span>
        <Button
          asChild
          size="sm"
          className="h-auto rounded-control px-3 py-[6px] text-[11.5px] font-semibold hover:opacity-85"
        >
          <Link href="/monitor">
            <Activity className="size-3" />
            Open Monitor
          </Link>
        </Button>
      </header>

      {/* content */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {/* brand backdrop */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
          style={{
            backgroundImage:
              "radial-gradient(var(--dot) 1.2px, transparent 1.6px)",
            backgroundSize: "24px 24px",
            opacity: 0.28,
            maskImage:
              "radial-gradient(ellipse 85% 100% at 50% 0%, black 0%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 85% 100% at 50% 0%, black 0%, transparent 72%)",
          }}
        />

        <div className="relative flex flex-col gap-3.5 p-4 lg:p-5">
          {/* stats */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Teams"
              value={hierarchy.teams.length}
              icon={<Users className="size-[15px]" />}
              delay={0}
            />
            <Stat
              label="Folders"
              value={totalFolders}
              icon={<Layers className="size-[15px]" />}
              delay={0.05}
            />
            <Stat
              label="Scenarios"
              value={totalScenarios}
              caption={`${counts.active} active`}
              icon={<Network className="size-[15px]" />}
              delay={0.1}
            />
            <Stat
              label="Apps in use"
              value={apps.length}
              icon={<Boxes className="size-[15px]" />}
              delay={0.15}
            />
          </div>

          {/* main grid */}
          <div className="grid items-start gap-3.5 xl:grid-cols-3">
            {/* scenarios */}
            <Card delay={0.18} className="overflow-hidden xl:col-span-2">
              <div className="flex flex-wrap items-center gap-2.5 border-b border-line2 px-4 py-2.5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
                  Scenarios
                </h2>
                <span className="rounded-[5px] border border-line bg-hover px-1.5 py-0.5 font-mono text-[9.5px] text-t2">
                  {filtered.length}
                </span>
                <div className="flex-1" />
                <Segmented
                  label="Filter scenarios by status"
                  value={statusFilter}
                  options={(["all", "active", "paused", "inactive"] as const).map(
                    (f) => ({ value: f, label: f })
                  )}
                  onChange={setStatusFilter}
                />
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-t3"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search scenarios"
                    className="h-[26px] w-[140px] rounded-full border-line bg-hover pl-7 text-[11px] placeholder:text-t3"
                  />
                </div>
              </div>
              <div className="divide-y divide-line2">
                <AnimatePresence initial={false} mode="popLayout">
                  {filtered.length === 0 ? (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-4 py-10 text-center text-[12px] text-t3"
                    >
                      No scenarios match
                    </motion.p>
                  ) : (
                    filtered.map(({ scenario, team, folder }) => (
                      <motion.div
                        key={scenario.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.25, ease: EASE }}
                      >
                        <ScenarioRow
                          scenario={scenario}
                          team={team}
                          folder={folder}
                        />
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* right rail */}
            <div className="flex flex-col gap-3.5">
              {/* health */}
              <Card delay={0.22} className="px-4 py-3.5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
                    Fleet health
                  </h2>
                  <span className="tabular font-mono text-[11px] font-medium text-t2">
                    {health}% active
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`Fleet health: ${counts.active} active, ${counts.paused} paused, ${counts.inactive} inactive`}
                  className="flex h-[8px] w-full gap-[2px] overflow-hidden rounded-full bg-hover"
                >
                  {(["active", "paused", "inactive"] as const).map((k) =>
                    counts[k] > 0 ? (
                      <motion.div
                        key={k}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
                        className="origin-left rounded-full"
                        style={{
                          flex: counts[k],
                          background:
                            k === "inactive"
                              ? "color-mix(in srgb, var(--off) 45%, transparent)"
                              : STATUS_META[k].dot,
                        }}
                      />
                    ) : null
                  )}
                </div>
                <div className="mt-3 divide-y divide-line2">
                  {(["active", "paused", "inactive"] as const).map((k) => (
                    <div
                      key={k}
                      className="flex items-center gap-2 py-[7px] text-[11.5px] text-t2 first:pt-0 last:pb-0"
                    >
                      <span
                        aria-hidden="true"
                        className="size-[7px] rounded-[2px]"
                        style={{ background: STATUS_META[k].dot }}
                      />
                      <span className="capitalize">{k}</span>
                      <span className="tabular ml-auto font-mono text-[10.5px] text-t3">
                        {counts[k]}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* apps in use */}
              <Card delay={0.26} className="px-4 py-3.5">
                <h2 className="mb-3 text-[13px] font-semibold tracking-[-0.01em]">
                  Apps in use
                </h2>
                <div className="flex flex-col gap-2.5">
                  {apps.length === 0 && (
                    <p className="text-[11px] text-t3">No apps detected</p>
                  )}
                  {apps.map(([app, count], i) => (
                    <div key={app} className="flex items-center gap-2.5">
                      <AppPuck app={app} size={24} />
                      <span className="w-[92px] truncate text-[11.5px] font-medium">
                        {appName(app)}
                      </span>
                      <div className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-hover">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: count / (apps[0]?.[1] || 1) }}
                          transition={{
                            duration: 0.7,
                            ease: EASE,
                            delay: 0.4 + i * 0.05,
                          }}
                          className="h-full origin-left rounded-full"
                          style={{ background: "var(--barc)" }}
                        />
                      </div>
                      <span className="tabular w-5 text-right font-mono text-[10px] text-t3">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* monitor promo */}
              <Card delay={0.3} className="relative overflow-hidden px-4 py-3.5">
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "radial-gradient(var(--dot) 1.2px, transparent 1.6px)",
                    backgroundSize: "20px 20px",
                    opacity: 0.5,
                    maskImage:
                      "radial-gradient(ellipse 90% 90% at 100% 0%, black 0%, transparent 65%)",
                    WebkitMaskImage:
                      "radial-gradient(ellipse 90% 90% at 100% 0%, black 0%, transparent 65%)",
                  }}
                />
                <div className="relative">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="size-[7px] rounded-full bg-ok"
                      style={{
                        boxShadow: "0 0 8px #22c55e",
                        animation: "blinkdot 1.6s infinite",
                      }}
                    />
                    <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
                      Live monitor
                    </h2>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-t2">
                    Watch runs pulse through your workflows on the infinite 3D
                    canvas.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-auto rounded-control border-line bg-transparent px-3 py-[6px] text-[11.5px] font-semibold text-t2 hover:border-t1 hover:bg-transparent hover:text-t1"
                  >
                    <Link href="/monitor">
                      Open Monitor
                      <ArrowUpRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
