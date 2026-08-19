import type { ProviderId } from "@/lib/connectors/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(body.detail || `API error ${res.status}`, res.status);
  }
  // Tolerate empty bodies (e.g. 204 from DELETE)
  return res.json().catch(() => undefined as T);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/* ── backend-mode probe ───────────────────────────────────────────────────
   The connector backend serves generic /connections; the legacy backend
   404s there and keeps the old org-scoped Make + /ghl/* routes. Probed once
   per session; every dual-mode fetcher below keys off it. */

export interface BackendConnectionRow {
  id: string;
  provider: string;
  external_id: string;
  label: string | null;
  status: string;
  last_synced_at: string | null;
}

let backendProbe: Promise<BackendConnectionRow[] | null> | null = null;

export function probeBackendConnections(): Promise<
  BackendConnectionRow[] | null
> {
  if (!backendProbe) {
    backendProbe = apiFetch<BackendConnectionRow[]>(`/connections`).catch(
      (err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        backendProbe = null; // network error: don't cache, retry next call
        throw err;
      }
    );
  }
  return backendProbe;
}

export function invalidateBackendProbe() {
  backendProbe = null;
}

export async function isLegacyBackend(): Promise<boolean> {
  return (await probeBackendConnections()) === null;
}

/** Reference to a stored connection ("legacy:" ids come from the shim). */
export interface ConnRef {
  id: string;
  externalId: string;
}

const isLegacyConn = (conn: ConnRef) => conn.id.startsWith("legacy:");

/* Node/edge ids: Make modules use numbers, GHL steps use UUID strings, and
   the unified graph namespaces both ("make:912:5", "ghl:<wf>:<step>"). */
export type NodeId = string | number;

export interface Scenario {
  id: number;
  name: string;
  isActive: boolean;
  isPaused: boolean;
  lastEdit: string | null;
  nextExec: string | null;
  usedPackages: string[];
  folderId: number | null;
}

export interface Folder {
  id: number;
  name: string;
  scenarios: Scenario[];
}

export interface Team {
  id: number;
  name: string;
  folders: Folder[];
  unfolderedScenarios: Scenario[];
}

export interface Hierarchy {
  organizationId: number;
  teams: Team[];
}

export interface ModuleInfo {
  id: NodeId;
  module: string;
  app: string;
  label: string;
  depth: number;
  x: number | null;
  y: number | null;
  hasFilter: boolean;
  filterName: string | null;
  hasErrorHandler: boolean;
  source?: ProviderId;
  kind?: string;
  badge?: string;
  hookId?: number | null;
}

export interface Connection {
  from: NodeId;
  to: NodeId;
  label?: string;
  kind?: string;
  status?: "ok" | "dead" | "unmatched";
}

export interface ModuleDetail {
  id: number;
  module: string;
  app: string;
  label: string;
  mapper: Record<string, unknown> | null;
  filter: Record<string, unknown> | null;
  onerror: unknown[] | null;
  parameters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  version: number | null;
  flags: Record<string, unknown> | null;
}

export interface ScenarioSummary {
  name: string;
  totalModules: number;
  appsUsed: string[];
  modules: ModuleInfo[];
  connections: Connection[];
}

export interface ScenarioDetail {
  id: number;
  name: string;
  teamId: number;
  folderId: number | null;
  isActive: boolean;
  isPaused: boolean;
  islinked: boolean;
  scheduling: Record<string, unknown>;
  lastEdit: string | null;
  nextExec: string | null;
  usedPackages: string[];
  created: string;
}

/* Deduped across the sidebar tree and the dashboard (same shell mount). */
const hierarchyCache = new Map<string, Promise<Hierarchy>>();

export function fetchHierarchy(
  conn: ConnRef,
  fresh = false
): Promise<Hierarchy> {
  if (fresh || !hierarchyCache.has(conn.id)) {
    const p = isLegacyConn(conn)
      ? apiFetch<Hierarchy>(`/organizations/${conn.externalId}/hierarchy`)
      : apiFetch<Hierarchy>(`/connections/${conn.id}/hierarchy`);
    p.catch(() => hierarchyCache.delete(conn.id));
    hierarchyCache.set(conn.id, p);
  }
  return hierarchyCache.get(conn.id)!;
}

export async function fetchScenarioDetail(
  scenarioId: number
): Promise<ScenarioDetail> {
  if (await isLegacyBackend()) {
    return apiFetch(`/scenarios/${scenarioId}`);
  }
  const raw = await apiFetch<{ scenario: ScenarioDetail }>(
    `/workflows/make/${scenarioId}/raw`
  );
  return raw.scenario;
}

