import type { ProviderId } from "@/lib/connectors/types";
import { supabase } from "@/lib/supabase";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/*
 * Auth-failure hook: installed by AuthProvider (signOut + redirect to /login).
 * Kept as a registered callback so this module stays React-free. Only 401s
 * carrying `WWW-Authenticate: Bearer` trigger it — the backend also returns
 * 401 for bad *connector* credentials (e.g. an invalid Make token on
 * POST /connections), and those must surface as normal form errors.
 */
let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(fn: (() => void) | null) {
  authFailureHandler = fn;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (
      res.status === 401 &&
      res.headers.get("WWW-Authenticate")?.includes("Bearer")
    ) {
      authFailureHandler?.();
    }
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

/** Reference to a stored connection. */
export interface ConnRef {
  id: string;
  externalId: string;
}

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

/* Deduped across the sidebar tree and the dashboard (same shell mount).
   Cleared on auth changes via clearApiCaches(). */
const hierarchyCache = new Map<string, Promise<Hierarchy>>();

export function clearApiCaches() {
  hierarchyCache.clear();
}

export function fetchHierarchy(
  conn: ConnRef,
  fresh = false
): Promise<Hierarchy> {
  if (fresh || !hierarchyCache.has(conn.id)) {
    const p = apiFetch<Hierarchy>(`/connections/${conn.id}/hierarchy`);
    p.catch(() => hierarchyCache.delete(conn.id));
    hierarchyCache.set(conn.id, p);
  }
  return hierarchyCache.get(conn.id)!;
}

export async function fetchScenarioDetail(
  scenarioId: number
): Promise<ScenarioDetail> {
  const raw = await apiFetch<{ scenario: ScenarioDetail }>(
    `/workflows/make/${scenarioId}/raw`
  );
  return raw.scenario;
}

export function fetchScenarioSummary(
  scenarioId: number
): Promise<ScenarioSummary> {
  return apiFetch(`/workflows/make/${scenarioId}/summary`);
}

export function fetchModuleDetail(
  scenarioId: number,
  moduleId: number
): Promise<ModuleDetail> {
  return apiFetch(`/workflows/make/${scenarioId}/nodes/${moduleId}`);
}

/* ─── GHL ──────────────────────────────────────────────────────────────── */

/** GHL summaries share the ScenarioSummary canvas contract. */
export interface GhlWorkflowSummary extends ScenarioSummary {
  source?: ProviderId;
  status?: string | null;
}

export function fetchGhlWorkflowSummary(
  workflowId: string
): Promise<GhlWorkflowSummary> {
  return apiFetch(`/workflows/ghl/${workflowId}/summary`);
}

export function fetchGhlStepDetail(
  workflowId: string,
  stepId: string
): Promise<Record<string, unknown>> {
  return apiFetch(`/workflows/ghl/${workflowId}/nodes/${stepId}`);
}

/* ─── Connections ──────────────────────────────────────────────────────── */

export interface BackendConnectionRow {
  id: string;
  provider: string;
  external_id: string;
  label: string | null;
  status: string;
  last_synced_at: string | null;
}

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

/* ─── Extension pairing ────────────────────────────────────────────────── */

export interface PairingCode {
  code: string;
  expires_at: string;
  ttl_seconds: number;
}

export function mintPairingCode(): Promise<PairingCode> {
  return apiPost(`/pairing-codes`);
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

export function fetchLinks(): Promise<LinkMap> {
  return apiFetch(`/links`);
}
