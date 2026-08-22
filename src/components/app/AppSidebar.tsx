"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  SunMoon,
  Workflow,
  Bell,
  Bookmark,
  ChevronRight,
  Clock3,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "./AuthProvider";
import { useConnections, useWorkflowIndex } from "./ConnectionsProvider";
import { useWorkspace } from "./WorkspaceProvider";
import { useEffect } from "react";
import { fetchNotifications, fetchViews, SavedView } from "@/app/lib/api";
import { ConnectorSection } from "./ConnectorSection";
import { UserAvatar } from "./UserAvatar";
import { usePalette } from "@/components/palette/palette-context";
import { useState } from "react";

const GROUP_LABEL =
  "h-7 px-2 text-[10px] font-semibold tracking-[0.02em] text-t3";
const ITEM =
  "h-8 gap-2.5 rounded-[7px] px-2 text-[12.5px] font-medium text-t2 data-[active=true]:font-semibold data-[active=true]:text-t1 hover:text-t1";

export function AppSidebar() {
  const pathname = usePathname();
  const { connections, loading, trees, treeStatus, syncing, sync } =
    useConnections();
  const palette = usePalette();
  const { user, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [filter, setFilter] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const index = useWorkflowIndex();

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (meta.full_name as string) || (meta.name as string) || user?.email || "";

  const q = filter.trim().toLowerCase();
  const matchCount = q
    ? index.filter((w) => w.name.toLowerCase().includes(q)).length
    : null;

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
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            {/* Always-visible search: filters the workflow tree as you type.
                ⌘K (or the kbd chip) opens the global palette. */}
            <div className="relative flex items-center">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 size-[13px] text-t3"
              />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a workflow…"
                aria-label="Filter workflows in the sidebar"
                className="h-8 w-full rounded-control border border-line bg-hover pl-8 pr-11 text-[12px] text-t1 transition-colors placeholder:text-t3 hover:border-line-strong focus:border-line-strong"
              />
              <button
                onClick={palette.open}
                aria-label="Open command palette (⌘K)"
                className="absolute right-1.5 cursor-pointer rounded-[4px] border border-line px-1 py-px font-mono text-[9px] text-t3 transition-colors hover:border-line-strong hover:text-t1"
              >
                ⌘K
              </button>
            </div>
            {matchCount !== null && (
              <p role="status" className="mt-1 px-1 text-[10px] text-t3">
                {matchCount === 0
                  ? "No workflows match"
                  : `${matchCount} workflow${matchCount > 1 ? "s" : ""} match`}
              </p>
            )}
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
                  <SidebarMenuButton asChild tooltip="Activity" className={ITEM} isActive={pathname === "/activity"}>
                    <Link href="/activity">
                      <Bell aria-hidden="true" className="!size-[15px]" />
                      <span>Activity</span>
                      <UnreadPill />
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
                      <span className="ml-auto rounded-full border border-line px-1.5 py-[1px] text-[9px] font-semibold text-t3">
                        preview
                      </span>
                      <span className="sr-only">(preview — sample data)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SavedViewsGroup />
          <RecentGroup />

          {/* Browse by platform folders — collapsed by default: the dashboard
              library (group by platform / folder / tag / owner / status /
              changed) is the primary way to look at the estate. Typing in the
              search box expands it and filters. */}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <button
              type="button"
              onClick={() => setBrowseOpen((o) => !o)}
              aria-expanded={browseOpen || !!filter}
              className={`${GROUP_LABEL} flex w-full items-center gap-1.5 rounded-[6px] hover:text-t1`}
            >
              <ChevronRight aria-hidden="true" className={`size-3 transition-transform ${browseOpen || filter ? "rotate-90" : ""}`} />
              Browse by platform
              <span className="ml-auto font-mono text-[9px]">{index.length}</span>
            </button>
          </SidebarGroup>
          {(browseOpen || !!filter) &&
            connections.map((conn) => (
              <ConnectorSection
                key={conn.id}
                connection={conn}
                groups={trees[conn.id] ?? []}
                status={treeStatus[conn.id] ?? "loading"}
                syncing={syncing === conn.id}
                filter={filter}
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

      <SidebarFooter className="border-t border-line2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  aria-label={`Account — ${user?.email ?? ""}`}
                  className="h-11 gap-2.5 rounded-[8px] px-2 hover:bg-hover data-[state=open]:bg-hover group-data-[collapsible=icon]:justify-center"
                >
                  <UserAvatar user={user} />
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-[12px] font-semibold">
                      {displayName}
                    </span>
                    <span className="truncate font-mono text-[9.5px] text-t3">
                      {user?.email}
                    </span>
                  </span>
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="size-3 flex-none text-t3 group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[218px] border-line bg-pill"
              >
                <WorkspaceSwitcherItems />
                <DropdownMenuItem asChild className="gap-2 text-[12px]">
                  <Link href="/settings/connections">
                    <Settings aria-hidden="true" className="size-3.5" />
                    Settings
                    <span
                      aria-hidden="true"
                      className={`ml-auto size-[6px] rounded-full ${
                        connections.length > 0 ? "bg-ok" : "bg-off"
                      }`}
                    />
                    <span className="sr-only">
                      {connections.length > 0
                        ? `— ${connections.length} platform${connections.length > 1 ? "s" : ""} connected`
                        : "— no platforms connected yet"}
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-[12px]"
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                >
                  <SunMoon aria-hidden="true" className="size-3.5" />
                  Toggle theme
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-line2" />
                <DropdownMenuItem
                  className="gap-2 text-[12px]"
                  onClick={signOut}
                >
                  <LogOut aria-hidden="true" className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/* Workspace switcher rows inside the account menu: current workspace with a
   check, other memberships to switch to, and a link to manage members. */
function WorkspaceSwitcherItems() {
  const { current, workspaces, switchTo } = useWorkspace();
  if (!current) return null;
  return (
    <>
      <DropdownMenuLabel className="px-2 pb-0.5 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-t3">
        Workspace
      </DropdownMenuLabel>
      {workspaces.map((w) => (
        <DropdownMenuItem
          key={w.id}
          className="gap-2 text-[12px]"
          onClick={() => w.id !== current.id && switchTo(w.id)}
          aria-current={w.id === current.id ? "true" : undefined}
        >
          <span
            aria-hidden="true"
            className={`size-[6px] rounded-full ${w.id === current.id ? "bg-ok" : "bg-off"}`}
          />
          <span className="truncate">{w.name}</span>
          <span className="ml-auto text-[9.5px] text-t3">{w.role}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator className="bg-line2" />
    </>
  );
}

/* Unread notifications count (polls every 60 s). */
function UnreadPill() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => fetchNotifications(true).then((d) => live && setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  if (!unread) return null;
  return (
    <span className="ml-auto rounded-full border px-1.5 py-[1px] text-[9px] font-semibold" style={{ color: "var(--warn-text)", borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)", background: "color-mix(in srgb, var(--warn) 10%, transparent)" }}>
      {unread}
      <span className="sr-only"> unread notifications</span>
    </span>
  );
}

/* Saved views shared in the workspace → dashboard / unified with ?view=. */
export function SavedViewsGroup() {
  const [views, setViews] = useState<SavedView[]>([]);
  useEffect(() => {
    let live = true;
    fetchViews().then((d) => live && setViews(d.views)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (views.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wide text-t3">Views</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {views.map((v) => (
            <SidebarMenuItem key={v.id}>
              <SidebarMenuButton asChild tooltip={v.name} className={ITEM}>
                <Link href={`/${v.kind === "unified" ? "unified" : "dashboard"}?view=${encodeURIComponent(v.id)}`}>
                  <Bookmark aria-hidden="true" className="!size-[15px]" />
                  <span className="truncate">{v.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/* Recently opened workflows (this browser), newest first. */
function RecentGroup() {
  const [recent, setRecent] = useState<{ provider: string; id: string; name: string; at: number }[]>([]);
  useEffect(() => {
    const load = () => {
      try {
        setRecent(JSON.parse(localStorage.getItem("rippit.recent") || "[]"));
      } catch {
        setRecent([]);
      }
    };
    load();
    window.addEventListener("rippit:recent", load);
    return () => window.removeEventListener("rippit:recent", load);
  }, []);
  if (recent.length === 0) return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className={GROUP_LABEL}>Recent</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {recent.slice(0, 6).map((r) => (
            <SidebarMenuItem key={`${r.provider}:${r.id}`}>
              <SidebarMenuButton asChild tooltip={r.name} className={ITEM}>
                <Link href={`/w/${r.provider}/${r.id}`}>
                  <Clock3 aria-hidden="true" className="!size-[13px] text-t3" />
                  <span className="truncate">{r.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
