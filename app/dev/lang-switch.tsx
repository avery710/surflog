"use client";

import { useLang, type Lang } from "@/lib/i18n";

/**
 * Shared dev-showcase language toggle — the app's real LanguageProvider /
 * setLang (see lib/i18n.tsx), not a fake. Same setting as the avatar menu →
 * Language in the real app (saved per browser in localStorage), so flipping
 * it here also flips any other open tab of the real app.
 */
export function LangSwitch() {
  const { lang, setLang } = useLang();
  const options: { value: Lang; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh-TW", label: "中文" },
  ];
  return (
    <div className="flex gap-1.5 text-xs font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          className={
            "rounded-full px-3 py-1 " +
            (lang === o.value ? "bg-[#0E7C86] text-white" : "bg-secondary text-muted-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
