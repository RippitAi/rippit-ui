"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchTags, Tag } from "@/app/lib/api";

/* The user's tag list, shared by pickers, filters, and the palette. */

interface TagsCtx {
  tags: Tag[];
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<TagsCtx>({ tags: [], loading: true, refresh: () => {} });

export function useTags() {
  return useContext(Ctx);
}

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(0);
  const refresh = useCallback(() => setGen((g) => g + 1), []);

  useEffect(() => {
    let live = true;
    fetchTags()
      .then((t) => live && setTags(t))
      .catch(() => live && setTags([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [gen]);

  const value = useMemo(() => ({ tags, loading, refresh }), [tags, loading, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
