import { notFound } from "next/navigation";
import { GlowLab } from "./glow-lab";

/**
 * DEV-ONLY tuner for the page glow, the header glass and the card opacity.
 * The controls write CSS variables on <html>, so the real glow behind this page
 * changes live. 404s in production.
 */
export default function GlowLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GlowLab />;
}
