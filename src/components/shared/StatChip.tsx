export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-[10px] leading-none text-t3">{label}</span>
      <span className="tabular text-[13px] font-semibold leading-tight">
        {value}
      </span>
    </div>
  );
}
