"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearApiCaches, setAuthFailureHandler } from "@/app/lib/api";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  /** True until the first getSession() resolves. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      lastUserId.current = data.session?.user.id ?? null;
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      const nextId = next?.user.id ?? null;
      if (nextId !== lastUserId.current) {
        // user signed in/out/switched — anything cached for the old user is stale
        clearApiCaches();
        lastUserId.current = nextId;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Backend said the session is invalid (401 + WWW-Authenticate: Bearer):
  // hard reset to /login so no per-user state survives.
  useEffect(() => {
    setAuthFailureHandler(() => {
      supabase.auth.signOut().finally(() => {
        clearApiCaches();
        window.location.assign("/login");
      });
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearApiCaches();
    window.location.assign("/login");
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading, signOut }),
    [session, loading, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
