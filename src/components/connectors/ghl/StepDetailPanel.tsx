"use client";

import type { DetailSectionsProps, NodeDescription } from "@/lib/connectors/types";
import { CopyJsonButton, JsonBlock, KvRow, Section } from "@/components/shared/DetailPanelKit";
import type { AssetRef } from "@/app/lib/api";

/* GHL steps: {id, name, type, attributes, next, parentKey, order}
   GHL triggers: {id, name, type, conditions, active, ...} */
export type GhlStep = Record<string, unknown>;

function isTriggerStep(step: GhlStep): boolean {
  return !("next" in step) && Array.isArray(step.conditions);
}

/** Inspector header fields for a GHL step/trigger payload. */
export function describeGhlStep(data: unknown): NodeDescription {
  const step = data as GhlStep;
  const stepType = String(step.type ?? "step");
  return {
    title: String(step.name || stepType),
    app: "ghl",
    kindLabel: isTriggerStep(step) ? "trigger" : stepType.replace(/_/g, " "),
    summary: (step.summary as string | undefined) ?? null,
    ordinal: (step.ordinal as string | null | undefined) ?? null,
    waitText: (step.waitFor as { text: string } | null | undefined)?.text ?? null,
    assets: step.assets as AssetRef[] | undefined,
  };
}

/** Provider-specific sections under "Raw config" for a GHL step. */
export default function StepDetailSections({ data }: DetailSectionsProps) {
  const step = data as GhlStep | null;
  if (!step) return null;
  const stepType = String(step.type ?? "step");
  const attributes = step.attributes as Record<string, unknown> | undefined;
  const conditions = step.conditions as unknown[] | undefined;
  const webhookUrl =
    stepType === "custom_webhook" || stepType === "webhook" ? (attributes?.url as string | undefined) : undefined;
  const branches = attributes?.branches as unknown[] | undefined;

  return (
    <>
      <Section title="Step identity">
        <div className="flex flex-col">
          <KvRow k="ID" v={<span className="break-all">{String(step.id)}</span>} />
          <KvRow k="Type" v={<span className="break-all">{stepType}</span>} />
          {"order" in step && <KvRow k="Order" v={String(step.order)} />}
          {"active" in step && <KvRow k="Active" v={String(step.active)} />}
        </div>
      </Section>

      {webhookUrl && (
        <Section title="Webhook target">
          <div className="break-all rounded-code border border-line2 bg-code px-3.5 py-3 font-mono text-[12px] leading-[1.6] text-t1">
            <span className="mr-2 inline-flex rounded-full border border-[color-mix(in_srgb,var(--warn)_32%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-[7px] py-[1px] text-[10.5px] font-semibold text-warn-text">
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
              <span key={i} className="rounded-full border border-line bg-pill px-2.5 py-[3px] text-[11px] font-semibold text-t2">
                {String((b as Record<string, unknown>)?.name ?? `Branch ${i + 1}`)}
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
  );
}
