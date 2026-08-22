"use client";

import type { ModuleDetail } from "@/app/lib/api";
import type { DetailSectionsProps, NodeDescription } from "@/lib/connectors/types";
import { appName } from "@/lib/apps";
import { CopyJsonButton, JsonBlock, KvRow, Section } from "@/components/shared/DetailPanelKit";

/** Inspector header fields for a Make module payload. */
export function describeMakeModule(data: unknown): NodeDescription {
  const mod = data as ModuleDetail;
  const filterName =
    mod.filter && typeof mod.filter === "object" && "name" in mod.filter ? String((mod.filter as { name?: unknown }).name ?? "") : null;
  return {
    title: mod.label || mod.module,
    app: mod.app || mod.module,
    kindLabel: appName(mod.app || mod.module),
    summary: mod.summary,
    ordinal: mod.ordinal,
    waitText: mod.waitFor?.text ?? null,
    assets: mod.assets,
    filterName: filterName || null,
  };
}

/** Provider-specific sections under "Raw config" for a Make module. */
export default function ModuleDetailSections({ data }: DetailSectionsProps) {
  const mod = data as ModuleDetail | null;
  if (!mod) return null;
  return (
    <>
      <Section title="Module identity">
        <div className="flex flex-col">
          <KvRow k="ID" v={mod.id} />
          <KvRow k="App" v={mod.app} />
          <KvRow k="Type" v={<span className="break-all">{mod.module}</span>} />
          {mod.version != null && <KvRow k="Version" v={mod.version} />}
        </div>
      </Section>

      {mod.filter && (
        <Section title="Filter">
          {typeof mod.filter === "object" && "name" in mod.filter && (
            <div className="mb-2 inline-flex rounded-full border border-[color-mix(in_srgb,var(--warn)_32%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-[9px] py-[3px] text-[10px] font-semibold text-warn-text">
              {String(mod.filter.name)}
            </div>
          )}
          <JsonBlock data={mod.filter} />
        </Section>
      )}

      {mod.mapper && (
        <Section title="Mapper · configuration" action={<CopyJsonButton data={mod} />}>
          <JsonBlock data={mod.mapper} />
        </Section>
      )}

      {mod.parameters && (
        <Section title="Parameters">
          <JsonBlock data={mod.parameters} />
        </Section>
      )}

      {mod.onerror && (
        <Section title="Error handler">
          <JsonBlock data={mod.onerror} />
        </Section>
      )}

      {mod.flags && (
        <Section title="Flags">
          <JsonBlock data={mod.flags} />
        </Section>
      )}
    </>
  );
}
