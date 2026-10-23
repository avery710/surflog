import type { Metadata } from "next";
import { Funnel_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@/components/analytics";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";
import { QueryProvider } from "@/components/query-provider";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// Fonts per CLAUDE.md: Funnel Sans for UI and notes (og.com's body font),
// IBM Plex Mono for readings. Neither has CJK glyphs — the browser falls
// back to a system CJK font per-glyph automatically.
const funnel = Funnel_Sans({
  variable: "--font-funnel",
  subsets: ["latin"],
  weight: "variable", // 300–800, one file
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Surflog",
  description: "Personal surf journal — Taiwan spots, conditions attached automatically.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${funnel.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-panel text-foreground">
        <QueryProvider>
          <LanguageProvider>
            {/* Every page (header + content, not the footer) is at least one
                screen tall, so the footer always starts below the fold and
                never flashes on screen while a page or skeleton is loading
                (2026-10-21, on request). Pages grow into it with flex-1. */}
            <div className="flex min-h-dvh flex-col">{children}</div>
            <SiteFooter />
          </LanguageProvider>
        </QueryProvider>
        <Toaster position="bottom-center" />
        <Analytics />
      </body>
    </html>
  );
}
