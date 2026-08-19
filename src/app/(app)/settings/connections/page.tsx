"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useConnections } from "@/components/app/ConnectionsProvider";
import {
  ConnectorCatalog,
  ConnectorGlyph,
} from "@/components/connect/ConnectorCatalog";
import { getConnector } from "@/lib/connectors";
import { StatusPill } from "@/components/shared/StatusPill";
import type { Connection } from "@/app/lib/connections-store";

function ConnectionRow({
  connection,
  syncing,
  onSync,
  onDisconnect,
}: {
  connection: Connection;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => Promise<void>;
}) {
  const connector = getConnector(connection.provider);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const name = connection.label || connection.externalId;

  return (
    <div className="flex items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-b-0">
      <ConnectorGlyph connector={connector} size={34} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold">
          <span className="truncate">{name}</span>
          <StatusPill
            pill={
              connection.status === "active"
                ? { label: "Active", tone: "ok" }
                : connection.status === "needs_reauth"
                  ? { label: "Needs reauth", tone: "warn" }
                  : { label: "Error", tone: "warn" }
            }
          />
        </p>
        <p className="truncate font-mono text-[10px] text-t3">
          {connector.label} · {connection.externalId}
          {connection.lastSyncedAt &&
            ` · synced ${new Date(connection.lastSyncedAt).toLocaleString()}`}
        </p>
        {connection.status === "needs_reauth" && (
          <p className="mt-1 text-[11px] text-warn-text">
            {connector.connect.type === "extension"
              ? "Session expired — reconnect from the Rippit extension."
              : "Session expired — reconnect below."}
          </p>
        )}
      </div>
      <button
        onClick={onSync}
        disabled={syncing}
        aria-label={`Sync ${connector.label} ${name} now`}
        className="flex size-[30px] cursor-pointer items-center justify-center rounded-control border border-line-strong text-t3 transition-colors hover:border-t1 hover:text-t1 disabled:cursor-default disabled:opacity-50"
      >
        <RefreshCw
          aria-hidden="true"
          className={`size-3.5 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`}
        />
      </button>
      {confirming ? (
        <span className="flex items-center gap-2 text-[11px]">
          <button
            onClick={async () => {
              setRemoving(true);
              try {
                await onDisconnect();
              } finally {
                setRemoving(false);
                setConfirming(false);
              }
            }}
            disabled={removing}
            className="cursor-pointer font-semibold text-err-text underline-offset-2 hover:underline disabled:opacity-50"
          >
            {removing ? "Removing…" : "Confirm"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="cursor-pointer text-t3 underline-offset-2 hover:underline"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Disconnect ${connector.label} ${name}`}
          className="flex size-[30px] cursor-pointer items-center justify-center rounded-control border border-line-strong text-t3 transition-colors hover:border-err hover:text-err-text"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  const { connections, syncing, sync, disconnect, add, refresh } =
    useConnections();

  useEffect(() => {
    document.title = "Connections — Rippit";
  }, []);

  // Extension flows connect out-of-band; refresh periodically so a new
  // location appears without a manual reload.
  useEffect(() => {
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] flex-none items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t3 hover:text-t1" />
        <div className="h-4 w-px bg-line" aria-hidden="true" />
        <h1 className="text-[13.5px] font-semibold tracking-[-0.01em]">
          Connections
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section aria-labelledby="connected-heading">
            <h2
              id="connected-heading"
              className="mb-2 text-[11px] font-semibold text-t3"
            >
              Connected platforms
            </h2>
            <div className="overflow-hidden rounded-card border border-line bg-panel">
              {connections.length === 0 && (
                <p className="px-4 py-6 text-center text-[12px] italic text-t3">
                  Nothing connected yet — add a platform below.
                </p>
              )}
              {connections.map((conn) => (
                <ConnectionRow
                  key={conn.id}
                  connection={conn}
                  syncing={syncing === conn.id}
                  onSync={() => sync(conn)}
                  onDisconnect={() => disconnect(conn)}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="add-heading">
            <h2
              id="add-heading"
              className="mb-2 text-[11px] font-semibold text-t3"
            >
              Add a platform
            </h2>
            <ConnectorCatalog
              connections={connections}
              onAdd={async (provider, values) => {
                await add(provider, values);
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
