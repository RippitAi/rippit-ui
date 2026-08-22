"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useConnections, useWorkflowIndex } from "@/components/app/ConnectionsProvider";
import { getConnector } from "@/lib/connectors";
import type { NavFolder, NavGroup, NavItem, ProviderId } from "@/lib/connectors/types";
import type { Connection } from "@/app/lib/connections-store";
import { workflowHref } from "@/lib/portals";
import { fetchViews, SavedView } from "@/app/lib/api";
import { AppPuck } from "@/components/shared/AppPuck";
import { useRecentWorkflows, useStoredJson, writeStored } from "@/lib/stored";

/*
 * 206px workflow browser — folders are the browsing unit (hundreds of
 * workflows stay scannable because only one folder per connection is open
 * at a time). Typing filters the whole estate into a flat, capped hit list.
 * Severity dots come from the link map (error > warn/changed).
 */

type Sev = "err" | "warn" | null;
const OPEN_KEY = "rippit.browser.open";
const CONN_KEY = "rippit.browser.connOpen";
const HIT_CAP = 30;
const EMPTY_OPEN: Record<string, string | null> = {};
const EMPTY_CONN: Record<string, boolean> = {};

const ROW =
  "flex w-full cursor-pointer items-center gap-1.5 rounded-row border-0 bg-transparent px-1.5 text-left transition-[background] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-hover";

function SevDot({ sev }: { sev: Sev }) {
  if (!sev) return null;
  const c = sev === "err" ? "var(--err)" : "var(--warn)";
  return (
    <span
      aria-hidden="true"
      className="size-[5px] flex-none rounded-full"
      style={{ background: c, boxShadow: `0 0 5px ${c}` }}
    />
  );
}

function StatusDot({ item }: { item: NavItem }) {
  const c =
    item.status === "paused" ? "var(--warn)" : item.live ? "var(--ok)" : "var(--off)";
  return <span aria-hidden="true" className="size-[4px] flex-none rounded-full" style={{ background: c }} />;
}

