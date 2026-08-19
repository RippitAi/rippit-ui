import {
  fetchHierarchy,
  fetchModuleDetail,
  fetchScenarioDetail,
  fetchScenarioSummary,
  Scenario,
} from "@/app/lib/api";
import ModuleDetailPanel from "@/components/connectors/make/ModuleDetailPanel";
import type { ConnectorDescriptor } from "./types";

export const makeConnector: ConnectorDescriptor = {
  id: "make",
  label: "Make",
  shortLabel: "Make",
  description: "Scenarios, webhooks, and cross-app automations from Make.com.",
  brandColor: "#a855f7",
  glyph: "M",
  nouns: {
    workflow: "scenario",
    workflowPlural: "scenarios",
    step: "module",
    stepPlural: "modules",
    container: "organization",
  },
  connect: {
    type: "form",
    fields: [
      {
        name: "apiToken",
        label: "API token",
        placeholder: "Make API token",
        secret: true,
      },
      {
        name: "organizationId",
        label: "Organization ID",
        placeholder: "e.g. 12345",
      },
    ],
    helpText:
      "Create an API token in Make under Profile → API. The organization ID is the number in your Make dashboard URL (optional on newer Rippit backends — it defaults to the token’s first organization).",
  },

  async fetchTree(conn) {
    const hierarchy = await fetchHierarchy(conn);
    const item = (s: Scenario, team: string, folder: string | null) => ({
      refId: String(s.id),
      name: s.name,
      live: s.isActive && !s.isPaused,
      app: s.usedPackages[0] || "make",
      groupPath: folder ? [team, folder] : [team],
    });
    return hierarchy.teams.map((team) => ({
      id: `team:${team.id}`,
      label: team.name,
      items: [
        ...team.folders.flatMap((f) =>
          f.scenarios.map((s) => item(s, team.name, f.name))
        ),
        ...team.unfolderedScenarios.map((s) => item(s, team.name, null)),
      ],
    }));
  },

  async loadWorkflow(id) {
    const scenarioId = parseInt(id);
    const [detail, summary] = await Promise.all([
      fetchScenarioDetail(scenarioId),
      fetchScenarioSummary(scenarioId),
    ]);
    return {
      summary,
      meta: {
        idChip: `#${detail.id}`,
        statusPill: detail.isActive
          ? detail.isPaused
            ? { label: "Paused", tone: "warn" as const }
            : { label: "Active", tone: "ok" as const }
          : { label: "Inactive", tone: "muted" as const },
        lastEdit: detail.lastEdit,
      },
    };
  },

  fetchNodeDetail(workflowId, nodeId) {
    // Make module ids are always numeric
    return fetchModuleDetail(parseInt(workflowId), Number(nodeId));
  },

  DetailPanel: ModuleDetailPanel,

  headerStats({ summary, meta }) {
    const lastEdit = meta.lastEdit;
    return [
      { label: "Modules", value: String(summary.totalModules) },
      { label: "Apps", value: String(summary.appsUsed.length) },
      { label: "Connections", value: String(summary.connections.length) },
      {
        label: "Last edit",
        value: lastEdit ? new Date(lastEdit).toLocaleDateString() : "—",
      },
    ];
  },

  incomingAnchor(modules, hookId) {
    const byHook =
      hookId != null ? modules.find((m) => m.hookId === hookId) : undefined;
    const anchor =
      byHook ??
      modules.find((m) => m.module.startsWith("gateway:CustomWebHook"));
    return anchor?.id ?? modules[0]?.id ?? null;
  },

  nativeUrl(refId) {
    return `https://www.make.com/en/login?redirect=/scenarios/${refId}/edit`;
  },
};
