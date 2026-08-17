"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LinkMap } from "@/app/lib/api";
import { linksFor, workflowHref, WorkflowRef } from "@/lib/portals";
import { appColor } from "@/lib/apps";

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
        const accent = t.dead ? "#ef4444" : "#f59e0b";
        return (
          <button
            key={`${t.ref.source}:${t.ref.refId}`}
            onClick={() => router.push(workflowHref(t.ref))}
            title={`${t.direction === "out" ? "Calls" : "Called by"} ${t.name}`}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-glass px-2.5 py-1 text-[10px] font-semibold backdrop-blur-[8px] transition-transform hover:-translate-y-px"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              color: accent,
            }}
          >
            <span
              className="size-[6px] rounded-[2px]"
              style={{ background: appColor(t.ref.source) }}
            />
            <span className="max-w-[180px] truncate">{t.name}</span>
            <span>{t.direction === "out" ? "→" : "←"}</span>
          </button>
        );
      })}
    </div>
  );
}
