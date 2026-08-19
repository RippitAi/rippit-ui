"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { getConnector as getConnectorDescriptor } from "@/lib/connectors";
import type { ProviderId } from "@/lib/connectors/types";
import { mintPairingCode, PairingCode } from "@/app/lib/api";
import { useAuth } from "@/components/app/AuthProvider";
import { Button } from "@/components/ui/button";
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

function PairingCard() {
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pairing) return;
    const tick = () => {
      const ms = new Date(pairing.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pairing]);

  const expired = pairing != null && remaining <= 0;

  const generate = async () => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      setPairing(await mintPairingCode());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t generate a code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-panel px-4 py-4">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound aria-hidden="true" className="size-3.5 text-t3" />
        <h3 className="text-[12.5px] font-semibold">Extension pairing</h3>
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-t2">
        To connect a HighLevel location, generate a code and paste it into the
        Rippit Chrome extension. Codes are single-use and expire after 10
        minutes.
      </p>

      {pairing && !expired && (
        <div className="mb-3 flex items-center gap-3">
          <code className="rounded-control border border-line-strong bg-code px-3 py-2 font-mono text-[16px] font-bold tracking-[0.25em]">
            {pairing.code}
          </code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(pairing.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label={copied ? "Copied" : "Copy pairing code"}
            className="flex size-[30px] cursor-pointer items-center justify-center rounded-control border border-line-strong text-t3 transition-colors hover:border-t1 hover:text-t1"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-3.5 text-ok-text" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
          </button>
          <span role="status" className="tabular text-[11px] text-t3">
            expires in {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </span>
        </div>
      )}
      {expired && (
        <p role="status" className="mb-3 text-[11.5px] text-warn-text">
          That code expired — generate a new one.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-[11.5px] text-err-text">
          {error}
        </p>
      )}

      <Button
        onClick={generate}
        disabled={busy}
        variant="outline"
        className="h-auto cursor-pointer rounded-control border-line-strong bg-transparent px-3 py-[7px] text-[11.5px] font-semibold text-t2 hover:border-t1 hover:bg-transparent hover:text-t1 disabled:opacity-50"
      >
        {busy
          ? "Generating…"
          : pairing && !expired
            ? "Generate a new code"
            : "Generate code"}
      </Button>
    </div>
  );
}

function ProfileCard() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-panel px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <h3 className="text-[12.5px] font-semibold">Signed in</h3>
        <p className="truncate font-mono text-[11px] text-t3">{user?.email}</p>
      </div>
      <Button
        onClick={async () => {
          setBusy(true);
          await signOut();
        }}
        disabled={busy}
        variant="outline"
        className="h-auto cursor-pointer rounded-control border-line-strong bg-transparent px-3 py-[7px] text-[11.5px] font-semibold text-t2 hover:border-t1 hover:bg-transparent hover:text-t1 disabled:opacity-50"
      >
        <LogOut aria-hidden="true" className="size-3" />
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

export default function ConnectionsPage() {
  const { connections, syncing, sync, disconnect, add, refresh } =
    useConnections();
  const [watching, setWatching] = useState<ProviderId | null>(null);

  useEffect(() => {
    document.title = "Settings — Rippit";
  }, []);

  // Extension flows connect out-of-band; refresh periodically so a new
  // location appears without a manual reload — faster while an
  // extension-connect card is open.
  const extensionOpen =
    watching != null &&
    getConnectorDescriptor(watching).connect.type === "extension";
  useEffect(() => {
    const t = setInterval(refresh, extensionOpen ? 5000 : 15000);
    return () => clearInterval(t);
  }, [refresh, extensionOpen]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] flex-none items-center gap-3 border-b border-line px-4">
        <SidebarTrigger className="text-t3 hover:text-t1" />
        <div className="h-4 w-px bg-line" aria-hidden="true" />
        <h1 className="text-[13.5px] font-semibold tracking-[-0.01em]">
          Settings
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
              pollingProvider={extensionOpen ? watching : null}
              onExpandChange={setWatching}
            />
          </section>

          <section aria-labelledby="pairing-heading">
            <h2
              id="pairing-heading"
              className="mb-2 text-[11px] font-semibold text-t3"
            >
              Chrome extension
            </h2>
            <PairingCard />
          </section>

          <section aria-labelledby="profile-heading">
            <h2
              id="profile-heading"
              className="mb-2 text-[11px] font-semibold text-t3"
            >
              Account
            </h2>
            <ProfileCard />
          </section>
        </div>
      </div>
    </div>
  );
}
