"use client";

import { useEffect, useRef } from "react";
import type { ModuleDetail } from "../../lib/api";

function JsonBlock({ data }: { data: unknown }) {
  if (data == null) return <p className="text-xs text-muted italic">None</p>;
  return (
    <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
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
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (!loading && !module) return null;

  return (
    <div
      ref={panelRef}
      className="fixed top-0 right-0 h-full w-[420px] max-w-full bg-card border-l border-border z-50 shadow-xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="font-semibold text-sm truncate">
          {loading ? "Loading…" : module?.label || module?.module || "Module"}
        </h2>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : module ? (
          <>
            <Section title="Module Identity">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted text-xs">ID</span>
                  <p className="font-mono">{module.id}</p>
                </div>
                <div>
                  <span className="text-muted text-xs">App</span>
                  <p className="font-mono">{module.app}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-muted text-xs">Type</span>
                <p className="font-mono text-sm break-all">{module.module}</p>
              </div>
              {module.version != null && (
                <div className="mt-2">
                  <span className="text-muted text-xs">Version</span>
                  <p className="font-mono text-sm">{module.version}</p>
                </div>
              )}
            </Section>

            {module.filter && (
              <Section title="Filter">
                {typeof module.filter === "object" && "name" in module.filter && (
                  <p className="text-sm font-medium mb-2">{String(module.filter.name)}</p>
                )}
                <JsonBlock data={module.filter} />
              </Section>
            )}

            {module.mapper && (
              <Section title="Mapper / Configuration">
                <JsonBlock data={module.mapper} />
              </Section>
            )}

            {module.parameters && (
              <Section title="Parameters">
                <JsonBlock data={module.parameters} />
              </Section>
            )}

            {module.onerror && (
              <Section title="Error Handler">
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
    </div>
  );
}
