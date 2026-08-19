"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { ConnectionsProvider } from "@/components/app/ConnectionsProvider";
import { PaletteProvider } from "@/components/palette/palette-context";
import { CommandPalette } from "@/components/palette/CommandPalette";

/*
 * No connection gate: the app is always enterable. Pages render their own
 * "connect a platform" empty states pointing at Settings → Connections.
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConnectionsProvider>
      <PaletteProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "15rem",
              "--sidebar-width-icon": "3rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          <SidebarInset
            id="main"
            tabIndex={-1}
            className="h-svh overflow-hidden bg-bg"
          >
            {children}
          </SidebarInset>
        </SidebarProvider>
        <CommandPalette />
      </PaletteProvider>
    </ConnectionsProvider>
  );
}
