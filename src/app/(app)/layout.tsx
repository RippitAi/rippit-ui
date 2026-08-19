"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { useAuth } from "@/components/app/AuthProvider";
import { ConnectionsProvider } from "@/components/app/ConnectionsProvider";
import { PaletteProvider } from "@/components/palette/palette-context";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { LoadingState } from "@/components/shared/LoadingState";

/*
 * Auth gate (UX only — enforcement lives in the API): signed out → /login.
 * Once signed in, the app is fully enterable; pages render their own
 * "connect a platform" empty states pointing at Settings → Connections.
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="h-svh bg-bg">
        <LoadingState message="Signing you in…" />
      </div>
    );
  }
  if (!session || !user) return null;

  return (
    <ConnectionsProvider key={user.id}>
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
