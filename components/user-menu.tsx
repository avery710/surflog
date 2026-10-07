"use client";

import Link from "next/link";
import { Globe, KeyRound, LogOut, MapPin, Waves } from "lucide-react";
import { googleSignOut } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang, type Lang } from "@/lib/i18n";

export function UserMenu({
  user,
  canManageSpots = false,
  pendingSpotRequests = 0,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  /** Spot admin only: shows the link to /admin, with the waiting-request count. */
  canManageSpots?: boolean;
  pendingSpotRequests?: number;
}) {
  const { lang, setLang, t } = useLang();
  const name = user.name || user.email || t("menu.signedIn");
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary outline-none transition-opacity hover:opacity-80"
        aria-label={name}
        title={name}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full rounded-full object-cover"
          />
        ) : (
          // bg-badge (dark grey), not bg-primary — this trigger sits on
          // the header's own solid blue bar (2026-10-02), where a
          // same-blue fallback circle would be invisible against its
          // background. Badge grey is high-contrast on blue and matches
          // the grey/white pairing already used for the board rack's
          // 常用 badge, rather than introducing a third colour.
          <span className="flex size-full items-center justify-center rounded-full bg-badge text-[13px] font-bold text-badge-foreground">
            {initial}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <div className="px-2.5 py-1.5">
          <div className="truncate text-[13.5px] font-semibold">{name}</div>
          {user.email && user.name && (
            <div className="truncate text-[12px] font-medium text-muted-foreground">
              {user.email}
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/ai-apps">
            <KeyRound />
            {t("menu.apiTokens")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/spots">
            <Waves />
            {t("menu.spots")}
          </Link>
        </DropdownMenuItem>

        {canManageSpots && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <MapPin />
              {t("menu.spotAdmin")}
              {pendingSpotRequests > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 font-mono text-[11px] font-semibold text-primary-foreground">
                  {pendingSpotRequests}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe />
            {t("menu.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <DropdownMenuRadioItem value="en">{t("lang.en")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="zh-TW">{t("lang.zhTW")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="text-destructive focus:bg-destructive/10">
          <form action={googleSignOut} className="contents">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut />
              {t("action.signOut")}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
