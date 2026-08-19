/*
 * Portal injection: given one workflow's canvas summary and the org's
 * workflow-level link map, append synthetic "portal" nodes for every
 * connected workflow. A portal renders as an orange chip on the canvas
 * (see ScenarioCanvas) and clicking it navigates to that workflow.
 *
 * Portal node ids are "portal:{source}:{refId}" — pages parse this prefix
 * in their node-click handler.
 */

import type {
  Connection,
  LinkMap,
  ModuleInfo,
  NodeId,
  WorkflowLink,
} from "@/app/lib/api";
import { getConnector, isProviderId } from "@/lib/connectors";
import type { ProviderId } from "@/lib/connectors/types";

export interface WorkflowRef {
  source: ProviderId;
  refId: string;
}

export function portalId(target: WorkflowRef): string {
  return `portal:${target.source}:${target.refId}`;
}

export function parsePortalId(id: NodeId): WorkflowRef | null {
  const s = String(id);
  if (!s.startsWith("portal:")) return null;
  const rest = s.slice("portal:".length);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  const source = rest.slice(0, sep);
  if (!isProviderId(source)) return null;
  return { source, refId: rest.slice(sep + 1) };
}

/** Parse a "{source}:{refId}" workflow-card id (unified map nodes). */
export function parseWorkflowId(id: NodeId): WorkflowRef | null {
  const s = String(id);
  const sep = s.indexOf(":");
  if (sep < 0) return null;
  const source = s.slice(0, sep);
  if (!isProviderId(source)) return null;
  return { source, refId: s.slice(sep + 1) };
}

export function workflowHref(ref: WorkflowRef): string {
  return `/w/${ref.source}/${ref.refId}`;
}

const same = (a: WorkflowRef, b: { source: string; refId: string }) =>
  a.source === b.source && a.refId === b.refId;

/** The links (in either direction) that touch one workflow. */
export function linksFor(linkMap: LinkMap, self: WorkflowRef): WorkflowLink[] {
  return linkMap.links.filter(
    (l) => same(self, l.from) || same(self, l.to)
  );
}

export function withPortals(
  summary: { modules: ModuleInfo[]; connections: Connection[] },
  linkMap: LinkMap | null,
  self: WorkflowRef
): { modules: ModuleInfo[]; connections: Connection[] } {
  if (!linkMap) return summary;
  const links = linksFor(linkMap, self);
  if (links.length === 0) return summary;

  const nameOf = (ref: { source: string; refId: string }) =>
    linkMap.workflows.find((w) => same(ref as WorkflowRef, w))?.name ||
    `${ref.source}:${ref.refId}`;

  const moduleIds = new Set(summary.modules.map((m) => m.id));
  const modules = [...summary.modules];
  const connections = [...summary.connections];
  const added = new Map<string, ModuleInfo>();

  const ensurePortal = (
    target: { source: string; refId: string },
    status: "ok" | "dead"
  ): NodeId => {
    const id = portalId(target as WorkflowRef);
    let node = added.get(id);
    if (!node) {
      node = {
        id,
        module: "portal",
        app: target.source,
        label: nameOf(target),
        depth: 0,
        x: null,
        y: null,
        hasFilter: false,
        filterName: null,
        hasErrorHandler: false,
        source: target.source as ProviderId,
        kind: "portal",
        badge: undefined,
      };
      added.set(id, node);
      modules.push(node);
    }
    if (status === "dead") node.badge = "deadLink";
    return id;
  };

  /* Incoming anchor: where a cross-workflow link lands on this platform's
     canvas — resolved by the connector descriptor. */
  const incomingAnchor = (hookId?: number): NodeId | null =>
    getConnector(self.source).incomingAnchor(summary.modules, hookId);

  for (const link of links) {
    if (same(self, link.from)) {
      // outgoing: anchor step → portal(target)
      const anchor =
        link.from.stepId && moduleIds.has(link.from.stepId)
          ? link.from.stepId
          : summary.modules[0]?.id;
      if (anchor == null) continue;
      const pid = ensurePortal(link.to, link.status);
      connections.push({
        from: anchor,
        to: pid,
        kind: link.kind,
        label: link.kind === "subflow" ? "subflow" : "webhook",
        status: link.status,
      });
    } else {
      // incoming: portal(origin) → anchor module
      const anchor = incomingAnchor(link.to.hookId);
      if (anchor == null) continue;
      const pid = ensurePortal(link.from, link.status);
      connections.push({
        from: pid,
        to: anchor,
        kind: link.kind,
        label: link.kind === "subflow" ? "subflow" : "webhook",
        status: link.status,
      });
    }
  }

  return { modules, connections };
}
