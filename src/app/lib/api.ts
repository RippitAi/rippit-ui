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

/** Wait/sleep duration as the API computed it (null when not a wait). */
export interface WaitFor {
  seconds: number | null;
  text: string;
}

/** One runtime execution (Make) — status + timing + failing module, never payloads. */
export interface Execution {
  executionId: string;
  status: "success" | "warning" | "error" | "incomplete" | "unknown";
  startedAt: string | null;
  durationMs: number | null;
  operations: number | null;
  errorName: string | null;
  errorMessage: string | null;
  causeModuleId: string | null;
  meta: Record<string, unknown>;
}

export interface ExecutionsResponse {
  supported: boolean;
  reason?: string;
  executions: Execution[];
  fetchedAt: string | null;
  refreshing?: boolean;
}

export function fetchExecutions(
  provider: ProviderId,
  externalId: string,
  refresh = false
): Promise<ExecutionsResponse> {
  return apiFetch<ExecutionsResponse>(
    `/workflows/${provider}/${encodeURIComponent(externalId)}/executions${refresh ? "?refresh=true" : ""}`
  );
}

export interface LastRun {
  status: Execution["status"];
  at: string | null;
  executionId?: string;
}

/** Manual tag (per user). */
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  source?: "manual" | "auto";
  workflows?: number;
}

export function fetchTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/tags`);
}

export function createTag(name: string, color?: string | null): Promise<Tag> {
  return apiPost<Tag>(`/tags`, { name, color: color ?? null });
}

export function deleteTag(id: string): Promise<{ deleted: string }> {
  return apiFetch(`/tags/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function setWorkflowTags(
  provider: ProviderId,
  externalId: string,
  tagIds: string[]
): Promise<{ tags: Tag[] }> {
  return apiFetch(`/workflows/${provider}/${encodeURIComponent(externalId)}/tags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagIds }),
  });
}

/** Structural issue from the link map (see implemented/errors.md). */
export interface Issue {
  code: string;
  severity: "error" | "warn" | "info";
  provider: ProviderId;
  workflowExternalId: string | null;
  nodeId: string | null;
  message: string;
  data: Record<string, unknown>;
}

export interface IssueCounts {
  error: number;
  warn: number;
  info: number;
}

export interface ModuleInfo {
  id: NodeId;
  module: string;
  app: string;
  label: string;
  /** Humanized "what it does" (API-generated; names only, never ids/URLs). */
  summary?: string;
  /** Execution-order label ("1", "2.1.3", "4.A.2"); null for triggers/orphans. */
  ordinal?: string | null;
  waitFor?: WaitFor | null;
  /** Structural issues on this node (summary responses). */
  issues?: Issue[];
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
  /** Canvas enrichment merged in by the API (same as ModuleInfo). */
  summary?: string;
  ordinal?: string | null;
  waitFor?: WaitFor | null;
  kind?: string;
  assets?: AssetRef[];
}

export interface ScenarioSummary {
  name: string;
  totalModules: number;
  appsUsed: string[];
  modules: ModuleInfo[];
  connections: Connection[];
  /** Deep link into the platform's own editor (server-built, zone/team aware). */
  nativeUrl?: string | null;
  /** Structural issues for the whole workflow (node-level ones repeat on modules). */
  issues?: Issue[];
}

/** One asset / value a node references (from the reference index). */
export interface AssetRef {
  kind: string;
  value: string;
  label: string | null;
  url: string | null;
  dynamic: boolean;
  node_id?: string | null;
  provider?: ProviderId;
  meta?: Record<string, unknown>;
}

export interface RefUse {
  provider: ProviderId;
  connectionId: string;
  connectionLabel: string | null;
  workflowExternalId: string;
  workflowName: string | null;
  workflowStatus: string | null;
  isActive: boolean | null;
  nodeId: string | null;
  dynamic: boolean;
}

export interface RefUses {
  kind: string;
  value: string;
  label: string | null;
  url: string | null;
  workflows: number;
  uses: RefUse[];
}

export type SearchHitType = "workflow" | "node" | "asset" | "tag";

export interface SearchHit {
  type: SearchHitType;
  provider: ProviderId | null;
  connectionId: string | null;
  connectionLabel: string | null;
  workflowExternalId: string | null;
  workflowName: string | null;
  label: string | null;
  secondary?: string | null;
  nodeId?: string | null;
  kind?: string | null;
  app?: string | null;
  ordinal?: string | null;
  value?: string;
  url?: string | null;
  dynamic?: boolean;
  status?: string | null;
  isActive?: boolean | null;
  /** tag hits */
  tagId?: string;
  color?: string | null;
  workflows?: number;
}

/** Typed server search (workflows · nodes · assets) over the user's estate. */
export function searchEstate(q: string, limit = 20): Promise<{ query: string; results: SearchHit[] }> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  return apiFetch<{ query: string; results: SearchHit[] }>(`/search?${qs.toString()}`);
}

export function fetchRefUses(kind: string, value: string): Promise<RefUses> {
  const qs = new URLSearchParams({ kind, value });
  return apiFetch<RefUses>(`/refs/uses?${qs.toString()}`);
}

export function fetchWorkflowRefs(
  provider: ProviderId,
  externalId: string
): Promise<{ refs: AssetRef[] }> {
  return apiFetch<{ refs: AssetRef[] }>(
    `/workflows/${provider}/${encodeURIComponent(externalId)}/refs`
  );
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
  /** Platform folder/directory the workflow lives in, when the provider has them. */
  folder?: string | null;
  folder_id?: string | null;
  tags?: Tag[];
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
  issueCounts?: IssueCounts;
  tags?: Tag[];
  lastRun?: LastRun;
}

/** An asset referenced by more than one workflow ("both touch Sheet X"). */
export interface AssetLink {
  kind: string;
  value: string;
  label: string | null;
  url: string | null;
  workflows: { source: ProviderId; refId: string; nodes: string[] }[];
}

export interface LinkMap {
  workflows: WorkflowCard[];
  links: WorkflowLink[];
  unmatched: (LinkEnd & { udid: string })[];
  assetLinks?: AssetLink[];
  issues?: Issue[];
  stats: {
    workflows: number;
    links: number;
    deadLinks: number;
    sharedAssets?: number;
    issues?: number;
    issueErrors?: number;
  };
}

export function fetchLinks(): Promise<LinkMap> {
  return apiFetch(`/links`);
}

/** Node-level composed graph across workflows (GET /graph). Node ids are
 * "{provider}:{workflowId}:{nodeId}"; groups prefix their members. */
export interface GraphData {
  groups: { id: string; source: ProviderId; name: string; refId: string }[];
  nodes: ModuleInfo[];
  connections: Connection[];
  stats: { groups: number; crossLinks: number; deadLinks: number };
}

export function fetchGraph(keys: { source: ProviderId; refId: string }[] = []): Promise<GraphData> {
  const qs = keys.length
    ? `?workflows=${encodeURIComponent(keys.map((k) => `${k.source}:${k.refId}`).join(","))}`
    : "";
  return apiFetch<GraphData>(`/graph${qs}`);
}
