"use client";

import Link from "next/link";
import { ArrowUpRight, Link2 } from "lucide-react";
import type { AssetRef } from "@/app/lib/api";
import { Section } from "@/components/shared/DetailPanelKit";

/** Route of the asset page: every use across workflows + open in native app. */
export function assetHref(kind: string, value: string): string {
  return `/assets/${encodeURIComponent(kind)}/${encodeURIComponent(value)}`;
}

/*
 * "Assets" block shared by every node inspector: name (→ asset page with every
 * use across workflows) · kind · Open ↗ (Tier-1 deep link when the API
 * derived one; never for hashed webhooks/endpoints).
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
  /** Legacy hook — when given, the name calls this instead of navigating. */
  onFindUses?: (ref: { kind: string; value: string; label?: string | null }) => void;
}) {
  if (!assets || assets.length === 0) return null;
  return (
    <Section title={`Assets (${assets.length})`}>
      <ul className="flex flex-col">
        {assets.map((a) => {
          const name = a.label || kindLabel(a.kind);
          const nameEl = a.dynamic ? (
            <span className="truncate text-[11.5px] text-t1">{name}</span>
          ) : onFindUses ? (
            <button type="button" onClick={() => onFindUses({ kind: a.kind, value: a.value, label: a.label })} className="truncate text-left text-[11.5px] text-t1 hover:underline" title="All uses across workflows">
              {name}
            </button>
          ) : (
            <Link href={assetHref(a.kind, a.value)} className="truncate text-[11.5px] text-t1 hover:underline" title="All uses across workflows">
              {name}
            </Link>
          );
          return (
            <li key={`${a.kind}:${a.value}`} className="flex items-center gap-2 border-b border-line2 px-0.5 py-[7px]">
              <Link2 aria-hidden="true" className="size-[11px] flex-none text-t3" />
              <div className="flex min-w-0 flex-1 flex-col">
                {nameEl}
                <span className="truncate text-[9.5px] text-t3">
                  {kindLabel(a.kind)}
                  {a.dynamic ? " · mapped at runtime" : ""}
                </span>
              </div>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${name} in its native app`}
                  title="Open the asset itself in a new tab"
                  className="inline-flex flex-none items-center gap-[3px] text-[10px] text-t2 transition-colors hover:text-t1"
                >
                  open <ArrowUpRight aria-hidden="true" className="size-[9px]" />
                </a>
              ) : (
                <span className="flex-none text-[9.5px] text-t3" title="No native link for this asset kind (webhooks and endpoints are stored hashed)">
                  —
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
