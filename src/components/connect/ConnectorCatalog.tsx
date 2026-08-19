"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { allConnectors } from "@/lib/connectors";
import type { ConnectorDescriptor, ProviderId } from "@/lib/connectors/types";
import type { Connection } from "@/app/lib/connections-store";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ConnectorGlyph({
  connector,
  size = 38,
}: {
  connector: ConnectorDescriptor;
  size?: number;
}) {
  const col = connector.brandColor;
  return (
    <div
      aria-hidden="true"
      className="flex flex-none items-center justify-center rounded-[11px] border border-white/25 font-mono text-[12px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(180deg, color-mix(in oklab, ${col} 55%, #000), color-mix(in oklab, ${col} 42%, #000))`,
      }}
    >
      {connector.glyph}
    </div>
  );
}

/** Per-connector connect flow: a credentials form or extension hand-off. */
export function ConnectFlow({
  connector,
  onSubmit,
  waiting,
}: {
  connector: ConnectorDescriptor;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  /** Extension flows: parent is polling for the connection to appear. */
  waiting?: boolean;
}) {
  const formId = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (connector.connect.type === "extension") {
    return (
      <div className="flex flex-col gap-2.5 text-[12px] text-t2">
        <ol className="list-decimal space-y-1.5 pl-4">
          {connector.connect.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {waiting && (
          <p role="status" className="flex items-center gap-2 text-t3">
            <span
              aria-hidden="true"
              className="size-3 animate-spin rounded-full border-2 border-t2 border-t-transparent motion-reduce:animate-none"
            />
            Waiting for the extension to connect…
          </p>
        )}
      </div>
    );
  }

  if (connector.connect.type === "oauth") {
    return (
      <p className="text-[12px] italic text-t3">
        OAuth connection coming soon.
      </p>
    );
  }

  const { fields, helpText } = connector.connect;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => {
        const inputId = `${formId}-${field.name}`;
        const errorId = `${formId}-error`;
        return (
          <div key={field.name}>
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-[11px] font-semibold text-t3"
            >
              {field.label}
            </label>
            <Input
              id={inputId}
              type={field.secret ? "password" : "text"}
              required
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.name]: e.target.value }))
              }
              placeholder={field.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="h-9 rounded-control border-line-strong bg-hover text-[13px] tabular placeholder:text-t3"
            />
          </div>
        );
      })}
      {helpText && <p className="text-[11px] text-t3">{helpText}</p>}

      {error && (
        <motion.div
          role="alert"
          id={`${formId}-error`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-control border border-[color-mix(in_srgb,var(--err)_32%,transparent)] bg-[color-mix(in_srgb,var(--err)_10%,transparent)] px-3 py-2 text-[12px] text-err-text"
        >
          {error}
        </motion.div>
      )}

      <Button
        type="submit"
        disabled={busy}
        className="h-auto w-full cursor-pointer rounded-control py-2.5 text-[12.5px] font-semibold hover:opacity-85 disabled:opacity-50"
      >
        {busy ? "Connecting…" : "Connect"}
        {!busy && <ArrowRight aria-hidden="true" className="size-3.5" />}
      </Button>
    </form>
  );
}

/**
 * The connector card grid: every registered platform, its connection status,
 * and an expand-in-place connect flow. Used by the landing page and the
 * Connections settings page.
 */
export function ConnectorCatalog({
  connections,
  onAdd,
  pollingProvider,
  onExpandChange,
}: {
  connections: Connection[];
  onAdd: (
    provider: ProviderId,
    values: Record<string, string>
  ) => Promise<void>;
  /** Provider whose extension flow is being awaited (spinner state). */
  pollingProvider?: ProviderId | null;
  onExpandChange?: (provider: ProviderId | null) => void;
}) {
  const [expanded, setExpandedState] = useState<ProviderId | null>(null);
  const setExpanded = (p: ProviderId | null) => {
    setExpandedState(p);
    onExpandChange?.(p);
  };

  return (
    <div className="flex flex-col gap-3">
      {allConnectors().map((connector) => {
        const conns = connections.filter((c) => c.provider === connector.id);
        const isOpen = expanded === connector.id;
        const connected = conns.length > 0;
        const needsReauth = conns.some((c) => c.status === "needs_reauth");
        const panelId = `connect-${connector.id}`;
        return (
          <div
            key={connector.id}
            className="overflow-hidden rounded-card border border-line bg-panel backdrop-blur-[14px]"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : connector.id)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-hover"
            >
              <ConnectorGlyph connector={connector} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{connector.label}</p>
                <p className="truncate text-[11px] text-t3">
                  {connector.description}
                </p>
              </div>
              {connected ? (
                needsReauth ? (
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-warn-text">
                    Needs reauth
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ok-text">
                    <Check aria-hidden="true" className="size-3" />
                    Connected
                    {conns.length > 1 ? ` · ${conns.length}` : ""}
                  </span>
                )
              ) : (
                <span className="text-[10.5px] font-semibold text-t3">
                  Not connected
                </span>
              )}
              <ChevronDown
                aria-hidden="true"
                className={`size-3.5 text-t3 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <div className="border-t border-line2 px-4 py-4">
                    <ConnectFlow
                      connector={connector}
                      onSubmit={(values) => onAdd(connector.id, values)}
                      waiting={pollingProvider === connector.id}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* extensibility signal */}
      <div className="flex items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-3.5 text-t3">
        <div
          aria-hidden="true"
          className="flex size-[38px] flex-none items-center justify-center rounded-[11px] border border-line"
        >
          <Puzzle className="size-4" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-t2">
            More platforms coming
          </p>
          <p className="text-[11px]">
            Zapier, n8n, Close, and more — Rippit is built connector-first.
          </p>
        </div>
      </div>
    </div>
  );
}
