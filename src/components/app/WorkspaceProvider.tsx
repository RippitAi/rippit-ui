"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearApiCaches,
  fetchWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  Workspace,
} from "@/app/lib/api";

/*
 * The active workspace — the collaboration scope every API call is made
 * in (X-Rippit-Workspace). Loaded once per signed-in user; switching
 * persists the choice, clears caches and remounts the data providers
 * (layout keys on `current.id`).
 */

interface WorkspaceCtx {
  current: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string;
  switchTo: (id: string) => void;
  refresh: () => void;
}

const Ctx = createContext<WorkspaceCtx>({
  current: null,
  workspaces: [],
  loading: true,
  error: "",
  switchTo: () => {},
  refresh: () => {},
});

export function useWorkspace() {
  return useContext(Ctx);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  // Result keyed by load generation → "loading" is derived, never set
  // synchronously inside the effect.
  const [result, setResult] = useState<{ gen: number; current?: string; workspaces?: Workspace[]; error?: string } | null>(null);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    let live = true;
    fetchWorkspaces()
      .then(({ current, workspaces: list }) => {
        if (!live) return;
        // The API resolved the active workspace (header if valid, else
        // default). Keep the stored id in step so a stale one heals.
        setActiveWorkspaceId(current);
        setResult({ gen, current, workspaces: list });
      })
      .catch((e: Error) => {
        if (!live) return;
        // A stale workspace id (left a workspace) → drop it and retry once.
        if (getActiveWorkspaceId()) {
          setActiveWorkspaceId(null);
          setGen((g) => g + 1);
          return;
        }
        setResult({ gen, error: e.message });
      });
    return () => {
      live = false;
    };
  }, [gen]);

  const switchTo = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    clearApiCaches();
    setGen((g) => g + 1);
  }, []);

  const refresh = useCallback(() => setGen((g) => g + 1), []);

  const value = useMemo<WorkspaceCtx>(() => {
    const fresh = result && result.gen === gen ? result : null;
    const workspaces = fresh?.workspaces ?? result?.workspaces ?? [];
    const currentId = fresh?.current ?? result?.current ?? null;
    return {
      current: workspaces.find((w) => w.id === currentId) ?? null,
      workspaces,
      loading: !fresh,
      error: fresh?.error ?? "",
      switchTo,
      refresh,
    };
  }, [result, gen, switchTo, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
