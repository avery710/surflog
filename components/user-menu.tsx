"use client";

import { googleSignOut } from "@/app/actions";

export function UserMenu({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const label = user.name || user.email || "Signed in";
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 rounded-full bg-secondary py-1 pr-1 pl-2.5">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          referrerPolicy="no-referrer"
          className="size-5 rounded-full"
        />
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {initial}
        </span>
      )}
      <span className="max-w-[140px] truncate text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <form action={googleSignOut}>
        <button
          type="submit"
          className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
