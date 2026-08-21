"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fetchRefUses, RefUses } from "@/app/lib/api";
import { providerColor, getConnector } from "@/lib/connectors";
import { kindLabel } from "@/components/shared/AssetsSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * Cross-automation tracing: every (workflow, node) across both platforms
 * that references the same normalized value. Rows deep-link to the canvas
 * node (/w/{provider}/{id}?node=…) and, when derivable, to the native asset.
 */
export function FindUsesDialog({
  target,
  onClose,
}: {
  target: { kind: string; value: string; label?: string | null } | null;
  onClose: () => void;
}) {
  // Result is keyed by the target so "loading" is derived, not set in the
  // effect (avoids cascading renders); stale responses are ignored.
  const [result, setResult] = useState<
    { key: string; data?: RefUses; error?: string } | null
  >(null);
  const key = target ? `${target.kind}:${target.value}` : null;

  useEffect(() => {
    if (!target || !key) return;
    let live = true;
    fetchRefUses(target.kind, target.value)
      .then((d) => live && setResult({ key, data: d }))
      .catch((e: Error) => live && setResult({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [target, key]);

  const current = result && result.key === key ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? "";
  const loading = !!target && !current;

  const grouped = new Map<string, NonNullable<RefUses["uses"]>>();
  for (const u of data?.uses ?? []) {
    const key = `${u.provider}:${u.workflowExternalId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), u]);
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px] border-line bg-panel text-t1">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            Uses of {target?.label || (target && kindLabel(target.kind))}
            {data?.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-[2px] text-[10px] font-semibold text-t2 hover:text-t1"
              >
                Open <ArrowUpRight aria-hidden="true" className="size-3" />
              </a>
            )}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-t3">
            {target && kindLabel(target.kind)}
            {data ? ` · ${data.workflows} workflow${data.workflows === 1 ? "" : "s"} · ${data.uses.length} node${data.uses.length === 1 ? "" : "s"}` : ""}
            {" · as of last sync"}
          </DialogDescription>
        </DialogHeader>
        {loading && <p className="text-[11px] text-t3">Searching…</p>}
        {error && (
          <p role="alert" className="text-[11px] text-err-text">
            {error}
          </p>
        )}
        {data && data.uses.length === 0 && (
          <p className="text-[11px] text-t3">No other references found.</p>
        )}
        {data && grouped.size > 0 && (
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-auto pr-1">
            {[...grouped.entries()].map(([key, uses]) => {
              const first = uses[0];
              const connector = getConnector(first.provider);
              return (
                <li key={key} className="rounded-card border border-line bg-pill p-2.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-[7px] rounded-[2px]"
                      style={{ background: providerColor(first.provider) }}
                    />
                    <Link
                      href={`/w/${first.provider}/${first.workflowExternalId}`}
                      className="truncate text-[12px] font-semibold hover:underline"
                    >
                      {first.workflowName || `${connector.shortLabel} ${first.workflowExternalId}`}
                    </Link>
                    <span className="text-[10px] text-t3">
                      {connector.shortLabel}
                      {first.isActive === false ? " · inactive" : ""}
                    </span>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {uses.map((u) => (
                      <li key={`${key}:${u.nodeId}`}>
                        <Link
                          href={`/w/${u.provider}/${u.workflowExternalId}${u.nodeId ? `?node=${encodeURIComponent(u.nodeId)}` : ""}`}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-[2px] font-mono text-[10px] text-t2 hover:border-t1 hover:text-t1"
                        >
                          {connector.nouns.step} {u.nodeId ?? "?"}
                          {u.dynamic && <span className="text-t3"> · mapped</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
