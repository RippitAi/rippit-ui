"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  Activity,
  HeartPulse,
  History,
  Info,
  MessageSquare,
  Network,
  NotebookPen,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { IconBtn, CornerBadge } from "@/components/shell/IconBtn";
import { StatusPill } from "@/components/shared/StatusPill";
import { AppPuck } from "@/components/shared/AppPuck";
import { useShell } from "@/components/shell/shell-context";
import type { StatusPillInfo } from "@/lib/connectors/types";

/*
 * Everything you can do to this workflow, one 46px row: browser toggle ·
 * identity (puck, name, status, changes pill, owner, watch, meta) · tools
 * (Info · Changes · Comments · Runs · Notes) · system map · Open in. Under
 * 880px the owner chip and meta hide and Open-in becomes an icon.
 */
export type DockTool = "health" | "info" | "changes" | "comments" | "runs" | "notes";

export interface ToolSpec {
  id: DockTool;
  label: string;
  badge?: number | string | null;
  dot?: boolean;
  tone?: "t1" | "warn" | "err" | "ok" | "info";
  hidden?: boolean;
}

const TOOL_ICON: Record<DockTool, LucideIcon> = {
  health: HeartPulse,
  info: Info,
  changes: History,
  comments: MessageSquare,
  runs: Activity,
  notes: NotebookPen,
};

export function ActionBar({
  app,
  name,
  statusPill,
  live,
  changes,
  ownerName,
  ownerIsYou,
  onOwner,
  watching,
  onToggleWatch,
  onRefresh,
  refreshing = false,
  meta,
  tools,
  activeTool,
  onTool,
  mapHref,
  nativeUrl,
  providerLabel,
  accountTitle,
}: {
  app: string;
  name: string;
  statusPill: StatusPillInfo;
  live: boolean;
  changes: number;
  ownerName: string | null;
  ownerIsYou?: boolean;
  onOwner?: () => void;
  watching: boolean;
  onToggleWatch: () => void;
  /** Manual sync: live-fetch this workflow from its platform right now. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** e.g. "synced 4 min ago · last run 18 s ago · ok" */
  meta: string | null;
  tools: ToolSpec[];
  activeTool: DockTool | null;
  onTool: (t: DockTool) => void;
  mapHref: string | null;
  nativeUrl: string | null;
  providerLabel: string;
  /** "Make · Acme" — which account this workflow belongs to. */
  accountTitle: string;
}) {
  const { railOpen, toggleRail } = useShell();
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 880));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const initials = ownerName
    ? ownerName
        .replace(/@.*$/, "")
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "—";

  return (
    <div ref={ref} className="flex h-[46px] flex-none items-center gap-2 border-b border-line px-3">
      <IconBtn
        icon={railOpen ? PanelLeftClose : PanelLeftOpen}
        label={railOpen ? "Hide side panel ( [ )" : "Show side panel ( [ )"}
        size={26}
        onClick={toggleRail}
      />
      <AppPuck app={app} size={22} title={accountTitle} />
      <h1 className="min-w-[120px] flex-[0_1_auto] truncate text-[13.5px] font-semibold tracking-[-0.01em]" title={`${name} — ${accountTitle}`}>
        {name}
      </h1>
      <StatusPill pill={statusPill} pulse={live} />
      {changes > 0 && (
        <button type="button" onClick={() => onTool("changes")} className="cursor-pointer" aria-label={`${changes} changes since you last looked — open Changes`}>
          <StatusPill pill={{ label: `${changes} change${changes > 1 ? "s" : ""}`, tone: "info" }} dot={false} />
        </button>
      )}
      {!narrow && (
        <button
          type="button"
          onClick={onOwner}
          title={ownerName ? `Owner: ${ownerName}` : "No owner — open Info to set one"}
          className="inline-flex h-6 flex-none cursor-pointer items-center gap-1.5 rounded-full border border-line bg-hover py-0 pl-[3px] pr-[9px] text-[11.5px] font-semibold text-t2 transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-t1"
        >
          <span className="inline-flex size-[18px] items-center justify-center rounded-full border border-line bg-pill text-[8.5px] font-bold text-t1">{initials}</span>
          {ownerName ? (ownerIsYou ? "you" : ownerName.split(" ")[0]) : "no owner"}
        </button>
      )}
      <IconBtn
        icon={watching ? BellRing : Bell}
        label={watching ? "Watching — click to unwatch" : "Watch this workflow"}
        size={26}
        active={watching}
        onClick={onToggleWatch}
      />
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={refreshing ? "Syncing…" : `Sync now — pull the latest from ${providerLabel}`}
          title={refreshing ? "Syncing…" : `Sync now — pull the latest from ${providerLabel}`}
          className="inline-flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-control border border-line text-t3 transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-t1 disabled:cursor-default"
        >
          <RefreshCw aria-hidden="true" className={`size-[13px] ${refreshing ? "spin motion-reduce:animate-none" : ""}`} />
        </button>
      )}
      {!narrow && meta && (
        <span className="tabular whitespace-nowrap font-mono text-[10px] text-t3" title={accountTitle}>
          {meta}
        </span>
      )}
      <div className="flex-1" />
      <div className="flex flex-none items-center gap-1">
        {mapHref && (
          <Link href={mapHref} aria-label="View in system map" title="View in system map" className="inline-flex size-[26px] items-center justify-center rounded-control border border-line text-t3 transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-t1">
            <Network aria-hidden="true" className="size-[13px]" />
          </Link>
        )}
        {tools
          .filter((t) => !t.hidden)
          .map((t) => (
            <span key={t.id} className="relative inline-flex">
              <IconBtn icon={TOOL_ICON[t.id]} label={t.label} size={26} active={activeTool === t.id} onClick={() => onTool(t.id)} />
              <CornerBadge value={t.badge} dot={t.dot} tone={t.tone ?? "t1"} />
            </span>
          ))}
        <span aria-hidden="true" className="mx-[3px] h-[18px] w-px bg-line2" />
        {nativeUrl &&
          (narrow ? (
            <a href={nativeUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open in ${providerLabel}`} title={`Open in ${providerLabel}`} className="inline-flex size-[26px] items-center justify-center rounded-control border border-line text-t3 transition-colors hover:border-line-strong hover:text-t1">
              <ArrowUpRight aria-hidden="true" className="size-[13px]" />
            </a>
          ) : (
            <a
              href={nativeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[26px] items-center gap-1 rounded-control bg-t1 px-2.5 text-[12px] font-semibold text-bg transition-[opacity,transform] duration-[var(--dur-fast)] hover:opacity-90 active:scale-[.98]"
            >
              <ArrowUpRight aria-hidden="true" className="size-[11px]" /> Open in {providerLabel}
            </a>
          ))}
      </div>
    </div>
  );
}
