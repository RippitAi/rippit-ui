"use client";

import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import type { Tag, WorkflowMeta, ExecutionsResponse, LastRun } from "@/app/lib/api";
import type { ProviderId } from "@/lib/connectors/types";
import { getConnector } from "@/lib/connectors";
import { IssueCountChips } from "@/components/shared/IssuesSection";
import { OwnerChip, WatchToggle } from "@/components/shared/OwnerNotes";
import { TagPicker } from "@/components/tags/TagPicker";
import { LastRunChip } from "@/components/shared/RunsPanel";
import { KvRow, Section } from "@/components/shared/DetailPanelKit";

/*
 * Workflow "Info" inspector: everything that used to crowd the header —
 * owner, watch, tags, stats, issues summary, last run, open-in, linked set.
 */
export function InfoPanel({
  provider,
  externalId,
  name,
  stats,
  issueCounts,
  nativeUrl,
  linkedSetHref,
  tags,
  onTagsChange,
  meta,
  onMetaChange,
  lastRun,
  linkMapLastRun,
  onClose,
}: {
  provider: ProviderId;
  externalId: string;
  name: string;
  stats: { label: string; value: string }[];
  issueCounts: { error: number; warn: number; info: number };
  nativeUrl: string | null;
  linkedSetHref: string | null;
  tags: Tag[];
  onTagsChange: (t: Tag[]) => void;
  meta: WorkflowMeta | null;
  onMetaChange: (m: WorkflowMeta | ((m: WorkflowMeta | null) => WorkflowMeta | null)) => void;
  lastRun: ExecutionsResponse["executions"][number] | null;
  linkMapLastRun?: LastRun;
  onClose: () => void;
}) {
  const connector = getConnector(provider);
  return (
    <aside
      role="dialog"
      aria-label="Workflow info"
      className="absolute bottom-3 right-3 top-3 z-[3] flex w-[360px] max-w-[calc(100%-24px)] flex-col rounded-card border border-line bg-pill shadow-[0_16px_40px_var(--ambient)]"
    >
      <header className="flex items-center gap-2 border-b border-line2 px-3.5 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{name}</h2>
        <button type="button" onClick={onClose} aria-label="Close info" className="flex size-6 items-center justify-center rounded-control border border-line text-t3 hover:text-t1">
          <X aria-hidden="true" className="size-3" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-3">
        <Section title="Team">
          <div className="flex flex-wrap items-center gap-2">
            <OwnerChip provider={provider} externalId={externalId} meta={meta} onChange={(m) => onMetaChange(m)} />
            <WatchToggle
              provider={provider}
              externalId={externalId}
              watching={!!meta?.watching}
              onChange={(w) => onMetaChange((m) => (m ? { ...m, watching: w } : m))}
            />
          </div>
          <div className="mt-2">
            <TagPicker provider={provider} externalId={externalId} tags={tags} onChange={onTagsChange} />
          </div>
        </Section>

        {(issueCounts.error > 0 || issueCounts.warn > 0 || lastRun || linkMapLastRun) && (
          <Section title="Health">
            <div className="flex flex-wrap items-center gap-1.5">
              <IssueCountChips counts={issueCounts} />
              {(lastRun || linkMapLastRun) && (
                <LastRunChip status={lastRun?.status ?? linkMapLastRun?.status ?? "unknown"} at={lastRun?.startedAt ?? linkMapLastRun?.at ?? null} />
              )}
            </div>
          </Section>
        )}

        <Section title={`${connector.shortLabel} ${connector.nouns.workflow}`}>
          <div className="flex flex-col">
            {stats.map((s) => (
              <KvRow key={s.label} k={s.label} v={s.value} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {nativeUrl && (
              <a
                href={nativeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-[3px] text-[10.5px] font-semibold text-t2 hover:border-t1 hover:text-t1"
              >
                Open in {connector.shortLabel}
                <ArrowUpRight aria-hidden="true" className="size-3" />
              </a>
            )}
            {linkedSetHref && (
              <Link href={linkedSetHref} className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-[3px] text-[10.5px] font-semibold text-t2 hover:border-t1 hover:text-t1">
                View linked set →
              </Link>
            )}
          </div>
        </Section>
      </div>
    </aside>
  );
}