/** Workflow browser — the side panel for Workflows / Dashboard / System map. */
export function WorkflowBrowser() {
  const pathname = usePathname();
  const { connections, trees, treeStatus, syncing, sync, linkMap, loading } = useConnections();
  const index = useWorkflowIndex();
  const [q, setQ] = useState("");
  // Persisted "which folder is open per connection".
  const open = useStoredJson<Record<string, string | null>>(OPEN_KEY, EMPTY_OPEN);
  const toggleFolder = (connId: string, folderId: string) =>
    writeStored(OPEN_KEY, { ...open, [connId]: open[connId] === folderId ? null : folderId });
  // Organizations / locations collapse too (default open).
  const connOpen = useStoredJson<Record<string, boolean>>(CONN_KEY, EMPTY_CONN);
  const toggleConn = (connId: string) => writeStored(CONN_KEY, { ...connOpen, [connId]: !(connOpen[connId] ?? true) });
  const [views, setViews] = useState<SavedView[]>([]);
  const recentAll = useRecentWorkflows();
  const recent = recentAll.slice(0, 5);

  useEffect(() => {
    let live = true;
    fetchViews().then((d) => live && setViews(d.views)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Severity per workflow from the link map.
  const sevOf = useMemo(() => {
    const m = new Map<string, Sev>();
    for (const w of linkMap?.workflows ?? []) {
      const ic = w.issueCounts;
      const sev: Sev = ic && ic.error > 0 ? "err" : (ic && ic.warn > 0) || (w.changedSince?.count ?? 0) > 0 ? "warn" : null;
      if (sev) m.set(`${w.source}:${w.refId}`, sev);
    }
    return m;
  }, [linkMap]);

  const ql = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!ql) return null;
    const out: { key: string; href: string; name: string; app: string; path: string; sev: Sev }[] = [];
    for (const w of index) {
      const path = w.groupPath.join(" / ");
      if (w.name.toLowerCase().includes(ql) || path.toLowerCase().includes(ql)) {
        out.push({
          key: `${w.provider}:${w.refId}`,
          href: workflowHref({ source: w.provider, refId: w.refId }),
          name: w.name,
          app: w.app || w.provider,
          path: path || getConnector(w.provider).shortLabel,
          sev: sevOf.get(`${w.provider}:${w.refId}`) ?? null,
        });
        if (out.length >= HIT_CAP) break;
      }
    }
    return out;
  }, [ql, index, sevOf]);

  return (
    <>
      <div className="flex-none px-2 pb-1 pt-2">
        <label className="flex h-7 items-center gap-[7px] rounded-control border border-line bg-hover px-[9px] transition-[border-color] duration-[var(--dur-fast)] focus-within:border-line-strong hover:border-line-strong">
          <Search aria-hidden="true" className="size-[11px] flex-none text-t3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Filter ${index.length || ""}…`}
            aria-label="Filter workflows"
            className="min-w-0 flex-1 border-0 bg-transparent text-[10.5px] text-t1 outline-none placeholder:text-t3"
          />
        </label>
      </div>
      <div className="thin-scroll stagger min-h-0 flex-1 overflow-y-auto p-[7px]">
        {hits ? (
          <div>
            <p role="status" className="tabular mx-1.5 mb-1 mt-0.5 font-mono text-[9px] text-t3">
              {hits.length}
              {hits.length === HIT_CAP ? "+" : ""} match{hits.length === 1 ? "" : "es"}
            </p>
            {hits.map((h) => (
              <Link key={h.key} href={h.href} title={h.path} className={`${ROW} h-[29px] gap-[7px]`}>
                <AppPuck app={h.app} size={16} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] text-t1">{h.name}</span>
                  <span className="tabular block truncate font-mono text-[8px] text-t3">{h.path}</span>
                </span>
                <SevDot sev={h.sev} />
              </Link>
            ))}
            {hits.length === 0 && <p className="px-1.5 py-1 text-[10.5px] italic text-t3">No workflows match</p>}
          </div>
        ) : (
          <>
            {recent.length > 0 && (
              <section className="mb-2" aria-label="Recently opened">
                <p className="px-1.5 pb-0.5 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-t3">Recent</p>
                {recent.map((r) => {
                  const href = `/w/${r.provider}/${r.id}`;
                  return (
                    <Link key={`${r.provider}:${r.id}`} href={href} aria-current={pathname === href ? "page" : undefined} className={`${ROW} h-[26px] text-[10.5px] ${pathname === href ? "bg-hover font-medium text-t1" : "text-t2 hover:text-t1"}`}>
                      <Clock3 aria-hidden="true" className="size-[11px] flex-none text-t3" />
                      <span className="truncate">{r.name}</span>
                    </Link>
                  );
                })}
              </section>
            )}
            {connections.map((conn) => (
              <ConnectionTree
                key={conn.id}
                connection={conn}
                groups={trees[conn.id] ?? []}
                status={treeStatus[conn.id] ?? "loading"}
                syncing={syncing === conn.id}
                onSync={() => sync(conn)}
                openFolder={open[conn.id] ?? null}
                onToggleFolder={(fid) => toggleFolder(conn.id, fid)}
                expanded={connOpen[conn.id] ?? true}
                onToggle={() => toggleConn(conn.id)}
                sevOf={sevOf}
                pathname={pathname}
              />
            ))}
            {!loading && connections.length === 0 && (
              <div className="px-1.5 py-2 text-[10.5px] text-t3">
                Nothing connected yet.{" "}
                <Link href="/settings/connections" className="font-semibold text-t1 underline-offset-2 hover:underline">
                  Connect a platform
                </Link>
              </div>
            )}
            {loading && (
              <div role="status" aria-label="Loading connections" className="flex flex-col gap-1.5 px-1 py-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} aria-hidden="true" className="h-[22px] animate-pulse rounded-row bg-hover motion-reduce:animate-none" />
                ))}
              </div>
            )}
            {views.length > 0 && (
              <section className="mt-2" aria-label="Saved views">
                <p className="px-1.5 pb-0.5 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-t3">Views</p>
                {views.map((v) => (
                  <Link
                    key={v.id}
                    href={`/${v.kind === "unified" ? "map" : "dashboard"}?view=${encodeURIComponent(v.id)}`}
                    className={`${ROW} h-[26px] text-[10.5px] text-t2 hover:text-t1`}
                  >
                    <Bookmark aria-hidden="true" className="size-[11px] flex-none text-t3" />
                    <span className="truncate">{v.name}</span>
                  </Link>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Count shown in the panel header. */
export function useWorkflowCount(): string {
  const { loading } = useConnections();
  const index = useWorkflowIndex();
  return loading ? "…" : `${index.length}`;
}

function ConnectionTree({
  connection,
  groups,
  status,
  syncing,
  onSync,
  openFolder,
  onToggleFolder,
  expanded,
  onToggle,
  sevOf,
  pathname,
}: {
  connection: Connection;
  groups: NavGroup[];
  status: "loading" | "ready" | "error";
  syncing: boolean;
  onSync: () => void;
  openFolder: string | null;
  onToggleFolder: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
  sevOf: Map<string, Sev>;
  pathname: string;
}) {
  const connector = getConnector(connection.provider);
  const needsReauth = connection.status === "needs_reauth";
  const total = groups.reduce(
    (n, g) => n + g.items.length + (g.folders ?? []).reduce((m, f) => m + f.items.length, 0),
    0
  );
  return (
    <div className="mb-1.5">
      <div className="flex h-[27px] items-center gap-[6px] rounded-row px-1.5 transition-[background] duration-[var(--dur-fast)] hover:bg-hover">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${connector.label} · ${connection.displayName}`}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-[6px] border-0 bg-transparent p-0 text-left"
        >
          <ChevronRight aria-hidden="true" className={`size-[10px] flex-none text-t3 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] ${expanded ? "rotate-90" : ""}`} />
          <AppPuck app={connector.id} color={connector.brandColor} glyph={connector.glyph} size={15} />
          <span
            className="min-w-0 flex-1 truncate text-[10px] font-semibold text-t1"
            title={`${connector.label} · ${connection.displayName}${connection.accountName && connection.label ? ` (${connection.accountName})` : ""} · id ${connection.externalId}`}
          >
            {connector.shortLabel} · {connection.displayName}
          </span>
        </button>
        {needsReauth ? (
          <Link href="/settings/connections" className="flex items-center gap-0.5 text-[9px] font-semibold text-warn-text hover:underline" title="Session expired — reconnect from Settings">
            <TriangleAlert aria-hidden="true" className="size-2.5" />
            reauth
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            aria-label={`Sync ${connector.label} ${connection.displayName} now`}
            title={connection.lastSyncedAt ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : "Sync now"}
            className="group/sync flex cursor-pointer items-center gap-1 text-t3 transition-colors hover:text-t1 disabled:cursor-default"
          >
            <RefreshCw aria-hidden="true" className={`size-[9px] ${syncing ? "spin motion-reduce:animate-none" : "opacity-0 transition-opacity group-hover/sync:opacity-100"}`} />
            <span aria-hidden="true" className="tabular font-mono text-[8px]">{syncing ? "syncing" : total}</span>
          </button>
        )}
      </div>
      {!expanded ? null : (
      <div className="ml-[6px]">
      {status === "loading" && (
        <div role="status" aria-label={`Loading ${connector.nouns.workflowPlural}`} className="flex flex-col gap-1 px-1.5 py-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="h-[20px] animate-pulse rounded-row bg-hover motion-reduce:animate-none" />
          ))}
        </div>
      )}
      {status === "error" && (
        <p className="px-1.5 py-0.5 text-[10px] text-warn-text">
          Couldn’t load.{" "}
          <button type="button" onClick={onSync} className="cursor-pointer underline underline-offset-2 hover:text-t1">
            Retry
          </button>
        </p>
      )}
      {status === "ready" && total === 0 && (
        <p className="px-1.5 py-0.5 text-[10px] italic text-t3">{syncing ? "Syncing…" : `No ${connector.nouns.workflowPlural} synced yet`}</p>
      )}
      {groups.map((g) => (
        <div key={g.id}>
          {groups.length > 1 && (
            <p className="truncate px-1.5 pb-0.5 pt-1 font-mono text-[8.5px] text-t3" title={g.label}>
              {g.label}
            </p>
          )}
          {(g.folders ?? []).map((f) => (
            <FolderRows
              key={f.id}
              folder={f}
              provider={connection.provider}
              open={openFolder === f.id}
              onToggle={() => onToggleFolder(f.id)}
              sevOf={sevOf}
              pathname={pathname}
            />
          ))}
          {g.items.map((it) => (
            <WorkflowRow key={it.refId} item={it} provider={connection.provider} sevOf={sevOf} pathname={pathname} indent={false} />
          ))}
        </div>
      ))}
      </div>
      )}
    </div>
  );
}

function FolderRows({
  folder,
  provider,
  open,
  onToggle,
  sevOf,
  pathname,
}: {
  folder: NavFolder;
  provider: ProviderId;
  open: boolean;
  onToggle: () => void;
  sevOf: Map<string, Sev>;
  pathname: string;
}) {
  const sev: Sev = folder.items.some((i) => sevOf.get(`${provider}:${i.refId}`) === "err")
    ? "err"
    : folder.items.some((i) => sevOf.get(`${provider}:${i.refId}`) === "warn")
      ? "warn"
      : null;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`${ROW} h-[27px]`}
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-[10px] flex-none text-t3 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-t2">{folder.label}</span>
        <SevDot sev={sev} />
        <span className="tabular font-mono text-[8px] text-t3">{folder.items.length}</span>
      </button>
      {open && (
        <div className="my-px mb-[3px]">
          {folder.items.map((it) => (
            <WorkflowRow key={it.refId} item={it} provider={provider} sevOf={sevOf} pathname={pathname} indent />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowRow({
  item,
  provider,
  sevOf,
  pathname,
  indent,
}: {
  item: NavItem;
  provider: ProviderId;
  sevOf: Map<string, Sev>;
  pathname: string;
  indent: boolean;
}) {
  const href = workflowHref({ source: provider, refId: item.refId });
  const active = pathname === href;
  return (
    <Link
      href={href}
      title={item.name}
      aria-current={active ? "page" : undefined}
      className={`${ROW} h-[26px] ${indent ? "pl-[22px]" : ""} ${active ? "bg-hover" : ""}`}
    >
      <StatusDot item={item} />
      <span className={`min-w-0 flex-1 truncate text-[10px] ${active ? "font-medium text-t1" : "text-t2"}`}>{item.name}</span>
      <SevDot sev={sevOf.get(`${provider}:${item.refId}`) ?? null} />
    </Link>
  );
}
