"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, TriangleAlert } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { appColor } from "@/lib/apps";
import { getConnector } from "@/lib/connectors";
import type { NavGroup } from "@/lib/connectors/types";
import type { Connection } from "@/app/lib/connections-store";
import type { TreeStatus } from "./ConnectionsProvider";
import { workflowHref } from "@/lib/portals";

const GROUP_LABEL =
  "h-7 px-2 text-[10px] font-semibold tracking-[0.02em] text-t3";
const ITEM =
  "h-8 gap-2.5 rounded-[7px] px-2 text-[12.5px] font-medium text-t2 data-[active=true]:font-semibold data-[active=true]:text-t1 hover:text-t1";

/*
 * One connection's nav groups in the sidebar — generic across connectors.
 * A failed tree renders an inline error row instead of hiding the section.
 */
export function ConnectorSection({
  connection,
  groups,
  status,
  syncing,
  onSync,
}: {
  connection: Connection;
  groups: NavGroup[];
  status: TreeStatus;
  syncing: boolean;
  onSync: () => void;
}) {
  const pathname = usePathname();
  const connector = getConnector(connection.provider);
  const needsReauth = connection.status === "needs_reauth";
  const reauthHint =
    connector.connect.type === "extension"
      ? "Session expired — reconnect via the extension"
      : "Session expired — reconnect from Settings";

  const renderGroups: NavGroup[] =
    status === "ready" && groups.length > 0
      ? groups
      : [
          {
            id: `${connection.id}:placeholder`,
            label: `${connector.shortLabel} · ${
              connection.label || connection.externalId
            }`,
            items: [],
          },
        ];

  return (
    <>
      {renderGroups.map((group, gi) => (
        <SidebarGroup
          key={group.id}
          className="group-data-[collapsible=icon]:hidden"
        >
          <SidebarGroupLabel className={GROUP_LABEL}>
            <span className="truncate">{group.label}</span>
            {gi === 0 &&
              (needsReauth ? (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-semibold text-warn-text">
                  <TriangleAlert aria-hidden="true" className="size-2.5" />
                  reauth
                  <span className="sr-only">— {reauthHint}</span>
                </span>
              ) : (
                <button
                  onClick={onSync}
                  disabled={syncing}
                  aria-label={`Sync ${connector.label} ${
                    connection.label || connection.externalId
                  } now${
                    connection.lastSyncedAt
                      ? `, last synced ${new Date(
                          connection.lastSyncedAt
                        ).toLocaleString()}`
                      : ""
                  }`}
                  className="ml-auto flex cursor-pointer items-center gap-1 text-t3 transition-colors hover:text-t1 disabled:cursor-default"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`size-2.5 ${
                      syncing ? "animate-spin motion-reduce:animate-none" : ""
                    }`}
                  />
                  <span aria-hidden="true" className="font-mono text-[9px]">
                    {groups.reduce((n, g) => n + g.items.length, 0)}
                  </span>
                </button>
              ))}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const href = workflowHref({
                  source: connection.provider,
                  refId: item.refId,
                });
                return (
                  <SidebarMenuItem key={item.refId}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === href}
                      className={`${ITEM} h-7 text-[12px] font-normal data-[active=true]:font-medium`}
                    >
                      <Link href={href} title={item.name}>
                        <span
                          aria-hidden="true"
                          className="size-[6px] flex-none rounded-full"
                          style={{
                            background: appColor(item.app || connector.id),
                            boxShadow: `0 0 5px color-mix(in srgb, ${appColor(
                              item.app || connector.id
                            )} 60%, transparent)`,
                          }}
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.live && (
                      <SidebarMenuBadge>
                        <span
                          aria-hidden="true"
                          className="size-[5px] rounded-full bg-ok"
                          style={{ boxShadow: "0 0 5px var(--ok)" }}
                        />
                        <span className="sr-only">live</span>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
              {status === "loading" && (
                <div
                  role="status"
                  className="flex flex-col gap-2 px-2 py-1"
                  aria-label={`Loading ${connector.label} ${connector.nouns.workflowPlural}`}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className="h-6 animate-pulse rounded-row bg-hover motion-reduce:animate-none"
                    />
                  ))}
                </div>
              )}
              {status === "error" && (
                <div className="px-2 py-1 text-[11px] text-warn-text">
                  Couldn’t load {connector.nouns.workflowPlural}.{" "}
                  <button
                    onClick={onSync}
                    className="cursor-pointer underline underline-offset-2 hover:text-t1"
                  >
                    Retry
                  </button>
                </div>
              )}
              {status === "ready" && group.items.length === 0 && (
                <div className="px-2 py-1 text-[11px] italic text-t3">
                  {syncing
                    ? "Syncing…"
                    : `No ${connector.nouns.workflowPlural} synced yet`}
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
