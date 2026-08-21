"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  ArrowUpRight,
  Box,
  Crosshair,
  LayoutDashboard,
  Link2,
  Search,
  Settings,
  SunMoon,
  Workflow,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  useConnections,
  useWorkflowIndex,
} from "@/components/app/ConnectionsProvider";
import { usePalette } from "./palette-context";
import { getConnector, providerColor } from "@/lib/connectors";
import { workflowHref } from "@/lib/portals";
import { searchEstate, SearchHit } from "@/app/lib/api";
import { kindLabel } from "@/components/shared/AssetsSection";
import { useTags } from "@/components/tags/tags-context";
import { TagChip } from "@/components/tags/TagChip";

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_MIN_CHARS = 2;

/** Debounced server search keyed by the typed query; stale responses ignored. */
function useServerSearch(query: string, enabled: boolean) {
  const [result, setResult] = useState<{ q: string; hits: SearchHit[] } | null>(null);
  const q = query.trim();
  useEffect(() => {
    if (!enabled || q.length < SEARCH_MIN_CHARS) return;
    let live = true;
    const t = setTimeout(() => {
      searchEstate(q, 15)
        .then((r) => live && setResult({ q, hits: r.results }))
        .catch(() => live && setResult({ q, hits: [] }));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, enabled]);
  if (!enabled || q.length < SEARCH_MIN_CHARS) return { hits: [], pending: false };
  return { hits: result?.q === q ? result.hits : [], pending: result?.q !== q };
}

function hitHref(h: SearchHit): string {
  if (h.type === "tag" && h.tagId) return `/dashboard?tag=${encodeURIComponent(h.tagId)}`;
  if (!h.provider || !h.workflowExternalId) return "/dashboard";
  const base = workflowHref({ source: h.provider, refId: h.workflowExternalId });
  return h.nodeId ? `${base}?node=${encodeURIComponent(h.nodeId)}` : base;
}

const PAGES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/unified", label: "Workflow map", icon: Workflow },
  { href: "/monitor", label: "Monitor (preview — sample data)", icon: Activity },
  { href: "/settings/connections", label: "Settings", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, setOpen, close, scope } = usePalette();
  const { connections, linkMap } = useConnections();
  const index = useWorkflowIndex();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const { hits, pending } = useServerSearch(query, isOpen);
  const { tags } = useTags();

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!isOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, setOpen]);

  // Stop painting the 3D canvas while the palette is up: layers from its
  // perspective/preserve-3d stack trigger a Chrome GPU bug that can blank
  // overlaid surfaces (see [data-palette-open] rule in globals.css).
  useEffect(() => {
    document.documentElement.toggleAttribute("data-palette-open", isOpen);
    return () => document.documentElement.removeAttribute("data-palette-open");
  }, [isOpen]);

  const byConnection = useMemo(() => {
    return connections.map((conn) => ({
      conn,
      entries: index.filter((e) => e.connectionId === conn.id),
    }));
  }, [connections, index]);

  const linkNames = useMemo(() => {
    if (!linkMap) return [];
    const nameOf = (ref: { source: string; refId: string }) =>
      linkMap.workflows.find(
        (w) => w.source === ref.source && w.refId === ref.refId
      )?.name || `${ref.source}:${ref.refId}`;
    return linkMap.links.map((l, i) => ({
      key: `${i}:${l.from.source}:${l.from.refId}:${l.to.refId}`,
      from: l.from,
      label: `${nameOf(l.from)} → ${nameOf(l.to)}`,
      kind: l.kind,
      dead: l.status === "dead",
    }));
  }, [linkMap]);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setOpen}
      title="Search Rippit"
      description="Search workflows, pages, and cross-platform links"
    >
      <CommandInput
        placeholder="Search workflows, steps, assets, pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {pending ? "Searching…" : "No results — try a workflow, step, asset, or page."}
        </CommandEmpty>

        {hits.length > 0 && (
          <CommandGroup heading="Search · steps & assets across platforms">
            {hits
              .filter((h) => h.type !== "workflow" && h.type !== "tag")
              .map((h) => {
                const connector = getConnector(h.provider!);
                return (
                  <CommandItem
                    key={`${h.type}:${h.provider}:${h.workflowExternalId}:${h.nodeId ?? ""}:${h.value ?? ""}`}
                    // include the query so cmdk's client filter keeps server hits
                    value={`${query} ${h.type} ${h.label ?? ""} ${h.workflowName ?? ""}`}
                    onSelect={() => go(hitHref(h))}
                  >
                    {h.type === "asset" ? (
                      <Box aria-hidden="true" className="size-3.5 text-t3" />
                    ) : (
                      <Search aria-hidden="true" className="size-3.5 text-t3" />
                    )}
                    <span
                      aria-hidden="true"
                      className="size-[7px] flex-none rounded-[2px]"
                      style={{ background: providerColor(h.provider!) }}
                    />
                    <span className="truncate">{h.label}</span>
                    <span className="truncate text-[10.5px] text-t3">
                      {h.type === "asset"
                        ? `${kindLabel(h.kind ?? "")} · ${h.workflowName ?? ""}`
                        : `${h.workflowName ?? ""}${h.secondary ? ` · ${h.secondary}` : ""}`}
                    </span>
                    <CommandShortcut>
                      {h.type === "asset" ? "asset" : `${connector.nouns.step}${h.ordinal ? ` ${h.ordinal}` : ""}`}
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}

        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)}>
              <p.icon aria-hidden="true" className="size-3.5 text-t3" />
              {p.label}
            </CommandItem>
          ))}
          <CommandItem
            value="toggle theme light dark"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              close();
            }}
          >
            <SunMoon aria-hidden="true" className="size-3.5 text-t3" />
            Toggle theme
          </CommandItem>
        </CommandGroup>

        {tags.length > 0 && (
          <CommandGroup heading="Tags">
            {tags.map((t) => (
              <CommandItem
                key={t.id}
                value={`tag ${t.name}`}
                onSelect={() => go(`/dashboard?tag=${encodeURIComponent(t.id)}`)}
              >
                <TagChip tag={t} size="xs" />
                <span className="text-[10.5px] text-t3">{t.workflows ?? 0} workflows</span>
                <CommandShortcut>filter</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {scope && scope.nodes.length > 0 && (
          <CommandGroup heading={`On this canvas · ${scope.label}`}>
            {scope.nodes.map((n) => (
              <CommandItem
                key={String(n.id)}
                value={`focus ${n.label} ${String(n.id)}`}
                onSelect={() => {
                  scope.onSelect(n.id);
                  close();
                }}
              >
                <Crosshair aria-hidden="true" className="size-3.5 text-t3" />
                <span className="truncate">{n.label}</span>
                <CommandShortcut>focus</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {byConnection.map(({ conn, entries }) => {
          if (entries.length === 0) return null;
          const connector = getConnector(conn.provider);
          return (
            <CommandGroup
              key={conn.id}
              heading={`${connector.shortLabel} · ${
                conn.label || conn.externalId
              }`}
            >
              {entries.map((e) => (
                <CommandItem
                  key={`${e.provider}:${e.refId}`}
                  value={`${e.name} ${e.groupPath.join(" ")} ${connector.label}`}
                  onSelect={() =>
                    go(workflowHref({ source: e.provider, refId: e.refId }))
                  }
                >
                  <span
                    aria-hidden="true"
                    className="size-[7px] flex-none rounded-[2px]"
                    style={{ background: providerColor(e.provider) }}
                  />
                  <span className="truncate">{e.name}</span>
                  {e.groupPath.length > 0 && (
                    <span className="truncate text-[10.5px] text-t3">
                      {e.groupPath.join(" / ")}
                    </span>
                  )}
                  {connector.nativeUrl && (
                    <CommandShortcut aria-hidden="true">
                      <ArrowUpRight className="inline size-3" />
                    </CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {linkNames.length > 0 && (
          <CommandGroup heading="Cross-platform links">
            {linkNames.map((l) => (
              <CommandItem
                key={l.key}
                value={`link ${l.label}`}
                onSelect={() =>
                  go(
                    workflowHref({
                      source: l.from.source,
                      refId: l.from.refId,
                    })
                  )
                }
              >
                <Link2
                  aria-hidden="true"
                  className={`size-3.5 ${l.dead ? "text-err-text" : "text-t3"}`}
                />
                <span className="truncate">{l.label}</span>
                <CommandShortcut>
                  {l.dead ? "broken" : l.kind === "subflow" ? "subflow" : "webhook"}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
