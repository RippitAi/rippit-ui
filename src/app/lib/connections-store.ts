/*
 * Connections store — thin adapter over the connector backend's /connections
 * API. Every request carries the user's Bearer token (see api.ts), so the
 * rows returned are the signed-in user's own connections.
 */

import type { ProviderId } from "@/lib/connectors/types";
import { apiFetch, apiPost, BackendConnectionRow } from "./api";

export interface Connection {
  id: string; // backend uuid
  provider: ProviderId;
  externalId: string; // Make org id | GHL location id
  label: string | null;
  /** Provider account name (Make org / GHL location name) — resolved at sync. */
  accountName: string | null;
  /** label ?? accountName ?? externalId. Always safe to render. */
  displayName: string;
  status: "active" | "needs_reauth" | "error";
  lastSyncedAt: string | null;
  /** "extension" | "oauth" | "api_token" — how this connection authenticates. */
  authType?: string;
  /** Last attempt, and how it went. `lastSyncedAt` only moves on success, so
   *  a connection failing every sync shows an attempt but no fresh sync. */
  lastSyncAttemptAt?: string | null;
  lastSyncOutcome?: "ok" | "partial" | "failed" | null;
  connectedBy?: { userId: string | null; name: string | null; unclaimed: boolean };
}

function fromBackend(c: BackendConnectionRow): Connection {
  return {
    id: c.id,
    provider: c.provider as ProviderId,
    externalId: c.external_id,
    label: c.label,
    accountName: c.account_name ?? null,
    displayName: c.display_name || c.label || c.account_name || c.external_id,
    status: (c.status as Connection["status"]) || "active",
    lastSyncedAt: c.last_synced_at,
    authType: c.auth_type,
    lastSyncAttemptAt: c.last_sync_attempt_at ?? null,
    lastSyncOutcome: c.last_sync_outcome ?? null,
    connectedBy: c.connectedBy,
  };
}

export async function fetchConnections(): Promise<Connection[]> {
  const rows = await apiFetch<BackendConnectionRow[]>(`/connections`);
  return rows.map(fromBackend);
}

export async function addConnection(
  provider: ProviderId,
  values: Record<string, string>
): Promise<Connection> {
  // {provider, label?, credentials, config}. Make: credentials {apiToken},
  // config {organizationId?} (org optional — derived from the token's first org).
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
  return fromBackend(created);
}

export async function deleteConnection(conn: Connection): Promise<void> {
  await apiFetch(`/connections/${conn.id}`, { method: "DELETE" });
}

export function syncConnection(
  conn: Connection
): Promise<{ synced?: number }> {
  return apiPost(`/connections/${conn.id}/sync`);
}
