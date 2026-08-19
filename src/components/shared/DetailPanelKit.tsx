"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* Recursive syntax-colored JSON renderer (handoff JSON palette). */
export function JsonValue({ value, depth }: { value: unknown; depth: number }) {
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

export function JsonBlock({ data }: { data: unknown }) {
  if (data == null) return <p className="text-[11px] italic text-t3">None</p>;
  return (
    <div className="max-h-64 overflow-auto rounded-code border border-line2 bg-code px-3.5 py-3 font-mono text-[11px] leading-[1.75]">
      <JsonValue value={data} depth={0} />
    </div>
  );
}

export function Section({
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

export function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line2 px-0.5 py-[9px]">
      <div className="text-[11px] text-t3">{k}</div>
      <div className="truncate text-right font-mono text-[10.5px]">{v}</div>
    </div>
  );
}

/** Copy-as-JSON action for a Section header. */
export function CopyJsonButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      aria-label={copied ? "Copied to clipboard" : "Copy JSON to clipboard"}
      className="flex cursor-pointer items-center gap-1 text-[10px] text-t3 transition-colors hover:text-t1"
    >
      <span aria-hidden="true">{copied ? "copied" : "copy"}</span>
      {copied ? (
        <Check aria-hidden="true" className="size-2.5" />
      ) : (
        <Copy aria-hidden="true" className="size-2.5" />
      )}
    </button>
  );
}

/**
 * Floating detail-panel chrome shared by every node-detail view.
 *
 * Non-modal dialog: the canvas behind it stays interactive, so there is no
 * focus trap — but focus moves into the panel on open and returns to the
 * previously focused element (e.g. the canvas node) on close.
 */
export function DetailPanelShell({
  title,
  subtitle,
  glyph,
  color,
  loading,
  error,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  glyph: string;
  color: string;
  loading: boolean;
  error?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    return () => restoreRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <motion.aside
      role="dialog"
      aria-labelledby={titleId}
      aria-busy={loading}
      initial={{ opacity: 0, x: 26 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 26 }}
      transition={{ duration: 0.4, ease: EASE }}
      // Opaque on purpose — backdrop-filter over the 3D-transformed canvas
      // hits a Chrome compositing bug that can blank the panel's contents.
      className="absolute bottom-3 right-3 top-3 z-[3] flex w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-card border border-line bg-pill shadow-[0_12px_34px_var(--shade)]"
    >
      {/* header */}
      <div className="flex items-center gap-[11px] border-b border-line2 px-4 pb-3 pt-3.5">
        <div
          aria-hidden="true"
          className="flex size-[38px] flex-none items-center justify-center rounded-[11px] border border-white/25 font-mono text-[12px] font-bold text-white shadow-[0_4px_12px_var(--shade)]"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklab, ${color} 55%, #000), color-mix(in oklab, ${color} 42%, #000))`,
          }}
        >
          {glyph}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <h2 id={titleId} className="truncate text-[14.5px] font-semibold">
            {loading ? "Loading…" : error ? "Couldn’t load details" : title}
          </h2>
          <div className="truncate text-[10.5px] text-t3">{subtitle}</div>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close details"
          className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-control border border-line-strong text-t3 transition-colors hover:border-t1 hover:text-t1"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      {/* content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        {loading ? (
          <div role="status" className="flex items-center justify-center py-12">
            <div
              aria-hidden="true"
              className="size-6 animate-spin rounded-full border-2 border-t1 border-t-transparent motion-reduce:animate-none"
            />
            <span className="sr-only">Loading details</span>
          </div>
        ) : error ? (
          <p role="alert" className="py-8 text-center text-[12px] text-t2">
            The details for this step couldn’t be fetched. Close the panel and
            try again.
          </p>
        ) : (
          children
        )}
      </div>
    </motion.aside>
  );
}
