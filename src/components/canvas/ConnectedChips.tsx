"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LinkMap } from "@/app/lib/api";
import { linksFor, workflowHref, WorkflowRef } from "@/lib/portals";
import { providerColor } from "@/lib/connectors";

/*
 * Always-visible row of connected workflows for the focused canvas view —
 * the same destinations as the on-canvas portal chips, but reachable even
 * when a portal is off-screen. Click → navigate.
 */
export function ConnectedChips({
  linkMap,
  self,
}: {
  linkMap: LinkMap | null;
  self: WorkflowRef;
}) {
  const router = useRouter();

  const targets = useMemo(() => {
    if (!linkMap) return [];
    const seen = new Map<
      string,
      { ref: WorkflowRef; name: string; dead: boolean; direction: "in" | "out" }
    >();
    for (const link of linksFor(linkMap, self)) {
      const outgoing =
        link.from.source === self.source && link.from.refId === self.refId;
      const other = outgoing ? link.to : link.from;
      const key = `${other.source}:${other.refId}`;
      const name =
        linkMap.workflows.find(
          (w) => w.source === other.source && w.refId === other.refId
        )?.name || key;
      const prev = seen.get(key);
      seen.set(key, {
        ref: { source: other.source, refId: other.refId },
        name,
        dead: prev?.dead || link.status === "dead",
        direction: outgoing ? "out" : "in",
      });
    }
    return [...seen.values()];
  }, [linkMap, self]);

  if (targets.length === 0) return null;

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold text-t3">
        Connected ({targets.length})
      </span>
      {targets.map((t) => {
        const accentText = t.dead ? "var(--err-text)" : "var(--warn-text)";
        const accentGraphic = t.dead ? "var(--err)" : "var(--warn)";
        return (
          <button
            key={`${t.ref.source}:${t.ref.refId}`}
            onClick={() => router.push(workflowHref(t.ref))}
            aria-label={`${t.direction === "out" ? "Calls" : "Called by"} ${t.name}${t.dead ? " (link broken)" : ""} — open workflow`}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-glass px-2.5 py-1 text-[10px] font-semibold backdrop-blur-[8px] transition-transform hover:-translate-y-px"
            style={{
              borderColor: `color-mix(in srgb, ${accentGraphic} 45%, transparent)`,
              color: accentText,
            }}
          >
            <span
              aria-hidden="true"
              className="size-[6px] rounded-[2px]"
              style={{ background: providerColor(t.ref.source) }}
            />
            <span className="max-w-[180px] truncate">{t.name}</span>
            {t.dead && <span>· broken</span>}
            <span aria-hidden="true">
              {t.direction === "out" ? "→" : "←"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
