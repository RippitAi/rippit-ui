"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Cable,
  LayoutDashboard,
  Search,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useConnections } from "./ConnectionsProvider";
import { ConnectorSection } from "./ConnectorSection";
import { ThemeToggle } from "./ThemeToggle";
import { usePalette } from "@/components/palette/palette-context";

const GROUP_LABEL =
  "h-7 px-2 text-[10px] font-semibold tracking-[0.02em] text-t3";
const ITEM =
  "h-8 gap-2.5 rounded-[7px] px-2 text-[12.5px] font-medium text-t2 data-[active=true]:font-semibold data-[active=true]:text-t1 hover:text-t1";

export function AppSidebar() {
  const pathname = usePathname();
  const { connections, loading, trees, treeStatus, syncing, sync } =
    useConnections();
  const palette = usePalette();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-line2 px-2 py-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              asChild
              className="h-9 hover:bg-hover"
            >
              <Link href="/dashboard">
                <div
                  aria-hidden="true"
                  className="flex size-[22px] flex-none rotate-45 items-center justify-center rounded-[6px] bg-t1"
                >
                  <div className="size-1.5 rounded-full bg-bg" />
                </div>
                <span className="text-[14px] font-bold tracking-[-0.02em]">
                  rippit
                </span>
                <span className="ml-auto font-mono text-[9px] text-t3 group-data-[collapsible=icon]:hidden">
                  {connections.length > 0
                    ? `${connections.length} connected`
                    : ""}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={palette.open}
              className={`${ITEM} border border-line-strong bg-hover`}
              tooltip="Search (⌘K)"
            >
              <Search className="!size-[13px]" aria-hidden="true" />
              <span className="text-t3">Search…</span>
              <kbd
                aria-hidden="true"
                className="ml-auto rounded-[4px] border border-line px-1 font-mono text-[9px] text-t3 group-data-[collapsible=icon]:hidden"
              >
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Rippit navigation">
          <SidebarGroup>
            <SidebarGroupLabel className={GROUP_LABEL}>
              Platform
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/dashboard"}
                    tooltip="Dashboard"
                    className={ITEM}
                  >
                    <Link href="/dashboard">
                      <LayoutDashboard
                        aria-hidden="true"
                        className="!size-[15px]"
                      />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/unified"}
                    tooltip="Workflow map"
                    className={ITEM}
                  >
                    <Link href="/unified">
                      <Workflow aria-hidden="true" className="!size-[15px]" />
                      <span>Workflow map</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Monitor"
                    className={ITEM}
                  >
                    <Link href="/monitor">
                      <Activity aria-hidden="true" className="!size-[15px]" />
                      <span>Monitor</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto size-[6px] rounded-full bg-ok"
                        style={{
                          boxShadow: "0 0 6px var(--ok)",
                          animation: "blinkdot 1.6s infinite",
                        }}
                      />
                      <span className="sr-only">(live)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/settings/connections"}
                    tooltip="Connections"
                    className={ITEM}
                  >
                    <Link href="/settings/connections">
                      <Cable aria-hidden="true" className="!size-[15px]" />
                      <span>Connections</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {connections.map((conn) => (
            <ConnectorSection
              key={conn.id}
              connection={conn}
              groups={trees[conn.id] ?? []}
              status={treeStatus[conn.id] ?? "loading"}
              syncing={syncing === conn.id}
              onSync={() => sync(conn)}
            />
          ))}

          {loading && (
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel className={GROUP_LABEL}>
                Workflows
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div
                  role="status"
                  aria-label="Loading connections"
                  className="flex flex-col gap-2 px-2 py-1"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className="h-6 animate-pulse rounded-row bg-hover motion-reduce:animate-none"
                    />
                  ))}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-line2 pt-2">
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span
            aria-hidden="true"
            className="size-[7px] flex-none rounded-full bg-ok"
            style={{
              boxShadow: "0 0 8px var(--ok)",
              animation: "blinkdot 1.6s infinite",
            }}
          />
          <span className="text-[11.5px] font-semibold group-data-[collapsible=icon]:hidden">
            Connected
          </span>
          <div className="ml-auto group-data-[collapsible=icon]:hidden">
            <ThemeToggle className="!size-6 !border-transparent hover:!bg-hover" />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
