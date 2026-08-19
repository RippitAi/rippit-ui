"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchLinks, LinkMap } from "@/app/lib/api";
import {
  addConnection,
  Connection,
  deleteConnection,
  fetchConnections,
  syncConnection,
} from "@/app/lib/connections-store";
import { getConnector } from "@/lib/connectors";
import type { NavGroup, ProviderId } from "@/lib/connectors/types";

/*
 * One provider for everything connection-shaped: the connection list, each
 * connection's nav tree (fetched in parallel, filled incrementally so one
 * broken connector never blanks the others), and the shared cross-platform
 * link map (previously fetched separately by three pages).
 */

export type TreeStatus = "loading" | "ready" | "error";

interface ConnectionsCtx {
  connections: Connection[];
  loading: boolean;
  error: string;
  trees: Record<string, NavGroup[]>;
  treeStatus: Record<string, TreeStatus>;
  linkMap: LinkMap | null;
  syncing: string | null;
  refresh: () => void;
  sync: (conn: Connection) => Promise<void>;
  disconnect: (conn: Connection) => Promise<void>;
  add: (
    provider: ProviderId,
    values: Record<string, string>
  ) => Promise<Connection>;
}

const Ctx = createContext<ConnectionsCtx>({
  connections: [],
  loading: true,
  error: "",
  trees: {},
  treeStatus: {},
  linkMap: null,
  syncing: null,
  refresh: () => {},
  sync: async () => {},
  disconnect: async () => {},
  add: async () => {
    throw new Error("ConnectionsProvider missing");
  },
});

export function useConnections() {
  return useContext(Ctx);
}

/** Every workflow across every connection, flattened — search/palette source. */
export interface WorkflowIndexEntry {
  provider: ProviderId;
  refId: string;
  name: string;
  live?: boolean;
  status?: string | null;
  app?: string;
  groupPath: string[];
  connectionId: string;
}

export function useWorkflowIndex(): WorkflowIndexEntry[] {
  const { connections, trees } = useConnections();
  return useMemo(
    () =>
      connections.flatMap((conn) =>
        (trees[conn.id] ?? []).flatMap((g) =>
          [...g.items, ...(g.folders ?? []).flatMap((f) => f.items)].map(
            (item) => ({
              provider: conn.provider,
              refId: item.refId,
              name: item.name,
              live: item.live,
              status: item.status,
              app: item.app,
              groupPath: item.groupPath,
              connectionId: conn.id,
            })
          )
        )
      ),
    [connections, trees]
  );
}

export function ConnectionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trees, setTrees] = useState<Record<string, NavGroup[]>>({});
  const [treeStatus, setTreeStatus] = useState<Record<string, TreeStatus>>({});
  const [linkMap, setLinkMap] = useState<LinkMap | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => setGeneration((g) => g + 1), []);

  const loadTree = useCallback((conn: Connection) => {
    setTreeStatus((s) => ({ ...s, [conn.id]: "loading" }));
    getConnector(conn.provider)
      .fetchTree({ id: conn.id, externalId: conn.externalId, label: conn.label })
      .then((groups) => {
        setTrees((t) => ({ ...t, [conn.id]: groups }));
        setTreeStatus((s) => ({ ...s, [conn.id]: "ready" }));
      })
      .catch(() => {
        setTreeStatus((s) => ({ ...s, [conn.id]: "error" }));
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchConnections()
      .then((conns) => {
        if (cancelled) return;
        setConnections(conns);
        conns.forEach(loadTree);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    fetchLinks()
      .then((m) => !cancelled && setLinkMap(m))
      .catch(() => !cancelled && setLinkMap(null));

    return () => {
      cancelled = true;
    };
  }, [generation, loadTree]);

  const sync = useCallback(
    async (conn: Connection) => {
      setSyncing(conn.id);
      try {
        await syncConnection(conn);
        loadTree(conn);
        fetchLinks()
          .then(setLinkMap)
          .catch(() => {});
      } finally {
        setSyncing(null);
      }
    },
    [loadTree]
  );

  const disconnect = useCallback(
    async (conn: Connection) => {
      await deleteConnection(conn);
      refresh();
    },
    [refresh]
  );

  const add = useCallback(
    async (provider: ProviderId, values: Record<string, string>) => {
      const conn = await addConnection(provider, values);
      refresh();
      return conn;
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      connections,
      loading,
      error,
      trees,
      treeStatus,
      linkMap,
      syncing,
      refresh,
      sync,
      disconnect,
      add,
    }),
    [
      connections,
      loading,
      error,
      trees,
      treeStatus,
      linkMap,
      syncing,
      refresh,
      sync,
      disconnect,
      add,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
