"use client";

import { X } from "lucide-react";
import { CommentsThread } from "@/components/shared/CommentsSection";
import type { ProviderId } from "@/lib/connectors/types";

/* Workflow-level discussion (target wf:{provider}:{id}). */
export function CommentsDrawer({
  provider,
  externalId,
  onClose,
  onCountChange,
}: {
  provider: ProviderId;
  externalId: string;
  onClose: () => void;
  onCountChange?: (open: number, total: number) => void;
}) {
  return (
    <aside
      role="dialog"
      aria-label="Workflow comments"
      className="absolute bottom-3 right-3 top-3 z-[3] flex w-[380px] max-w-[calc(100%-24px)] flex-col rounded-card border border-line bg-pill shadow-[0_16px_40px_var(--ambient)]"
    >
      <header className="flex items-center gap-2 border-b border-line2 px-3.5 py-2.5">
        <h2 className="text-[12.5px] font-semibold">Comments</h2>
        <span className="text-[10.5px] text-t3">on this workflow · step-level threads live in each step&apos;s panel</span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close comments" className="flex size-6 items-center justify-center rounded-control border border-line text-t3 hover:text-t1">
          <X aria-hidden="true" className="size-3" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <CommentsThread targetType="workflow" targetKey={`wf:${provider}:${externalId}`} onCountChange={onCountChange} />
      </div>
    </aside>
  );
}
