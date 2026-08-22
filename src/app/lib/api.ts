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

/* Active workspace (collaboration scope). Persisted so a reload keeps the
   same workspace; the API resolves the user's default when unset. */
const WORKSPACE_KEY = "rippit.workspace";

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WORKSPACE_KEY);
}

export function setActiveWorkspaceId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(WORKSPACE_KEY, id);
  else window.localStorage.removeItem(WORKSPACE_KEY);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  const workspaceId = getActiveWorkspaceId();
  if (workspaceId) headers.set("X-Rippit-Workspace", workspaceId);

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

/* ─── Change log ─────────────────────────────────────────────────────────── */

export type ChangeKind =
  | "node-added" | "node-removed" | "node-changed" | "node-reordered"
  | "edge-added" | "edge-removed" | "ref-added" | "ref-removed"
  | "renamed" | "status-changed";

export interface WorkflowChange {
  id: number;
  provider: ProviderId | null;
  connectionId: string;
  workflowExternalId: string;
  workflowName?: string | null;
  version: number;
  kind: ChangeKind;
  nodeId: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  authorHint: { name?: string | null; at?: string | null; source?: string } | null;
  detectedAt: string;
  unseen?: boolean;
}

export interface WorkflowChanges {
  changes: WorkflowChange[];
  versions: { version: number; syncedAt: string | null; authorHint: WorkflowChange["authorHint"]; acks?: { userId: string; name: string; ackedAt: string }[] }[];
  lastSeenAt: string | null;
  unseen: number;
}

export function fetchWorkflowChanges(provider: ProviderId, externalId: string, since?: string): Promise<WorkflowChanges> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<WorkflowChanges>(`/workflows/${provider}/${encodeURIComponent(externalId)}/changes${qs}`);
}

export function markWorkflowSeen(provider: ProviderId, externalId: string): Promise<{ seenAt: string }> {
  return apiPost(`/workflows/${provider}/${encodeURIComponent(externalId)}/seen`);
}

export function fetchRecentChanges(days = 7): Promise<{ since: string; changes: WorkflowChange[] }> {
  return apiFetch(`/changes?days=${days}`);
}

/* ─── Comments ───────────────────────────────────────────────────────────── */

export type CommentTargetType = "workflow" | "node" | "issue" | "asset" | "change";

export interface Comment {
  id: string;
  targetType: CommentTargetType;
  targetKey: string;
  parentId: string | null;
  authorId: string;
  authorName: string | null;
  body: string;
  mentions: string[];
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  editedAt: string | null;
}

export interface CommentCounts {
  [targetKey: string]: { total: number; open: number };
}

export function fetchComments(q: { target?: string; prefix?: string }): Promise<{ comments: Comment[]; counts: CommentCounts }> {
  const qs = new URLSearchParams();
  if (q.target) qs.set("target", q.target);
  if (q.prefix) qs.set("prefix", q.prefix);
  return apiFetch(`/comments?${qs.toString()}`);
}

export function createComment(input: { targetType: CommentTargetType; targetKey: string; body: string; parentId?: string | null }): Promise<Comment> {
  return apiPost<Comment>(`/comments`, input);
}

