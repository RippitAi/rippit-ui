export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`rounded-[4px] border border-line bg-hover px-[5px] py-px font-mono text-[9px] font-medium text-t3 ${className}`}
    >
      {children}
    </kbd>
  );
}
