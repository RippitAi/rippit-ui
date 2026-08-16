"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, TriangleAlert } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { appColor } from "@/lib/apps";
import {
  fetchGhlConnections,
  fetchGhlWorkflows,
  triggerGhlSync,
  GhlConnection,
  GhlWorkflowListItem,
} from "@/app/lib/api";

const GROUP_LABEL =
  "h-7 px-2 text-[10px] font-semibold tracking-[0.02em] text-t3";
const ITEM =
  "h-8 gap-2.5 rounded-[7px] px-2 text-[12.5px] font-medium text-t2 data-[active=true]:font-semibold data-[active=true]:text-t1 hover:text-t1";

/*
 * GHL locations + synced workflows. Independent of the Make hierarchy —
 * renders whatever the API has, and stays silent when nothing is connected.
 */
export function GhlSection() {
  const pathname = usePathname();
  const [connections, setConnections] = useState<GhlConnection[]>([]);
  const [workflows, setWorkflows] = useState<GhlWorkflowListItem[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetchGhlConnections()
      .then(setConnections)
      .catch(() => setConnections([]));
    fetchGhlWorkflows()
      .then(setWorkflows)
      .catch(() => setWorkflows([]));
  }, []);

  useEffect(refresh, [refresh]);

  const syncNow = useCallback(
    (locationId: string) => {
      setSyncing(locationId);
      triggerGhlSync(locationId)
        .catch(() => {})
        .finally(() => {
          setSyncing(null);
          refresh();
        });
    },
    [refresh]
  );

  if (connections.length === 0) return null;

  const ghlColor = appColor("ghl");

  return (
    <>
      {connections.map((conn) => {
        const items = workflows.filter(
          (w) => w.location_id === conn.location_id
        );
        const needsReauth = conn.status === "needs_reauth";
        return (
          <SidebarGroup
            key={conn.location_id}
            className="group-data-[collapsible=icon]:hidden"
          >
            <SidebarGroupLabel className={GROUP_LABEL}>
              <span className="truncate">
                GHL · {conn.label || conn.location_id}
              </span>
              {needsReauth ? (
                <span
                  title="Refresh token expired — reconnect via the extension"
                  className="ml-auto flex items-center gap-1 text-[9px] font-semibold text-warn"
                >
                  <TriangleAlert className="size-2.5" />
                  reauth
                </span>
              ) : (
                <button
                  onClick={() => syncNow(conn.location_id)}
                  disabled={syncing === conn.location_id}
                  title={
                    conn.last_synced_at
                      ? `Sync now · last ${new Date(conn.last_synced_at).toLocaleString()}`
                      : "Sync now"
                  }
                  className="ml-auto flex cursor-pointer items-center gap-1 text-t3 transition-colors hover:text-t1 disabled:cursor-default"
                >
                  <RefreshCw
                    className={`size-2.5 ${syncing === conn.location_id ? "animate-spin" : ""}`}
                  />
                  <span className="font-mono text-[9px]">{items.length}</span>
                </button>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((w) => {
                  const href = `/workflows/ghl/${w.id}`;
                  return (
                    <SidebarMenuItem key={w.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === href}
                        className={`${ITEM} h-7 text-[12px] font-normal data-[active=true]:font-medium`}
                      >
                        <Link href={href} title={w.name}>
                          <span
                            className="size-[6px] flex-none rounded-full"
                            style={{
                              background: ghlColor,
                              boxShadow: `0 0 5px color-mix(in srgb, ${ghlColor} 60%, transparent)`,
                            }}
                          />
                          <span className="truncate">{w.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {items.length === 0 && (
                  <div className="px-2 py-1 text-[11px] italic text-t3">
                    {syncing === conn.location_id
                      ? "Syncing…"
                      : "No workflows synced yet"}
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}
