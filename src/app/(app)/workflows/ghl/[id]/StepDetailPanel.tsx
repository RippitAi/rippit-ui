"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";
import { appColor, appGlyph } from "@/lib/apps";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Recursive syntax-colored JSON renderer (same palette as ModuleDetailPanel). */
function JsonValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined)
    return <span style={{ color: "var(--jbool)" }}>null</span>;
  if (typeof value === "boolean")
    return <span style={{ color: "var(--jbool)" }}>{String(value)}</span>;
  if (typeof value === "number")
    return <span style={{ color: "var(--jnum)" }}>{value}</span>;
  if (typeof value === "string")
    return <span style={{ color: "var(--jstr)" }}>&quot;{value}&quot;</span>;

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i, v] as const)
    : Object.entries(value as Record<string, unknown>);
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";

  if (entries.length === 0)
    return (
      <span style={{ color: "var(--jpunc)" }}>
        {open}
        {close}
      </span>
    );

  return (
    <>
      <span style={{ color: "var(--jpunc)" }}>{open}</span>
      {entries.map(([k, v], i) => (
        <div key={String(k)} style={{ paddingLeft: 14 }}>
          {!isArray && (
            <>
              <span style={{ color: "var(--jkey)" }}>&quot;{k}&quot;</span>
              <span style={{ color: "var(--jpunc)" }}>: </span>
            </>
          )}
          <JsonValue value={v} depth={depth + 1} />
          {i < entries.length - 1 && (
            <span style={{ color: "var(--jpunc)" }}>,</span>
          )}
        </div>
      ))}
      <span style={{ color: "var(--jpunc)" }}>{close}</span>
    </>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  if (data == null) return <p className="text-[11px] italic text-t3">None</p>;
  return (
    <div className="max-h-64 overflow-auto rounded-code border border-line2 bg-code px-3.5 py-3 font-mono text-[11px] leading-[1.75]">
      <JsonValue value={data} depth={0} />
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10.5px] font-semibold text-t3">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line2 px-0.5 py-[9px]">
      <div className="text-[11px] text-t3">{k}</div>
      <div className="truncate text-right font-mono text-[10.5px]">{v}</div>
    </div>
  );
}

/* GHL steps: {id, name, type, attributes, next, parentKey, order}
   GHL triggers: {id, name, type, conditions, active, ...} */
export type GhlStep = Record<string, unknown>;

export default function StepDetailPanel({
  step,
  loading,
  onClose,
}: {
  step: GhlStep | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!loading && !step) return null;

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

  const copyAll = () => {
    if (!step) return;
    navigator.clipboard?.writeText(JSON.stringify(step, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 26 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 26 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="absolute bottom-3 right-3 top-3 z-[3] flex w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-card border border-line bg-panel shadow-[0_12px_34px_var(--shade)] backdrop-blur-[14px]"
    >
      {/* header */}
      <div className="flex items-center gap-[11px] border-b border-line2 px-4 pb-3 pt-3.5">
        <div
          className="flex size-[38px] flex-none items-center justify-center rounded-[11px] border border-white/25 font-mono text-[12px] font-bold text-white shadow-[0_4px_12px_var(--shade)]"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklab, ${col} 78%, #ffffff), ${col})`,
          }}
        >
          {loading ? "…" : appGlyph("ghl")}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <div className="truncate text-[14.5px] font-semibold">
            {loading ? "Loading…" : String(step?.name || stepType)}
          </div>
          <div className="truncate text-[10.5px] text-t3">
            {step ? `GHL · ${isTrigger ? "trigger" : stepType}` : ""}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-control border border-line text-t3 transition-colors hover:border-t1 hover:text-t1"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 animate-spin rounded-full border-2 border-t1 border-t-transparent" />
          </div>
        ) : step ? (
          <>
            <Section title="Step identity">
              <div className="flex flex-col">
                <KvRow k="ID" v={<span className="break-all">{String(step.id)}</span>} />
                <KvRow k="Type" v={<span className="break-all">{stepType}</span>} />
                {"order" in step && <KvRow k="Order" v={String(step.order)} />}
                {"active" in step && (
                  <KvRow k="Active" v={String(step.active)} />
                )}
              </div>
            </Section>

            {webhookUrl && (
              <Section title="Webhook target">
                <div className="break-all rounded-code border border-line2 bg-code px-3.5 py-3 font-mono text-[11px] leading-[1.6] text-t1">
                  <span
                    className="mr-2 inline-flex rounded-full border px-[7px] py-[1px] text-[9.5px] font-semibold"
                    style={{
                      color: "#f59e0b",
                      background: "rgba(245,158,11,.1)",
                      borderColor: "rgba(245,158,11,.32)",
                    }}
                  >
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
              <Section
                title="Attributes"
                action={
                  <button
                    onClick={copyAll}
                    className="flex cursor-pointer items-center gap-1 text-[10px] text-t3 transition-colors hover:text-t1"
                  >
                    {copied ? "copied" : "copy"}
                    {copied ? (
                      <Check className="size-2.5" />
                    ) : (
                      <Copy className="size-2.5" />
                    )}
                  </button>
                }
              >
                <JsonBlock data={attributes} />
              </Section>
            )}
          </>
        ) : null}
      </div>
    </motion.aside>
  );
}
