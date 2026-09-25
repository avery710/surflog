"use client";

import { useRef } from "react";
import { cn } from "cn";
import { inputClassName } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";

/**
 * A date picker whose displayed text follows the app's language. A native
 * <input type="date"> renders its value in the OS/browser locale (iOS
 * Safari: the phone's region, so an English UI showed "2026年9月25日"), so
 * the native input sits invisibly on top for the picker and we draw the text.
 */
export function DateField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { lang } = useLang();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // desktop Chrome only opens the picker from its icon otherwise
        onClick={() => {
          try {
            ref.current?.showPicker?.();
          } catch {
            /* not allowed here; the native input still works */
          }
        }}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0"
      />
      <div
        aria-hidden
        className={cn(
          inputClassName,
          "flex items-center overflow-hidden whitespace-nowrap peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
          className
        )}
      >
        <span className="truncate">{fmtDate(value, lang, false)}</span>
      </div>
    </div>
  );
}
