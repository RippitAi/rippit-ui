"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadCredentials, clearCredentials } from "../lib/credentials";
import { fetchHierarchy, Hierarchy, Team, Folder, Scenario } from "../lib/api";

function StatusBadge({ scenario }: { scenario: Scenario }) {
  if (scenario.isActive && !scenario.isPaused) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Active
      </span>
    );
  }
  if (scenario.isPaused) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-muted" />
      Inactive
    </span>
  );
}

function ScenarioRow({ scenario }: { scenario: Scenario }) {
  return (
    <Link
      href={`/scenarios/${scenario.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-background/50 transition-colors rounded-lg group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-mono shrink-0">
          {scenario.id}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {scenario.name}
          </p>
          {scenario.usedPackages.length > 0 && (
            <p className="text-xs text-muted truncate">
              {scenario.usedPackages.join(", ")}
            </p>
          )}
        </div>
      </div>
      <StatusBadge scenario={scenario} />
    </Link>
  );
}

function FolderSection({ folder }: { folder: Folder }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground w-full px-2 py-1.5 cursor-pointer"
      >
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        {folder.name}
        <span className="text-xs text-muted ml-auto">{folder.scenarios.length}</span>
      </button>
      {open && (
        <div className="ml-4 border-l border-border pl-2">
          {folder.scenarios.length === 0 ? (
            <p className="text-xs text-muted px-4 py-2">No scenarios</p>
          ) : (
            folder.scenarios.map((s) => <ScenarioRow key={s.id} scenario={s} />)
          )}
        </div>
      )}
    </div>
  );
}

function TeamSection({ team }: { team: Team }) {
  const totalScenarios =
    team.folders.reduce((sum, f) => sum + f.scenarios.length, 0) +
    team.unfolderedScenarios.length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{team.name}</h2>
          <span className="text-xs text-muted bg-background px-2 py-1 rounded-md">
            {totalScenarios} scenario{totalScenarios !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="p-3">
        {team.folders.map((f) => (
          <FolderSection key={f.id} folder={f} />
        ))}
        {team.unfolderedScenarios.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-muted uppercase tracking-wider px-2 py-1.5">
              Unfoldered
            </p>
            {team.unfolderedScenarios.map((s) => (
              <ScenarioRow key={s.id} scenario={s} />
            ))}
          </div>
        )}
        {totalScenarios === 0 && (
          <p className="text-sm text-muted text-center py-6">No scenarios in this team</p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [hierarchy, setHierarchy] = useState<Hierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const creds = loadCredentials();
    if (!creds) {
      router.push("/");
      return;
    }
    fetchHierarchy(creds)
      .then(setHierarchy)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  function handleDisconnect() {
    clearCredentials();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted mt-3">Loading organization data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full text-center">
          <div className="text-danger text-4xl mb-3">!</div>
          <h2 className="font-semibold mb-2">Failed to load</h2>
          <p className="text-sm text-muted mb-4">{error}</p>
          <button
            onClick={handleDisconnect}
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            Reconnect with different credentials
          </button>
        </div>
      </div>
    );
  }

  if (!hierarchy) return null;

  const totalScenarios = hierarchy.teams.reduce(
    (sum, t) =>
      sum +
      t.folders.reduce((fs, f) => fs + f.scenarios.length, 0) +
      t.unfolderedScenarios.length,
    0
  );
  const totalFolders = hierarchy.teams.reduce((sum, t) => sum + t.folders.length, 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Rippit
            </Link>
            <span className="text-xs text-muted bg-background px-2 py-1 rounded-md">
              Org {hierarchy.organizationId}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">{hierarchy.teams.length}</p>
            <p className="text-xs text-muted">Teams</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">{totalFolders}</p>
            <p className="text-xs text-muted">Folders</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">{totalScenarios}</p>
            <p className="text-xs text-muted">Scenarios</p>
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-4">
          {hierarchy.teams.map((team) => (
            <TeamSection key={team.id} team={team} />
          ))}
        </div>
      </div>
    </div>
  );
}
