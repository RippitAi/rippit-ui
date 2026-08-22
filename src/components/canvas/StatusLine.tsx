/** Bottom-left status line of a canvas: where you are · size · zoom. */
export function StatusLine({ parts, zoom, className = "" }: { parts: (string | null | undefined)[]; zoom: number; className?: string }) {
  return (
    <span
      aria-live="off"
      className={`tabular pointer-events-none absolute bottom-3 left-3 z-[2] font-mono text-[9px] text-t3 ${className}`}
    >
      {[...parts.filter(Boolean), `zoom ${Math.round(zoom * 100)}%`].join(" · ")}
    </span>
  );
}
