"use client";

import { useLang, type Lang } from "@/lib/i18n";

/** Same setting as avatar menu → Language (saved per browser). */
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
            (lang === o.value ? "bg-primary text-white" : "bg-secondary text-muted-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
