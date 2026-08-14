"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { HierarchyProvider } from "@/components/app/hierarchy";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HierarchyProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "15rem",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset className="h-svh overflow-hidden bg-bg">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </HierarchyProvider>
  );
}
