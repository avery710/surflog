import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Newsreader, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Fonts per CLAUDE.md: Jakarta Sans for UI, Newsreader serif for Capy's own
// notes, IBM Plex Mono for readings. Newsreader has no CJK glyphs — the
// browser falls back to a system CJK font per-glyph automatically, same as
// the reference artifact.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
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
      className={`${jakarta.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
