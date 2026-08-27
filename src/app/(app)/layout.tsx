"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/AuthProvider";
import { ConnectionsProvider } from "@/components/app/ConnectionsProvider";
import { WorkspaceProvider, useWorkspace } from "@/components/app/WorkspaceProvider";
import { PaletteProvider } from "@/components/palette/palette-context";
import { TagsProvider } from "@/components/tags/tags-context";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { LoadingState } from "@/components/shared/LoadingState";
import { ShellProvider } from "@/components/shell/shell-context";
import { Shell } from "@/components/shell/Shell";

/*
 * Auth gate (UX only — enforcement lives in the API): signed out → /login.
 * Once signed in, the app is fully enterable; pages render their own
 * "connect a platform" empty states pointing at Settings → Connections.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
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
    <WorkspaceProvider key={user.id}>
      <WorkspaceScopedShell>{children}</WorkspaceScopedShell>
    </WorkspaceProvider>
  );
}

/* Everything that holds workspace-scoped data remounts when the active
   workspace changes (key on its id). */
function WorkspaceScopedShell({ children }: { children: React.ReactNode }) {
  const { current, loading, error } = useWorkspace();
  if (loading && !current) {
    return (
      <div className="h-svh bg-bg">
        <LoadingState message="Loading workspace…" />
      </div>
    );
  }
  if (!current && error) {
    return (
      <div className="flex h-svh items-center justify-center bg-bg p-4 text-[13px] text-t2">
        Could not load your workspace: {error}
      </div>
    );
  }

  return (
    <ConnectionsProvider key={current?.id ?? "none"}>
      <TagsProvider>
        <PaletteProvider>
          <ShellProvider>
            <Shell>{children}</Shell>
            <CommandPalette />
          </ShellProvider>
        </PaletteProvider>
      </TagsProvider>
    </ConnectionsProvider>
  );
}
