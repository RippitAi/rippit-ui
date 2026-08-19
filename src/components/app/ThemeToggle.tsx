"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// true after hydration, false during SSR — avoids a theme-mismatch flash
const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted ? resolvedTheme === "dark" : true;

  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      disabled={!mounted}
      className={`flex size-[30px] cursor-pointer items-center justify-center rounded-control border border-line-strong text-t3 transition-colors hover:border-t1 hover:text-t1 ${className}`}
    >
      {dark ? (
        <Sun aria-hidden="true" className="size-3.5" />
      ) : (
        <Moon aria-hidden="true" className="size-3.5" />
      )}
    </button>
  );
}