export function patchComment(id: string, patch: { body?: string; resolved?: boolean }): Promise<Comment> {
  return apiFetch<Comment>(`/comments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function deleteComment(id: string): Promise<{ deleted: string }> {
  return apiFetch(`/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ─── Owners / notes / watch / ack ───────────────────────────────────────── */

export interface WorkflowMeta {
  ownerUserId: string | null;
  ownerName: string | null;
  notes: string | null;
  updatedAt: string | null;
  watching?: boolean;
}

export function fetchWorkflowMeta(provider: ProviderId, externalId: string): Promise<WorkflowMeta> {
  return apiFetch(`/workflows/${provider}/${encodeURIComponent(externalId)}/meta`);
}

export function putWorkflowMeta(
  provider: ProviderId,
  externalId: string,
  patch: { ownerUserId?: string | null; notes?: string; clearOwner?: boolean }
): Promise<WorkflowMeta> {
  return apiFetch(`/workflows/${provider}/${encodeURIComponent(externalId)}/meta`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function setWatch(targetKey: string, watching: boolean): Promise<{ targetKey: string; watching: boolean }> {
  return apiFetch(`/watches`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetKey, watching }) });
}

export function ackVersion(provider: ProviderId, externalId: string, version: number): Promise<{ version: number }> {
  return apiPost(`/workflows/${provider}/${encodeURIComponent(externalId)}/versions/${version}/ack`);
}

/* ─── Activity / notifications ───────────────────────────────────────────── */

export interface ActivityItem {
  id: number;
  kind: string;
  targetKey: string | null;
  payload: Record<string, unknown>;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  readAt: string | null;
  createdAt: string;
  activity: ActivityItem;
}

export function fetchActivity(q: { since?: string; kinds?: string[]; target?: string; mine?: boolean; watched?: boolean; limit?: number } = {}): Promise<{ activity: ActivityItem[] }> {
  const qs = new URLSearchParams();
  if (q.since) qs.set("since", q.since);
  if (q.kinds?.length) qs.set("kinds", q.kinds.join(","));
  if (q.target) qs.set("target", q.target);
  if (q.mine) qs.set("mine", "true");
  if (q.watched) qs.set("watched", "true");
  if (q.limit) qs.set("limit", String(q.limit));
  return apiFetch(`/activity?${qs.toString()}`);
}

export function fetchNotifications(unread = false): Promise<{ unread: number; notifications: NotificationItem[] }> {
  return apiFetch(`/notifications${unread ? "?unread=true" : ""}`);
}

export function markNotificationsRead(ids?: number[]): Promise<{ unread: number }> {
  return apiPost(`/notifications/read`, ids ? { ids } : { all: true });
}

/* ─── Saved views ────────────────────────────────────────────────────────── */

export interface SavedView {
  id: string;
  name: string;
  kind: "dashboard" | "unified";
  filters: Record<string, unknown>;
  created_by: string | null;
  shared: boolean;
}

export function fetchViews(): Promise<{ views: SavedView[] }> {
  return apiFetch(`/views`);
}

export function createView(input: { name: string; kind: SavedView["kind"]; filters: Record<string, unknown>; shared?: boolean }): Promise<SavedView> {
  return apiPost<SavedView>(`/views`, input);
}

export function deleteView(id: string): Promise<{ deleted: string }> {
  return apiFetch(`/views/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ─── Workspaces ─────────────────────────────────────────────────────────── */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "member";
  created_by?: string | null;
  joined_at?: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
  email: string | null;
  joined_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: "owner" | "member";
  invited_at?: string;
}

export function fetchWorkspaces(): Promise<{ current: string; workspaces: Workspace[] }> {
  return apiFetch(`/workspaces`);
}

export function createWorkspace(name: string): Promise<Workspace> {
  return apiPost<Workspace>(`/workspaces`, { name });
}

export function renameWorkspace(id: string, name: string): Promise<Workspace> {
  return apiFetch(`/workspaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function fetchMembers(id: string): Promise<{ members: WorkspaceMember[]; invites: WorkspaceInvite[] }> {
  return apiFetch(`/workspaces/${encodeURIComponent(id)}/members`);
}

export function inviteMember(id: string, email: string, role: "owner" | "member" = "member"): Promise<WorkspaceInvite> {
  return apiPost<WorkspaceInvite>(`/workspaces/${encodeURIComponent(id)}/invites`, { email, role });
}

export function revokeInvite(id: string, inviteId: string): Promise<{ deleted: string }> {
  return apiFetch(`/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE" });
}

export function removeMember(id: string, userId: string): Promise<{ removed: string }> {
  return apiFetch(`/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function updateMe(displayName: string): Promise<WorkspaceMember> {
  return apiFetch(`/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
}

/** Manual tag (per workspace). */
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
  /** Client-side: changed since the viewer last looked (amber ring). */
  changed?: boolean;
  /** Client-side: open comment threads on this node (count bubble). */
  commentCount?: number;
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
  /** True when the connection path exposes no step content (GHL OAuth list-only). */
  stepsUnavailable?: boolean;
  reason?: string;
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
  auth_type?: string;
}

/** GET /connectors — provider catalog incl. alternative connect paths. */
export interface ConnectorCatalogEntry {
  provider: ProviderId;
  displayName: string;
  connectMethod: string;
  connectFields: { name: string; label: string; secret?: boolean }[];
  oauthAvailable?: boolean;
  authTypes?: string[];
}

export function fetchConnectorCatalog(): Promise<ConnectorCatalogEntry[]> {
  return apiFetch<ConnectorCatalogEntry[]>(`/connectors`);
}

/** Begin an OAuth connect: the API returns the provider's authorize URL
 * carrying a signed state; the browser is sent there. */
export function startOAuth(provider: ProviderId): Promise<{ url: string; expiresIn: number }> {
  return apiFetch(`/oauth/${provider}/start`);
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
  /** Changes newer than this viewer's last visit (last 30 days). */
  changedSince?: { count: number; at: string | null };
  ownerUserId?: string;
  watching?: boolean;
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
