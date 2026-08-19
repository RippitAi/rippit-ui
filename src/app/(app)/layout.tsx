"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { useAuth } from "@/components/app/AuthProvider";
import { ConnectionsProvider } from "@/components/app/ConnectionsProvider";
import { PaletteProvider } from "@/components/palette/palette-context";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { LoadingState } from "@/components/shared/LoadingState";

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 248;
const SIDEBAR_W_KEY = "rippit_sidebar_width";

const clampWidth = (w: number) =>
  Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)));

/** Drag (or arrow-key) handle on the sidebar's edge. */
function SidebarResizeHandle({
  width,
  onWidth,
}: {
  width: number;
  onWidth: (w: number) => void;
}) {
  const { state, isMobile } = useSidebar();
  if (isMobile || state !== "expanded") return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = width;
        const move = (ev: PointerEvent) =>
          onWidth(clampWidth(startW + ev.clientX - startX));
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          document.body.style.removeProperty("cursor");
          document.body.style.removeProperty("user-select");
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onWidth(clampWidth(width - 16));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onWidth(clampWidth(width + 16));
        }
      }}
      className="fixed inset-y-0 z-20 hidden w-[5px] cursor-col-resize transition-colors hover:bg-[color-mix(in_srgb,var(--ringc)_16%,transparent)] active:bg-[color-mix(in_srgb,var(--ringc)_24%,transparent)] md:block"
      style={{ left: width - 2 }}
    />
  );
}

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
  // Persisted width: hydration-safe read via useSyncExternalStore, live
  // adjustments via the override state.
  const stored = useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(SIDEBAR_W_KEY),
    () => null
  );
  const [widthOverride, setWidthOverride] = useState<number | null>(null);
  const sidebarWidth =
    widthOverride ?? (stored ? clampWidth(Number(stored)) : SIDEBAR_DEFAULT);

  const handleWidth = useCallback((w: number) => {
    setWidthOverride(w);
    localStorage.setItem(SIDEBAR_W_KEY, String(w));
  }, []);

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
              "--sidebar-width": `${sidebarWidth}px`,
              "--sidebar-width-icon": "3rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          <SidebarResizeHandle width={sidebarWidth} onWidth={handleWidth} />
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
