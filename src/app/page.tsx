"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCredentials, loadCredentials } from "./lib/credentials";

const EASE = [0.22, 1, 0.36, 1] as const;

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
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-vpbg p-4"
      style={{
        backgroundImage: "radial-gradient(var(--dot) 1.2px, transparent 1.6px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* soft vignette so the grid recedes behind the card */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, var(--vpbg) 85%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 45, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="mb-5 flex size-10 items-center justify-center rounded-[11px] bg-t1"
          >
            <div className="size-3 rounded-full bg-bg" />
          </motion.div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px]">rippit</h1>
          <p className="mt-1.5 text-[13px] text-t2">
            Connect to your Make.com organization
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-card border border-line bg-panel p-6 shadow-[0_12px_34px_var(--shade)] backdrop-blur-[14px]"
        >
          <div>
            <label
              htmlFor="orgId"
              className="mb-1.5 block text-[11px] font-semibold text-t3"
            >
              Organization ID
            </label>
            <Input
              id="orgId"
              type="text"
              required
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="e.g. 12345"
              className="h-9 rounded-control border-line bg-hover text-[13px] tabular placeholder:text-t3"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-control border border-[rgba(239,68,68,.32)] bg-[rgba(239,68,68,.1)] px-3 py-2 text-[12px] text-err"
            >
              {error}
            </motion.div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-auto w-full cursor-pointer rounded-control py-2.5 text-[12.5px] font-semibold hover:opacity-85 disabled:opacity-50"
          >
            {loading ? "Connecting…" : "Connect"}
            {!loading && <ArrowRight className="size-3.5" />}
          </Button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] text-t3">
          rippit · workflow monitor
        </p>
      </motion.div>
    </div>
  );
}
