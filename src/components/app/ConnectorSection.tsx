"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import { ChevronRight, Folder, RefreshCw, TriangleAlert } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { appColor } from "@/lib/apps";
import { getConnector } from "@/lib/connectors";
import type { NavFolder, NavGroup, NavItem } from "@/lib/connectors/types";
import type { Connection } from "@/app/lib/connections-store";
import type { TreeStatus } from "./ConnectionsProvider";
import { workflowHref } from "@/lib/portals";

const GROUP_LABEL =
  "h-7 px-2 text-[10px] font-semibold tracking-[0.02em] text-t3";
const ITEM =
  "h-7 gap-2 rounded-[7px] px-2 text-[12px] font-normal text-t2 data-[active=true]:font-medium data-[active=true]:text-t1 hover:text-t1";

const matches = (item: NavItem, filter: string) =>
  !filter || item.name.toLowerCase().includes(filter);

function ItemDot({ item, fallback }: { item: NavItem; fallback: string }) {
  const color = appColor(item.app || fallback);
  return (
    <span
      aria-hidden="true"
      className="size-[6px] flex-none rounded-full"
      style={{
        background: color,
        boxShadow: `0 0 5px color-mix(in srgb, ${color} 60%, transparent)`,
      }}
    />
  );
}

function LiveBadge() {
  return (
    <SidebarMenuBadge>
      <span
        aria-hidden="true"
        className="size-[5px] rounded-full bg-ok"
        style={{ boxShadow: "0 0 5px var(--ok)" }}
      />
      <span className="sr-only">live</span>
    </SidebarMenuBadge>
  );
}

function FolderNode({
  folder,
  provider,
  connectorId,
  filter,
  pathname,
}: {
  folder: NavFolder;
  provider: Connection["provider"];
  connectorId: string;
  filter: string;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const visible = folder.items.filter((i) => matches(i, filter));
  if (filter && visible.length === 0) return null;
  const isOpen = filter ? true : open; // filtering force-expands matches

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <Collapsible.Trigger asChild>
          <SidebarMenuButton
            className={`${ITEM} text-t2`}
            aria-label={`${folder.label} folder, ${folder.items.length} workflows`}
          >
            <ChevronRight
              aria-hidden="true"
              className={`!size-3 flex-none text-t3 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
            />
            <Folder aria-hidden="true" className="!size-3 flex-none text-t3" />
            <span className="truncate font-medium">{folder.label}</span>
            <span className="ml-auto font-mono text-[9px] text-t3">
              {filter ? `${visible.length}/${folder.items.length}` : folder.items.length}
            </span>
          </SidebarMenuButton>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarMenuSub className="mx-0 ml-3 border-l border-line2 px-1">
            {visible.map((item) => {
              const href = workflowHref({ source: provider, refId: item.refId });
              return (
                <SidebarMenuSubItem key={item.refId}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === href}
                    className={ITEM}
                  >
                    <Link href={href} title={item.name}>
                      <ItemDot item={item} fallback={connectorId} />
                      <span className="truncate">{item.name}</span>
                      {item.live && (
                        <span
                          aria-hidden="true"
                          className="ml-auto size-[5px] flex-none rounded-full bg-ok"
                          style={{ boxShadow: "0 0 5px var(--ok)" }}
                        />
                      )}
                      {item.live && <span className="sr-only">(live)</span>}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </Collapsible.Content>
      </SidebarMenuItem>
    </Collapsible.Root>
  );
}

/*
 * One connection's nav in the sidebar — folders collapsed by default,
 * force-expanded (and pruned) while a filter is active. A failed tree
 * renders an inline error row instead of hiding the section.
 */
export function ConnectorSection({
  connection,
  groups,
  status,
  syncing,
  filter,
  onSync,
}: {
  connection: Connection;
  groups: NavGroup[];
  status: TreeStatus;
  syncing: boolean;
  filter: string;
  onSync: () => void;
}) {
  const pathname = usePathname();
  const connector = getConnector(connection.provider);
  const needsReauth = connection.status === "needs_reauth";
  const q = filter.trim().toLowerCase();
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

  const totalCount = groups.reduce(
    (n, g) =>
      n + g.items.length + (g.folders ?? []).reduce((m, f) => m + f.items.length, 0),
    0
  );

  return (
    <>
      {renderGroups.map((group, gi) => {
        const looseVisible = group.items.filter((i) => matches(i, q));
        const folders = group.folders ?? [];
        const anyFolderVisible = folders.some((f) =>
          f.items.some((i) => matches(i, q))
        );
        if (q && looseVisible.length === 0 && !anyFolderVisible) return null;

        return (
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
                      {totalCount}
                    </span>
                  </button>
                ))}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {folders.map((folder) => (
                  <FolderNode
                    key={folder.id}
                    folder={folder}
                    provider={connection.provider}
                    connectorId={connector.id}
                    filter={q}
                    pathname={pathname}
                  />
                ))}
                {looseVisible.map((item) => {
                  const href = workflowHref({
                    source: connection.provider,
                    refId: item.refId,
                  });
                  return (
                    <SidebarMenuItem key={item.refId}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === href}
                        className={ITEM}
                      >
                        <Link href={href} title={item.name}>
                          <ItemDot item={item} fallback={connector.id} />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.live && <LiveBadge />}
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
                {status === "ready" &&
                  !q &&
                  group.items.length === 0 &&
                  folders.length === 0 && (
                    <div className="px-2 py-1 text-[11px] italic text-t3">
                      {syncing
                        ? "Syncing…"
                        : `No ${connector.nouns.workflowPlural} synced yet`}
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
