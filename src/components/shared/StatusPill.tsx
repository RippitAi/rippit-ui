import type { StatusPillInfo } from "@/lib/connectors/types";

const TONE = {
  ok: { text: "text-ok-text", varName: "--ok" },
  warn: { text: "text-warn-text", varName: "--warn" },
  muted: { text: "text-off-text", varName: "--off" },
} as const;

export function StatusPill({ pill }: { pill: StatusPillInfo }) {
  const tone = TONE[pill.tone];
  return (
    <span
      className={`flex-none rounded-full border px-[9px] py-[3px] text-[10px] font-semibold capitalize ${tone.text}`}
      style={{
        background: `color-mix(in srgb, var(${tone.varName}) 10%, transparent)`,
        borderColor: `color-mix(in srgb, var(${tone.varName}) 32%, transparent)`,
      }}
    >
      {pill.label}
    </span>
  );
}
