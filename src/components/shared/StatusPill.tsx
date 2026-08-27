import type { StatusPillInfo } from "@/lib/connectors/types";

const TONE = {
  ok: { text: "text-ok-text", varName: "--ok" },
  warn: { text: "text-warn-text", varName: "--warn" },
  muted: { text: "text-off-text", varName: "--off" },
  err: { text: "text-err-text", varName: "--err" },
} as const;

/**
 * Status pill — tinted border/bg (graphic role) + readable text (text role).
 * `pulse` blinks the dot for a live/active workflow; `dot={false}` hides it
 * (counts like "3 changes").
 */
export function StatusPill({
  pill,
  pulse = false,
  dot = true,
  className = "",
}: {
  pill: StatusPillInfo | { label: string; tone: keyof typeof TONE };
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}) {
  const tone = TONE[pill.tone as keyof typeof TONE] ?? TONE.muted;
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11px] font-semibold capitalize leading-none ${tone.text} ${className}`}
      style={{
        background: `color-mix(in srgb, var(${tone.varName}) 10%, transparent)`,
        borderColor: `color-mix(in srgb, var(${tone.varName}) 32%, transparent)`,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-[5px] rounded-full"
          style={{
            background: `var(${tone.varName})`,
            animation: pulse ? "blinkdot 1.6s ease-in-out infinite" : undefined,
          }}
        />
      )}
      {pill.label}
    </span>
  );
}
