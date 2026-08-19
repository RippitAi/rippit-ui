"use client";

import type { User } from "@supabase/supabase-js";

function initialsOf(user: User | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (meta.full_name as string) || (meta.name as string) || user?.email || "";
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

/** Google avatar when present (SSO), initials tile otherwise. */
export function UserAvatar({
  user,
  size = 26,
}: {
  user: User | null;
  size?: number;
}) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const src = (meta.avatar_url as string) || (meta.picture as string) || null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external SSO avatar; no optimization/remotePatterns needed
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="flex-none rounded-full border border-line"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center rounded-full bg-t1 font-mono text-[10px] font-bold text-bg"
      style={{ width: size, height: size }}
    >
      {initialsOf(user)}
    </span>
  );
}
