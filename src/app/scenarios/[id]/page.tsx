"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadCredentials } from "../../lib/credentials";
import {
  fetchScenarioDetail,
  fetchScenarioSummary,
  fetchModuleDetail,
  ScenarioDetail,
  ScenarioSummary,
  ModuleDetail,
} from "../../lib/api";
import ScenarioCanvas from "./ScenarioCanvas";
import ModuleDetailPanel from "./ModuleDetailPanel";

export default function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [summary, setSummary] = useState<ScenarioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleDetail | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);

  useEffect(() => {
    const creds = loadCredentials();
    if (!creds) {
      router.push("/");
      return;
    }

    const scenarioId = parseInt(id);
    Promise.all([
      fetchScenarioDetail(creds, scenarioId),
      fetchScenarioSummary(creds, scenarioId),
    ])
      .then(([d, s]) => {
        setDetail(d);
        setSummary(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleNodeClick = useCallback(
    (moduleId: number) => {
      const scenarioId = parseInt(id);
      setModuleLoading(true);
      setSelectedModule(null);
      fetchModuleDetail(scenarioId, moduleId)
        .then(setSelectedModule)
        .catch(() => setSelectedModule(null))
        .finally(() => setModuleLoading(false));
    },
    [id]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted mt-3">Loading scenario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full text-center">
          <h2 className="font-semibold mb-2">Failed to load scenario</h2>
          <p className="text-sm text-muted mb-4">{error}</p>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!detail || !summary) return null;

  const statusText = detail.isActive
    ? detail.isPaused
      ? "Paused"
      : "Active"
    : "Inactive";
  const statusColor = detail.isActive
    ? detail.isPaused
      ? "text-warning"
      : "text-success"
    : "text-muted";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <Link href="/" className="text-lg font-bold tracking-tight">
            Rippit
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Scenario Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{detail.name}</h1>
              <p className="text-sm text-muted mt-1">
                Scenario #{detail.id}
              </p>
            </div>
            <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xl font-bold">{summary.totalModules}</p>
            <p className="text-xs text-muted">Modules</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xl font-bold">{summary.appsUsed.length}</p>
            <p className="text-xs text-muted">Apps</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xl font-bold">{summary.connections.length}</p>
            <p className="text-xs text-muted">Connections</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-sm font-medium truncate">
              {detail.lastEdit
                ? new Date(detail.lastEdit).toLocaleDateString()
                : "—"}
            </p>
            <p className="text-xs text-muted">Last Edit</p>
          </div>
        </div>

        {/* Apps Used */}
        {summary.appsUsed.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-2">Apps Used</h2>
            <div className="flex flex-wrap gap-2">
              {summary.appsUsed.map((app) => (
                <span
                  key={app}
                  className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium"
                >
                  {app}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Module Flow Canvas */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Module Flow</h2>
          <ScenarioCanvas
            modules={summary.modules}
            connections={summary.connections}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>

      {(selectedModule || moduleLoading) && (
        <ModuleDetailPanel
          module={selectedModule}
          loading={moduleLoading}
          onClose={() => {
            setSelectedModule(null);
            setModuleLoading(false);
          }}
        />
      )}
    </div>
  );
}
