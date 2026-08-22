"use client";

import { useSearchParams } from "next/navigation";
import { AtSign, MessageSquare } from "lucide-react";
import { useMentions } from "@/components/feed/useFeeds";
import { relativeTime } from "@/components/shared/RunsPanel";
import { ListRow, PanelEmpty, PanelSection, PanelSkeleton } from "./ListRow";

/* Mentions side panel: open threads that @mention you; click → thread on the right. */
export function MentionsPanel() {
  const { data } = useMentions();
  const sp = useSearchParams();
  const active = sp.get("c");
  if (!data) return <PanelSkeleton />;
  return (
    <div className="thin-scroll stagger min-h-0 flex-1 overflow-y-auto p-[7px]">
      <PanelSection title="Open threads" count={data.comments.length}>
        {data.comments.length === 0 && <PanelEmpty>No open threads mention you</PanelEmpty>}
        {data.comments.map((c) => (
          <ListRow
            key={c.id}
            href={`/mentions?c=${encodeURIComponent(c.id)}`}
            active={active === c.id}
            icon={c.parentId ? MessageSquare : AtSign}
            title={`${c.authorName ?? "Someone"}: ${c.body}`}
            sub={`${c.targetKey.replace(/^(wf|node|issue):/, "").replace(/:/g, " / ")} · ${relativeTime(c.createdAt)}`}
          />
        ))}
      </PanelSection>
    </div>
  );
}

export function useMentionsCount(): string {
  const { data } = useMentions();
  return data ? String(data.comments.length) : "…";
}
