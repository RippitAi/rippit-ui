/*
 * Connector registry types — the single home of the provider union and the
 * descriptor shape every platform (Make, GHL, future: Zapier/n8n/Close…)
 * implements. UI code never branches on a provider id directly; it looks the
 * behavior up on the descriptor.
 */

import type { ComponentType } from "react";
import type { ModuleInfo, NodeId, ScenarioSummary } from "@/app/lib/api";

export type ProviderId = "make" | "ghl";

/** Platform vocabulary, so copy reads natively per connector. */
export interface ConnectorNouns {
  workflow: string;
  workflowPlural: string;
  step: string;
  stepPlural: string;
  container: string; // "organization" | "location" | …
}

export interface ConnectField {
  name: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

export type ConnectMethod =
  | { type: "form"; fields: ConnectField[]; helpText?: string }
  | { type: "extension"; instructions: string[] }
  | { type: "oauth" };

export interface StatusPillInfo {
  label: string;
  tone: "ok" | "warn" | "muted";
}

export interface WorkflowMeta {
  /** Small mono chip next to the title, e.g. Make's "#912". */
  idChip?: string;
  statusPill: StatusPillInfo;
  lastEdit?: string | null;
}

export interface WorkflowData {
  summary: ScenarioSummary;
  meta: WorkflowMeta;
}

export interface DetailPanelProps {
  data: unknown | null;
  loading: boolean;
  error?: boolean;
  onClose: () => void;
}

/** Minimal connection info descriptors need (avoids importing the store). */
export interface ConnectionRef {
  id: string; // backend uuid, or "legacy:{provider}:{externalId}"
  externalId: string;
  label: string | null;
}

export interface NavItem {
  refId: string;
  name: string;
  live?: boolean;
  status?: string | null;
  /** App identity for the row dot (Make: first used package). */
  app?: string;
  groupPath: string[];
}

export interface NavFolder {
  id: string;
  label: string;
  items: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  /** Items not inside any folder. */
  items: NavItem[];
  folders?: NavFolder[];
}

export interface ConnectorDescriptor {
  id: ProviderId;
  label: string; // "Make"
  shortLabel: string; // "Make" | "GHL"
  description: string; // one-liner for connector cards
  brandColor: string;
  glyph: string;
  nouns: ConnectorNouns;
  connect: ConnectMethod;

  /** Sidebar/palette tree for one connection of this provider. */
  fetchTree(conn: ConnectionRef): Promise<NavGroup[]>;

  /** Load everything the workflow page needs (canvas summary + header meta). */
  loadWorkflow(id: string): Promise<WorkflowData>;
  fetchNodeDetail(workflowId: string, nodeId: NodeId): Promise<unknown>;
  DetailPanel: ComponentType<DetailPanelProps>;
  headerStats(data: WorkflowData): { label: string; value: string }[];

  /**
   * Where an incoming cross-workflow link should anchor on this platform's
   * canvas (Make: the webhook trigger module; GHL: the first trigger node).
   */
  incomingAnchor(modules: ModuleInfo[], hookId?: number): NodeId | null;

  /** Deep link to the platform's own editor, when derivable. */
  nativeUrl?(refId: string): string | null;
}

/* Unified-graph grouped-layout contract (canvas `groups` prop). */
export interface UnifiedGroup {
  id: string; // "make:912" | "ghl:<wfId>" — prefixes its member node ids
  source: ProviderId;
  name: string;
  refId: string;
}
