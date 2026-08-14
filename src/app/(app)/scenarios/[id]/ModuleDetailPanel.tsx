"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";
import type { ModuleDetail } from "@/app/lib/api";
import { appColor, appGlyph, appName } from "@/lib/apps";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Recursive syntax-colored JSON renderer (handoff JSON palette). */
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
  if (data == null)
    return <p className="text-[11px] italic text-t3">None</p>;
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

export default function ModuleDetailPanel({
  module,
  loading,
  onClose,
}: {
  module: ModuleDetail | null;
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

  if (!loading && !module) return null;

  const col = module ? appColor(module.app || module.module) : "#64748b";

  const copyAll = () => {
    if (!module) return;
    navigator.clipboard?.writeText(JSON.stringify(module, null, 2));
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
          {module ? appGlyph(module.app || module.module) : "…"}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <div className="truncate text-[14.5px] font-semibold">
            {loading ? "Loading…" : module?.label || module?.module}
          </div>
          <div className="truncate text-[10.5px] text-t3">
            {module ? appName(module.app) : ""}
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
        ) : module ? (
          <>
            <Section title="Module identity">
              <div className="flex flex-col">
                <KvRow k="ID" v={module.id} />
                <KvRow k="App" v={module.app} />
                <KvRow
                  k="Type"
                  v={<span className="break-all">{module.module}</span>}
                />
                {module.version != null && (
                  <KvRow k="Version" v={module.version} />
                )}
              </div>
            </Section>

            {module.filter && (
              <Section title="Filter">
                {typeof module.filter === "object" &&
                  "name" in module.filter && (
                    <div
                      className="mb-2 inline-flex rounded-full border px-[9px] py-[3px] text-[10px] font-semibold"
                      style={{
                        color: "#f59e0b",
                        background: "rgba(245,158,11,.1)",
                        borderColor: "rgba(245,158,11,.32)",
                      }}
                    >
                      {String(module.filter.name)}
                    </div>
                  )}
                <JsonBlock data={module.filter} />
              </Section>
            )}

            {module.mapper && (
              <Section
                title="Mapper · configuration"
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
                <JsonBlock data={module.mapper} />
              </Section>
            )}

            {module.parameters && (
              <Section title="Parameters">
                <JsonBlock data={module.parameters} />
              </Section>
            )}

            {module.onerror && (
              <Section title="Error handler">
                <JsonBlock data={module.onerror} />
              </Section>
            )}

            {module.flags && (
              <Section title="Flags">
                <JsonBlock data={module.flags} />
              </Section>
            )}
          </>
        ) : null}
      </div>
    </motion.aside>
  );
}
