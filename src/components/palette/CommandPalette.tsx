"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  ArrowUpRight,
  Cable,
  Crosshair,
  LayoutDashboard,
  Link2,
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

const PAGES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/unified", label: "Workflow map", icon: Workflow },
  { href: "/monitor", label: "Monitor", icon: Activity },
  { href: "/settings/connections", label: "Connections", icon: Cable },
];

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, setOpen, close, scope } = usePalette();
  const { connections, linkMap } = useConnections();
  const index = useWorkflowIndex();
  const { resolvedTheme, setTheme } = useTheme();

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
      <CommandInput placeholder="Search workflows, pages, links…" />
      <CommandList>
        <CommandEmpty>No results — try a workflow, page, or link.</CommandEmpty>

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
