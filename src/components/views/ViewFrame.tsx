"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { IconBtn } from "@/components/shell/IconBtn";
import { useShell } from "@/components/shell/shell-context";
import { usePanelAvailable } from "@/components/shell/SidePanel";

/*
 * Common chrome for non-canvas views: the 46px bar (browser toggle · title ·
 * meta · controls) and a centred, scrolling column for the content.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ViewBar({ title, meta: _meta, children }: { title: string; meta?: React.ReactNode; children?: React.ReactNode }) {
  const { railOpen, toggleRail } = useShell();
  const available = usePanelAvailable();
  return (
    <div className="flex h-[46px] flex-none items-center gap-2.5 border-b border-line px-3">
      {available && <IconBtn icon={railOpen ? PanelLeftClose : PanelLeftOpen} label={railOpen ? "Hide side panel ( [ )" : "Show side panel ( [ )"} size={26} onClick={toggleRail} />}
      <h1 className="text-[13.5px] font-semibold tracking-[-0.01em]">{title}</h1>
      <div className="flex-1" />
      {children}
    </div>
  );
}

/* Views fill the available width (edge padding only) — no centred column. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ViewBody({ children, width: _width }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 pb-8 pt-4">{children}</div>
    </div>
  );
}

/** Card-list container used by dashboard, feeds, assets, needs-you. */
export function RowCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-panel shadow-[var(--shadow-card)] anim-fade-up ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

export function ViewTitle({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[16px] font-bold tracking-[-0.01em]">{title}</h2>
        {sub && <p className="tabular m-0 mt-[3px] font-mono text-[10.5px] text-t3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] italic text-t3">{children}</p>;
}
