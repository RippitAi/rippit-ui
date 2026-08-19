/*
 * Connections store — the UI's single source of truth for "what platforms are
 * connected". Dual-mode:
 *
 *  - New backend: generic /connections CRUD (provider-agnostic rows).
 *  - Legacy fallback (until the connector backend ships): the Make org id
 *    lives in localStorage and GHL connections are mirrored from /ghl/*.
 *
 * The legacy "rippit_make_credentials" key from the original Make-only
 * onboarding is migrated automatically on first load.
 */

import type { ProviderId } from "@/lib/connectors/types";
import {
  apiFetch,
  apiPost,
  BackendConnectionRow,
  invalidateBackendProbe,
  probeBackendConnections,
} from "./api";

export interface Connection {
  id: string; // backend uuid, or "legacy:{provider}:{externalId}"
  provider: ProviderId;
  externalId: string; // Make org id | GHL location id
  label: string | null;
  status: "active" | "needs_reauth" | "error";
  lastSyncedAt: string | null;
}

const LEGACY_STORE_KEY = "rippit_connections";
const OLD_CREDS_KEY = "rippit_make_credentials";

interface LegacyStore {
  make?: { organizationId: string; label?: string };
}

/* ── legacy localStorage helpers ─────────────────────────────────────────── */

function readLegacyStore(): LegacyStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_STORE_KEY);
    const store: LegacyStore = raw ? JSON.parse(raw) : {};
    // one-time migration from the Make-only credentials blob
    if (!store.make) {
      const old = localStorage.getItem(OLD_CREDS_KEY);
      if (old) {
        const creds = JSON.parse(old) as { organizationId?: string | number };
        if (creds.organizationId != null) {
          store.make = { organizationId: String(creds.organizationId) };
          localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(store));
          localStorage.removeItem(OLD_CREDS_KEY);
        }
      }
    }
    return store;
  } catch {
    return {};
  }
}

function writeLegacyStore(store: LegacyStore) {
  localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(store));
}

/** Legacy Make org id, used by org-scoped fallback routes. */
export function getLegacyMakeOrgId(): string | null {
  return readLegacyStore().make?.organizationId ?? null;
}

function fromBackend(c: BackendConnectionRow): Connection {
  return {
    id: c.id,
    provider: c.provider as ProviderId,
    externalId: c.external_id,
    label: c.label,
    status: (c.status as Connection["status"]) || "active",
    lastSyncedAt: c.last_synced_at,
  };
}

/* ── public API ──────────────────────────────────────────────────────────── */

export async function fetchConnections(): Promise<Connection[]> {
  const backend = await probeBackendConnections();
  if (backend !== null) return backend.map(fromBackend);

  // legacy mode
  const out: Connection[] = [];
  const store = readLegacyStore();
  if (store.make) {
    out.push({
      id: `legacy:make:${store.make.organizationId}`,
      provider: "make",
      externalId: store.make.organizationId,
      label: store.make.label ?? null,
      status: "active",
      lastSyncedAt: null,
    });
  }
  try {
    const ghl = await apiFetch<
      {
        location_id: string;
        label: string | null;
        status: string;
        last_synced_at: string | null;
      }[]
    >(`/ghl/connections`);
    for (const c of ghl) {
      out.push({
        id: `legacy:ghl:${c.location_id}`,
        provider: "ghl",
        externalId: c.location_id,
        label: c.label,
        status: c.status === "needs_reauth" ? "needs_reauth" : "active",
        lastSyncedAt: c.last_synced_at,
      });
    }
  } catch {
    // GHL routes unavailable — Make-only deployment, not an error
  }
  return out;
}

export async function addConnection(
  provider: ProviderId,
  values: Record<string, string>
): Promise<Connection> {
  const backend = await probeBackendConnections();
  if (backend !== null) {
    // Connector backend: {provider, label?, credentials, config}.
    // Make: credentials {apiToken}, config {organizationId?} (org optional —
    // the backend derives it from the token's first org).
    const { label, apiToken, organizationId, ...rest } = values;
    const credentials: Record<string, string> = { ...rest };
    if (apiToken) credentials.apiToken = apiToken;
    const config: Record<string, string> = {};
    if (organizationId?.trim()) config.organizationId = organizationId.trim();
    const created = await apiPost<BackendConnectionRow>(`/connections`, {
      provider,
      label: label || undefined,
      credentials,
      config,
    });
    invalidateBackendProbe();
    return fromBackend(created);
  }

  // legacy mode: only Make can be added from the UI (GHL uses the extension)
  if (provider !== "make") {
    throw new Error(
      "This platform connects through the Rippit extension, not a form."
    );
  }
  const organizationId = values.organizationId?.trim();
  if (!organizationId) {
    throw new Error("Enter your organization ID.");
  }
  // validate before storing — same probe the old landing page used
  await apiFetch(`/organizations/${organizationId}/teams`);
  const store = readLegacyStore();
  store.make = { organizationId };
  writeLegacyStore(store);
  return {
    id: `legacy:make:${organizationId}`,
    provider: "make",
    externalId: organizationId,
    label: null,
    status: "active",
    lastSyncedAt: null,
  };
}

export async function deleteConnection(conn: Connection): Promise<void> {
  if (!conn.id.startsWith("legacy:")) {
    await apiFetch(`/connections/${conn.id}`, { method: "DELETE" });
    invalidateBackendProbe();
    return;
  }
  if (conn.provider === "make") {
    const store = readLegacyStore();
    delete store.make;
    writeLegacyStore(store);
    return;
  }
  await apiFetch(`/ghl/connections/${encodeURIComponent(conn.externalId)}`, {
    method: "DELETE",
  });
}

export async function syncConnection(
  conn: Connection
): Promise<{ synced?: number }> {
  if (!conn.id.startsWith("legacy:")) {
    return apiPost(`/connections/${conn.id}/sync`);
  }
  if (conn.provider === "ghl") {
    return apiPost(`/ghl/locations/${encodeURIComponent(conn.externalId)}/sync`);
  }
  return {}; // legacy Make is live-fetched; nothing to sync
}
