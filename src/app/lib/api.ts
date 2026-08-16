import { MakeCredentials } from "./credentials";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  source?: "make" | "ghl";
  kind?: string;
  badge?: string;
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

export function fetchHierarchy(creds: MakeCredentials): Promise<Hierarchy> {
  return apiFetch(`/organizations/${creds.organizationId}/hierarchy`);
}

export function fetchScenarioDetail(
  creds: MakeCredentials,
  scenarioId: number
): Promise<ScenarioDetail> {
  return apiFetch(`/scenarios/${scenarioId}`);
}

export function fetchScenarioSummary(
  creds: MakeCredentials,
  scenarioId: number
): Promise<ScenarioSummary> {
  return apiFetch(`/scenarios/${scenarioId}/summary`);
}

export function fetchModuleDetail(
  scenarioId: number,
  moduleId: number
): Promise<ModuleDetail> {
  return apiFetch(`/scenarios/${scenarioId}/modules/${moduleId}`);
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
  source: "ghl";
  status: string | null;
}

export function fetchGhlConnections(): Promise<GhlConnection[]> {
  return apiFetch(`/ghl/connections`);
}

export function fetchGhlWorkflows(
  locationId?: string
): Promise<GhlWorkflowListItem[]> {
  const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  return apiFetch(`/ghl/workflows${q}`);
}

export function fetchGhlWorkflowSummary(
  workflowId: string
): Promise<GhlWorkflowSummary> {
  return apiFetch(`/ghl/workflows/${workflowId}/summary`);
}

export function fetchGhlStepDetail(
  workflowId: string,
  stepId: string
): Promise<Record<string, unknown>> {
  return apiFetch(`/ghl/workflows/${workflowId}/steps/${stepId}`);
}

export function triggerGhlSync(
  locationId: string
): Promise<{ synced: number; errors: unknown[] }> {
  return apiPost(`/ghl/locations/${encodeURIComponent(locationId)}/sync`);
}

/* ─── Unified graph ────────────────────────────────────────────────────── */

export interface UnifiedGroup {
  id: string; // "make:912" | "ghl:<wfId>" — prefixes its member node ids
  source: "make" | "ghl";
  name: string;
  refId: string;
}

export interface UnifiedGraph {
  groups: UnifiedGroup[];
  nodes: ModuleInfo[];
  connections: Connection[];
  stats: { groups: number; crossLinks: number; deadLinks: number };
}

export function fetchUnifiedGraph(
  organizationId: number | string,
  opts?: { scenarioIds?: number[]; workflowIds?: string[] }
): Promise<UnifiedGraph> {
  const params = new URLSearchParams();
  if (opts?.scenarioIds?.length)
    params.set("scenarioIds", opts.scenarioIds.join(","));
  if (opts?.workflowIds?.length)
    params.set("workflowIds", opts.workflowIds.join(","));
  const q = params.toString();
  return apiFetch(
    `/organizations/${organizationId}/unified-graph${q ? `?${q}` : ""}`
  );
}