export async function fetchScenarioSummary(
  scenarioId: number
): Promise<ScenarioSummary> {
  return (await isLegacyBackend())
    ? apiFetch(`/scenarios/${scenarioId}/summary`)
    : apiFetch(`/workflows/make/${scenarioId}/summary`);
}

export async function fetchModuleDetail(
  scenarioId: number,
  moduleId: number
): Promise<ModuleDetail> {
  return (await isLegacyBackend())
    ? apiFetch(`/scenarios/${scenarioId}/modules/${moduleId}`)
    : apiFetch(`/workflows/make/${scenarioId}/nodes/${moduleId}`);
}

/* ─── GHL ──────────────────────────────────────────────────────────────── */

export interface GhlConnection {
  location_id: string;
  company_id: string | null;
  label: string | null;
  status: "active" | "needs_reauth";
  connected_at: string;
  last_synced_at: string | null;
}

export interface GhlWorkflowListItem {
  id: string;
  location_id: string;
  name: string;
  status: string | null;
  synced_at: string;
}

/** GHL summaries share the ScenarioSummary canvas contract. */
export interface GhlWorkflowSummary extends ScenarioSummary {
  source?: ProviderId;
  status?: string | null;
}

/* Legacy-backend-only routes (the connector backend removed them). */
export function fetchGhlConnections(): Promise<GhlConnection[]> {
  return apiFetch(`/ghl/connections`);
}

export function fetchGhlWorkflows(
  locationId?: string
): Promise<GhlWorkflowListItem[]> {
  const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  return apiFetch(`/ghl/workflows${q}`);
}

export async function fetchGhlWorkflowSummary(
  workflowId: string
): Promise<GhlWorkflowSummary> {
  return (await isLegacyBackend())
    ? apiFetch(`/ghl/workflows/${workflowId}/summary`)
    : apiFetch(`/workflows/ghl/${workflowId}/summary`);
}

export async function fetchGhlStepDetail(
  workflowId: string,
  stepId: string
): Promise<Record<string, unknown>> {
  return (await isLegacyBackend())
    ? apiFetch(`/ghl/workflows/${workflowId}/steps/${stepId}`)
    : apiFetch(`/workflows/ghl/${workflowId}/nodes/${stepId}`);
}

export function triggerGhlSync(
  locationId: string
): Promise<{ synced: number; errors: unknown[] }> {
  return apiPost(`/ghl/locations/${encodeURIComponent(locationId)}/sync`);
}

/* Connector-backend workflow list for one connection. */
export interface ConnectionWorkflowRow {
  connection_id: string;
  provider: ProviderId;
  external_id: string;
  name: string;
  status: string | null;
  is_active: boolean | null;
  synced_at: string;
}

export function fetchConnectionWorkflows(
  connectionId: string
): Promise<ConnectionWorkflowRow[]> {
  return apiFetch(`/connections/${connectionId}/workflows`);
}

/* ─── Workflow-level link map ──────────────────────────────────────────── */

export interface LinkEnd {
  source: ProviderId;
  refId: string;
  stepId?: string;
  stepName?: string;
  hookId?: number;
  udid?: string;
}

export interface WorkflowLink {
  from: LinkEnd;
  to: LinkEnd;
  kind: "webhook-call" | "subflow";
  status: "ok" | "dead";
}

export interface WorkflowCard {
  source: ProviderId;
  refId: string;
  name: string;
  status?: string | null;
  stepCount?: number;
  isActive?: boolean;
  talksToGhl?: boolean;
}

export interface LinkMap {
  workflows: WorkflowCard[];
  links: WorkflowLink[];
  unmatched: (LinkEnd & { udid: string })[];
  stats: { workflows: number; links: number; deadLinks: number };
}

/**
 * Cross-platform link map. The connector backend serves an unkeyed `/links`;
 * the legacy backend only has the Make-org-scoped route.
 */
export async function fetchLinks(): Promise<LinkMap> {
  if (!(await isLegacyBackend())) {
    return apiFetch<LinkMap>(`/links`);
  }
  const { getLegacyMakeOrgId } = await import("./connections-store");
  const orgId = getLegacyMakeOrgId();
  if (!orgId) throw new ApiError("No Make connection", 404);
  return apiFetch(`/organizations/${orgId}/links`);
}
