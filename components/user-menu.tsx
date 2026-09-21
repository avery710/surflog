"use client";

import { Download, Globe, LogOut } from "lucide-react";
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
  onExportCsv,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  onExportCsv: () => void;
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
          <span className="flex size-full items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
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

        <DropdownMenuItem onSelect={onExportCsv}>
          <Download />
          {t("action.exportCsv")}
        </DropdownMenuItem>

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
