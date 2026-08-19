"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import {
  ConnectionsProvider,
  useConnections,
} from "@/components/app/ConnectionsProvider";
import { PaletteProvider } from "@/components/palette/palette-context";
import { CommandPalette } from "@/components/palette/CommandPalette";

/** Single auth gate: no connections → back to the connect screen. */
function ConnectionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { connections, loading, error } = useConnections();

  useEffect(() => {
    if (!loading && !error && connections.length === 0) {
      router.replace("/");
    }
  }, [loading, error, connections.length, router]);

  return <>{children}</>;
}

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConnectionsProvider>
      <PaletteProvider>
        <ConnectionGate>
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
        </ConnectionGate>
      </PaletteProvider>
    </ConnectionsProvider>
  );
}
