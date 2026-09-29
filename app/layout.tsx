import type { Metadata } from "next";
import { Funnel_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LanguageProvider>{children}</LanguageProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
