"use client";

import { ArrowUpRight, Search } from "lucide-react";
import type { AssetRef } from "@/app/lib/api";
import { Section } from "@/components/shared/DetailPanelKit";

/*
 * "Assets" block shared by every node detail panel: name · kind · Open ↗
 * (Tier-1 deep link when the API derived one) · Find uses (tracing).
 * Values for sensitive kinds arrive hashed + masked from the API; we show
 * the label and never the raw value.
 */

const KIND_LABELS: Record<string, string> = {
  google_sheet: "Google Sheet",
  google_doc: "Google Doc",
  google_drive: "Google Drive",
  webhook_url: "Webhook",
  endpoint: "HTTP endpoint",
  ghl_pipeline: "GHL pipeline",
  ghl_pipeline_stage: "GHL stage",
  ghl_calendar: "GHL calendar",
  ghl_form: "GHL form",
  ghl_custom_field: "GHL custom field",
  ghl_workflow: "GHL workflow",
  ghl_tag: "GHL tag",
  ghl_campaign: "GHL campaign",
  ghl_template: "GHL template",
  airtable_base: "Airtable",
  notion_database: "Notion database",
  notion_page: "Notion page",
  slack_channel: "Slack channel",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

export function AssetsSection({
  assets,
  onFindUses,
}: {
  assets: AssetRef[] | undefined;
  onFindUses?: (ref: { kind: string; value: string; label?: string | null }) => void;
}) {
  if (!assets || assets.length === 0) return null;
  return (
    <Section title={`Assets · ${assets.length}`}>
      <ul className="flex flex-col">
        {assets.map((a) => (
          <li
            key={`${a.kind}:${a.value}`}
            className="flex items-center justify-between gap-3 border-b border-line2 px-0.5 py-[8px]"
          >
            <div className="min-w-0">
              <div className="truncate text-[11.5px] text-t1">
                {a.label || kindLabel(a.kind)}
                {a.dynamic && (
                  <span className="ml-1.5 rounded-full border border-line px-1.5 py-[1px] text-[9px] text-t3">
                    mapped at runtime
                  </span>
                )}
              </div>
              <div className="truncate text-[10px] text-t3">{kindLabel(a.kind)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!a.dynamic && onFindUses && (
                <button
                  type="button"
                  onClick={() => onFindUses({ kind: a.kind, value: a.value, label: a.label })}
                  aria-label={`Find all uses of ${a.label || kindLabel(a.kind)}`}
                  title="Find all uses"
                  className="flex size-6 items-center justify-center rounded-control border border-line text-t3 transition-colors hover:border-t1 hover:text-t1"
                >
                  <Search aria-hidden="true" className="size-3" />
                </button>
              )}
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${a.label || kindLabel(a.kind)} in its native app`}
                  title="Open ↗"
                  className="flex size-6 items-center justify-center rounded-control border border-line text-t3 transition-colors hover:border-t1 hover:text-t1"
                >
                  <ArrowUpRight aria-hidden="true" className="size-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
