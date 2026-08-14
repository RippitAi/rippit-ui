"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { appColor } from "@/lib/apps";
import { useHierarchy } from "./hierarchy";

const GROUP_LABEL =
  "h-7 px-2 text-[10px] font-semibold tracking-[0.02em] text-t3";
const ITEM =
  "h-8 gap-2.5 rounded-[7px] px-2 text-[12.5px] font-medium text-t2 data-[active=true]:font-semibold data-[active=true]:text-t1 hover:text-t1";

export function AppSidebar() {
  const pathname = usePathname();
  const { hierarchy, loading, disconnect } = useHierarchy();

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
                <div className="flex size-[22px] flex-none rotate-45 items-center justify-center rounded-[6px] bg-t1">
                  <div className="size-1.5 rounded-full bg-bg" />
                </div>
                <span className="text-[14px] font-bold tracking-[-0.02em]">
                  rippit
                </span>
                <span className="ml-auto font-mono text-[9px] text-t3 group-data-[collapsible=icon]:hidden">
                  {hierarchy ? `org ${hierarchy.organizationId}` : ""}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
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
                    <LayoutDashboard className="!size-[15px]" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Monitor" className={ITEM}>
                  <Link href="/monitor">
                    <Activity className="!size-[15px]" />
                    <span>Monitor</span>
                    <span
                      className="ml-auto size-[6px] rounded-full bg-ok"
                      style={{
                        boxShadow: "0 0 6px #22c55e",
                        animation: "blinkdot 1.6s infinite",
                      }}
                    />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hierarchy?.teams.map((team) => {
          const scenarios = [
            ...team.folders.flatMap((f) => f.scenarios),
            ...team.unfolderedScenarios,
          ];
          return (
            <SidebarGroup
              key={team.id}
              className="group-data-[collapsible=icon]:hidden"
            >
              <SidebarGroupLabel className={GROUP_LABEL}>
                <span className="truncate">{team.name}</span>
                <span className="ml-auto font-mono text-[9px] text-t3">
                  {scenarios.length}
                </span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {scenarios.map((s) => {
                    const app = s.usedPackages[0] || "make";
                    const href = `/scenarios/${s.id}`;
                    const live = s.isActive && !s.isPaused;
                    return (
                      <SidebarMenuItem key={s.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === href}
                          className={`${ITEM} h-7 text-[12px] font-normal data-[active=true]:font-medium`}
                        >
                          <Link href={href} title={s.name}>
                            <span
                              className="size-[6px] flex-none rounded-full"
                              style={{
                                background: appColor(app),
                                boxShadow: `0 0 5px color-mix(in srgb, ${appColor(app)} 60%, transparent)`,
                              }}
                            />
                            <span className="truncate">{s.name}</span>
                          </Link>
                        </SidebarMenuButton>
                        {live && (
                          <SidebarMenuBadge>
                            <span
                              className="size-[5px] rounded-full bg-ok"
                              style={{ boxShadow: "0 0 5px #22c55e" }}
                            />
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {loading && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className={GROUP_LABEL}>
              Scenarios
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-col gap-2 px-2 py-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-6 animate-pulse rounded-row bg-hover"
                  />
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-line2 pt-2">
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span
            className="size-[7px] flex-none rounded-full bg-ok"
            style={{
              boxShadow: "0 0 8px #22c55e",
              animation: "blinkdot 1.6s infinite",
            }}
          />
          <span className="text-[11.5px] font-semibold group-data-[collapsible=icon]:hidden">
            Connected
          </span>
          <button
            onClick={disconnect}
            title="Disconnect"
            className="ml-auto flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-t3 transition-colors hover:bg-hover hover:text-t1 group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-3" />
          </button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
