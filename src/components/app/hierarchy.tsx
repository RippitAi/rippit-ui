"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { loadCredentials, clearCredentials } from "@/app/lib/credentials";
import { fetchHierarchy, Hierarchy, Scenario } from "@/app/lib/api";

/*
 * Fetches the org hierarchy once per shell mount and shares it between
 * the sidebar and every page inside the (app) group.
 */

interface HierarchyCtx {
  hierarchy: Hierarchy | null;
  loading: boolean;
  error: string;
  disconnect: () => void;
}

const Ctx = createContext<HierarchyCtx>({
  hierarchy: null,
  loading: true,
  error: "",
  disconnect: () => {},
});

export function useHierarchy() {
  return useContext(Ctx);
}

/** Every scenario in the org, flattened with its team/folder context. */
export function useAllScenarios(): {
  scenario: Scenario;
  team: string;
  folder: string | null;
}[] {
  const { hierarchy } = useHierarchy();
  return useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.teams.flatMap((t) => [
      ...t.folders.flatMap((f) =>
        f.scenarios.map((s) => ({
          scenario: s,
          team: t.name,
          folder: f.name as string | null,
        }))
      ),
      ...t.unfolderedScenarios.map((s) => ({
        scenario: s,
        team: t.name,
        folder: null,
      })),
    ]);
  }, [hierarchy]);
}

export function HierarchyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hierarchy, setHierarchy] = useState<Hierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const creds = loadCredentials();
    if (!creds) {
      router.push("/");
      return;
    }
    fetchHierarchy(creds)
      .then(setHierarchy)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const value = useMemo(
    () => ({
      hierarchy,
      loading,
      error,
      disconnect: () => {
        clearCredentials();
        router.push("/");
      },
    }),
    [hierarchy, loading, error, router]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
