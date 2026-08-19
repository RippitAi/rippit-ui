"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectorCatalog } from "@/components/connect/ConnectorCatalog";
import {
  addConnection,
  Connection,
  fetchConnections,
} from "@/app/lib/connections-store";
import { getConnector } from "@/lib/connectors";
import type { ProviderId } from "@/lib/connectors/types";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ConnectPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [watching, setWatching] = useState<ProviderId | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    fetchConnections()
      .then(setConnections)
      .catch(() => setConnections([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(refresh, [refresh]);

  // While an extension flow is open, poll so the connection appears live.
  useEffect(() => {
    if (watching && getConnector(watching).connect.type === "extension") {
      pollRef.current = setInterval(refresh, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [watching, refresh]);

  const handleAdd = useCallback(
    async (provider: ProviderId, values: Record<string, string>) => {
      await addConnection(provider, values);
      refresh();
    },
    [refresh]
  );

  const connected = connections.length > 0;

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex min-h-dvh items-start justify-center overflow-y-auto bg-vpbg p-4 py-10"
      style={{
        backgroundImage: "radial-gradient(var(--dot) 1.2px, transparent 1.6px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* soft vignette so the grid recedes behind the cards */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, var(--vpbg) 85%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            aria-hidden="true"
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 45, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="mb-5 flex size-10 items-center justify-center rounded-[11px] bg-t1"
          >
            <div className="size-3 rounded-full bg-bg" />
          </motion.div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px]">rippit</h1>
          <p className="mt-1.5 text-[13px] text-t2">
            Connect your platforms — Rippit maps the workflows across your
            automation stack.
          </p>
        </div>

        {loaded ? (
          <ConnectorCatalog
            connections={connections}
            onAdd={handleAdd}
            pollingProvider={watching}
            onExpandChange={setWatching}
          />
        ) : (
          <div role="status" className="flex justify-center py-10">
            <span
              aria-hidden="true"
              className="size-6 animate-spin rounded-full border-2 border-t1 border-t-transparent motion-reduce:animate-none"
            />
            <span className="sr-only">Checking connections…</span>
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={() => router.push("/dashboard")}
            disabled={!connected}
            className="h-auto w-full cursor-pointer rounded-control py-2.5 text-[12.5px] font-semibold hover:opacity-85 disabled:opacity-50"
          >
            {connected ? "Enter Rippit" : "Connect a platform to continue"}
            {connected && (
              <ArrowRight aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-t3">
          rippit · workflow monitor
        </p>
      </motion.div>
    </main>
  );
}
