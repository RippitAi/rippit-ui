"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/app/AuthProvider";
import { supabase } from "@/lib/supabase";

const EASE = [0.22, 1, 0.36, 1] as const;

type Mode = "signin" | "signup" | "otp" | "otp-verify";

const TITLES: Record<Mode, string> = {
  signin: "Sign in to your workspace",
  signup: "Create your account",
  otp: "We’ll email you a one-time code",
  "otp-verify": "Enter the code we emailed you",
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.9.55 3.95 1.55l2.2-2.2A9 9 0 1 0 12 21c5.2 0 8.85-3.65 8.85-8.8 0-.35-.05-.75-.1-1.1Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, session, router]);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      run(async () => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      });
    } else if (mode === "signup") {
      run(async () => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      });
    } else if (mode === "otp") {
      run(async () => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setNotice(`We sent a 6-digit code to ${email}.`);
        setMode("otp-verify");
      });
    } else {
      run(async () => {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: "email",
        });
        if (error) throw error;
      });
    }
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-vpbg p-4"
      style={{
        backgroundImage: "radial-gradient(var(--dot) 1.2px, transparent 1.6px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div
        aria-hidden="true"
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
            aria-hidden="true"
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 45, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="mb-5 flex size-10 items-center justify-center rounded-[11px] bg-t1"
          >
            <div className="size-3 rounded-full bg-bg" />
          </motion.div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px]">rippit</h1>
          <p className="mt-1.5 text-[13px] text-t2">{TITLES[mode]}</p>
        </div>

        <div className="space-y-4 rounded-card border border-line bg-panel p-6 shadow-[0_12px_34px_var(--shade)] backdrop-blur-[14px]">
          <Button
            onClick={google}
            disabled={busy}
            className="h-auto w-full cursor-pointer rounded-control py-2.5 text-[12.5px] font-semibold hover:opacity-85 disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-line2" />
            <span className="text-[10px] font-semibold text-t3">or</span>
            <div className="h-px flex-1 bg-line2" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode !== "otp-verify" && (
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[11px] font-semibold text-t3"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-9 rounded-control border-line-strong bg-hover text-[13px] placeholder:text-t3"
                />
              </div>
            )}

            {(mode === "signin" || mode === "signup") && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[11px] font-semibold text-t3"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-9 rounded-control border-line-strong bg-hover text-[13px] placeholder:text-t3"
                />
              </div>
            )}

            {mode === "otp-verify" && (
              <div>
                <label
                  htmlFor="otp"
                  className="mb-1.5 block text-[11px] font-semibold text-t3"
                >
                  6-digit code
                </label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  required
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-9 rounded-control border-line-strong bg-hover text-center font-mono text-[15px] tracking-[0.3em] placeholder:text-t3"
                />
              </div>
            )}

            {notice && (
              <p role="status" className="text-[12px] text-t2">
                {notice}
              </p>
            )}
            {error && (
              <motion.div
                role="alert"
                id="login-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-control border border-[color-mix(in_srgb,var(--err)_32%,transparent)] bg-[color-mix(in_srgb,var(--err)_10%,transparent)] px-3 py-2 text-[12px] text-err-text"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={busy}
              variant="outline"
              className="h-auto w-full cursor-pointer rounded-control border-line-strong bg-transparent py-2.5 text-[12.5px] font-semibold text-t1 hover:border-t1 hover:bg-transparent disabled:opacity-50"
            >
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "otp"
                      ? "Email me a code"
                      : "Verify code"}
              {!busy && <ArrowRight aria-hidden="true" className="size-3.5" />}
            </Button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-t3">
            {mode === "signin" ? (
              <>
                <button
                  onClick={() => setMode("signup")}
                  className="cursor-pointer underline-offset-2 hover:text-t1 hover:underline"
                >
                  Create an account
                </button>
                <button
                  onClick={() => setMode("otp")}
                  className="cursor-pointer underline-offset-2 hover:text-t1 hover:underline"
                >
                  Email me a code instead
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setNotice("");
                }}
                className="cursor-pointer underline-offset-2 hover:text-t1 hover:underline"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-t3">
          rippit · workflow monitor
        </p>
      </motion.div>
    </main>
  );
}
