"use client";

import type { DetailPanelProps } from "@/lib/connectors/types";
import { appColor, appGlyph } from "@/lib/apps";
import {
  CopyJsonButton,
  DetailPanelShell,
  JsonBlock,
  KvRow,
  Section,
} from "@/components/shared/DetailPanelKit";
import { AssetsSection } from "@/components/shared/AssetsSection";
import { IssuesSection } from "@/components/shared/IssuesSection";
import type { AssetRef } from "@/app/lib/api";

/* GHL steps: {id, name, type, attributes, next, parentKey, order}
   GHL triggers: {id, name, type, conditions, active, ...} */
export type GhlStep = Record<string, unknown>;

export default function StepDetailPanel({
  data,
  loading,
  error,
  onClose,
  onFindUses,
  issues,
}: DetailPanelProps) {
  const step = data as GhlStep | null;
  if (!loading && !error && !step) return null;

  const col = appColor("ghl");
  const stepType = step ? String(step.type ?? "step") : "";
  const attributes = step?.attributes as Record<string, unknown> | undefined;
  const conditions = step?.conditions as unknown[] | undefined;
  const isTrigger = !!step && !("next" in step) && Array.isArray(conditions);
  const webhookUrl =
    stepType === "custom_webhook" || stepType === "webhook"
      ? (attributes?.url as string | undefined)
      : undefined;
  const branches = attributes?.branches as unknown[] | undefined;
  const summary = step?.summary as string | undefined;
  const ordinal = step?.ordinal as string | null | undefined;
  const waitFor = step?.waitFor as { text: string } | null | undefined;
  const assets = step?.assets as AssetRef[] | undefined;

  return (
    <DetailPanelShell
      title={String(step?.name || stepType)}
      subtitle={step ? `GHL · ${isTrigger ? "trigger" : stepType}` : ""}
      glyph={loading ? "…" : appGlyph("ghl")}
      color={col}
      loading={loading}
      error={error}
      onClose={onClose}
    >
      {step && (
        <>
          {(summary || ordinal || waitFor) && (
            <Section title="What it does">
              <div className="flex flex-col">
                {summary && <KvRow k="Does" v={summary} />}
                {ordinal && (
                  <KvRow k="Fires" v={<span className="font-mono">{ordinal}</span>} />
                )}
                {waitFor && <KvRow k="Waits" v={waitFor.text} />}
              </div>
            </Section>
          )}

          <IssuesSection issues={issues} onFindUses={onFindUses} />
          <AssetsSection assets={assets} onFindUses={onFindUses} />

          <Section title="Step identity">
            <div className="flex flex-col">
              <KvRow
                k="ID"
                v={<span className="break-all">{String(step.id)}</span>}
              />
              <KvRow
                k="Type"
                v={<span className="break-all">{stepType}</span>}
              />
              {"order" in step && <KvRow k="Order" v={String(step.order)} />}
              {"active" in step && <KvRow k="Active" v={String(step.active)} />}
            </div>
          </Section>

          {webhookUrl && (
            <Section title="Webhook target">
              <div className="break-all rounded-code border border-line2 bg-code px-3.5 py-3 font-mono text-[11px] leading-[1.6] text-t1">
                <span className="mr-2 inline-flex rounded-full border border-[color-mix(in_srgb,var(--warn)_32%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-[7px] py-[1px] text-[9.5px] font-semibold text-warn-text">
                  {String(attributes?.method || "POST")}
                </span>
                {webhookUrl}
              </div>
            </Section>
          )}

          {Array.isArray(branches) && branches.length > 0 && (
            <Section title="Branches">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {branches.map((b, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-line bg-pill px-2.5 py-[3px] text-[10px] font-semibold text-t2"
                  >
                    {String(
                      (b as Record<string, unknown>)?.name ?? `Branch ${i + 1}`
                    )}
                  </span>
                ))}
              </div>
              <JsonBlock data={branches} />
            </Section>
          )}

          {Array.isArray(conditions) && conditions.length > 0 && (
            <Section title="Trigger conditions">
              <JsonBlock data={conditions} />
            </Section>
          )}

          {attributes && !branches && (
            <Section title="Attributes" action={<CopyJsonButton data={step} />}>
              <JsonBlock data={attributes} />
            </Section>
          )}
        </>
      )}
    </DetailPanelShell>
  );
}
