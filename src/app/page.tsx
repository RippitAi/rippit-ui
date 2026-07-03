"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveCredentials, loadCredentials } from "./lib/credentials";

export default function ConnectPage() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const creds = loadCredentials();
    if (creds) {
      setOrganizationId(creds.organizationId);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const creds = { organizationId: organizationId.trim() };

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(
        `${apiBase}/organizations/${creds.organizationId}/teams`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `Connection failed (${res.status})`);
      }
      saveCredentials(creds);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Rippit</h1>
          <p className="text-muted mt-2">Connect to your Make.com organization</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm"
        >
          <div>
            <label htmlFor="orgId" className="block text-sm font-medium mb-1.5">
              Organization ID
            </label>
            <input
              id="orgId"
              type="text"
              required
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="e.g. 12345"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>

          {error && (
            <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
