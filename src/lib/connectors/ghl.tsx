import {
  fetchConnectionWorkflows,
  fetchGhlStepDetail,
  fetchGhlWorkflows,
  fetchGhlWorkflowSummary,
} from "@/app/lib/api";
import StepDetailPanel from "@/components/connectors/ghl/StepDetailPanel";
import type { ConnectorDescriptor } from "./types";

export const ghlConnector: ConnectorDescriptor = {
  id: "ghl",
  label: "HighLevel",
  shortLabel: "GHL",
  description:
    "Workflows, triggers, and webhook steps from your GoHighLevel location.",
  brandColor: "#0ea5e9",
  glyph: "GH",
  nouns: {
    workflow: "workflow",
    workflowPlural: "workflows",
    step: "step",
    stepPlural: "steps",
    container: "location",
  },
  connect: {
    type: "extension",
    instructions: [
      "Install the Rippit Chrome extension.",
      "Open your GoHighLevel location in another tab and log in.",
      "Click the extension and choose “Connect this location”.",
      "Come back here — the connection appears automatically.",
    ],
  },

  async fetchTree(conn) {
    const location = conn.label || conn.externalId;
    const items = conn.id.startsWith("legacy:")
      ? (await fetchGhlWorkflows(conn.externalId)).map((w) => ({
          refId: w.id,
          name: w.name,
          live: w.status === "published",
          status: w.status,
          app: "ghl",
          groupPath: [location],
        }))
      : (await fetchConnectionWorkflows(conn.id)).map((w) => ({
          refId: w.external_id,
          name: w.name,
          live: w.is_active ?? w.status === "published",
          status: w.status,
          app: "ghl",
          groupPath: [location],
        }));
    return [
      {
        id: `location:${conn.externalId}`,
        label: `GHL · ${location}`,
        items,
      },
    ];
  },

  async loadWorkflow(id) {
    const summary = await fetchGhlWorkflowSummary(id);
    return {
      summary,
      meta: {
        statusPill:
          summary.status === "published"
            ? { label: "Published", tone: "ok" as const }
            : { label: summary.status || "Draft", tone: "muted" as const },
      },
    };
  },

  fetchNodeDetail(workflowId, nodeId) {
    return fetchGhlStepDetail(workflowId, String(nodeId));
  },

  DetailPanel: StepDetailPanel,

  headerStats({ summary }) {
    const triggers = summary.modules.filter((m) => m.kind === "trigger").length;
    return [
      { label: "Steps", value: String(summary.totalModules - triggers) },
      { label: "Triggers", value: String(triggers) },
      { label: "Connections", value: String(summary.connections.length) },
    ];
  },

  incomingAnchor(modules) {
    const trigger = modules.find((m) => m.kind === "trigger");
    return trigger?.id ?? modules[0]?.id ?? null;
  },
};
