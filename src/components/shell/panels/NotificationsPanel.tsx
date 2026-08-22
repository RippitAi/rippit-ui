"use client";

import { useSearchParams } from "next/navigation";
import { useNotifications } from "@/components/feed/useFeeds";
import { activityRow } from "@/components/feed/FeedList";
import { relativeTime } from "@/components/shared/RunsPanel";
import { ListRow, PanelEmpty, PanelSection, PanelSkeleton } from "./ListRow";

/* Notifications side panel: your inbox, unread first; click → detail on the right. */
export function NotificationsPanel() {
  const { data } = useNotifications();
  const sp = useSearchParams();
  const active = sp.get("n");
  if (!data) return <PanelSkeleton />;
  const unread = data.notifications.filter((n) => !n.readAt);
  const read = data.notifications.filter((n) => n.readAt);
  const row = (n: (typeof data.notifications)[number]) => {
    const r = activityRow(n.activity, !n.readAt);
    return <ListRow key={n.id} href={`/activity?n=${n.id}`} active={active === String(n.id)} icon={r.icon} tone={r.tone} unread={!n.readAt} title={r.text} sub={`${r.sub} · ${relativeTime(n.createdAt)}`} />;
  };
  return (
    <div className="thin-scroll stagger min-h-0 flex-1 overflow-y-auto p-[7px]">
      <PanelSection title="Unread" count={unread.length}>
        {unread.length === 0 && <PanelEmpty>All caught up</PanelEmpty>}
        {unread.map(row)}
      </PanelSection>
      <PanelSection title="Earlier" count={read.length}>
        {read.length === 0 && <PanelEmpty>Nothing yet</PanelEmpty>}
        {read.slice(0, 60).map(row)}
      </PanelSection>
    </div>
  );
}

export function useNotificationsCount(): string {
  const { data } = useNotifications();
  return data ? `${data.unread} unread` : "…";
}
