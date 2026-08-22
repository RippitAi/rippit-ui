"use client";

import type { ModuleDetail } from "@/app/lib/api";
import type { DetailPanelProps } from "@/lib/connectors/types";
import { appColor, appGlyph, appName } from "@/lib/apps";
import {
  CopyJsonButton,
  DetailPanelShell,
  JsonBlock,
  KvRow,
  Section,
} from "@/components/shared/DetailPanelKit";
import { AssetsSection } from "@/components/shared/AssetsSection";
import { IssuesSection } from "@/components/shared/IssuesSection";
import { CommentsSection } from "@/components/shared/CommentsSection";

export default function ModuleDetailPanel({
  data,
  loading,
  error,
  onClose,
  onFindUses,
  issues,
  commentTarget,
}: DetailPanelProps) {
  const mod = data as ModuleDetail | null;
  if (!loading && !error && !mod) return null;

  const col = mod ? appColor(mod.app || mod.module) : "#64748b";

  return (
    <DetailPanelShell
      title={mod?.label || mod?.module || ""}
      subtitle={mod ? appName(mod.app) : ""}
      glyph={mod ? appGlyph(mod.app || mod.module) : "…"}
      color={col}
      loading={loading}
      error={error}
      onClose={onClose}
    >
      {mod && (
        <>
          {(mod.summary || mod.ordinal || mod.waitFor) && (
            <Section title="What it does">
              <div className="flex flex-col">
                {mod.summary && <KvRow k="Does" v={mod.summary} />}
                {mod.ordinal && (
                  <KvRow k="Fires" v={<span className="font-mono">{mod.ordinal}</span>} />
                )}
                {mod.waitFor && <KvRow k="Waits" v={mod.waitFor.text} />}
              </div>
            </Section>
          )}

          <IssuesSection issues={issues} onFindUses={onFindUses} />
          <AssetsSection assets={mod.assets} onFindUses={onFindUses} />
          <CommentsSection targetKey={commentTarget} />

          <Section title="Module identity">
            <div className="flex flex-col">
              <KvRow k="ID" v={mod.id} />
              <KvRow k="App" v={mod.app} />
              <KvRow
                k="Type"
                v={<span className="break-all">{mod.module}</span>}
              />
              {mod.version != null && (
                <KvRow k="Version" v={mod.version} />
              )}
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
            <Section
              title="Mapper · configuration"
              action={<CopyJsonButton data={mod} />}
            >
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
      )}
    </DetailPanelShell>
  );
}
