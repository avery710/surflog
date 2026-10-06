/**
 * The spot list shown on the signed-out landing page. The catalogue is
 * shared, non-personal data, so reading it for visitors is fine — but only
 * these five fields leave the server: no coordinates, no Swelleye fields,
 * no CWA township, no requests, nothing about who added what.
 */
import { unstable_cache } from "next/cache";
import { listSpots } from "@/lib/spot-store";
import type { Region, Spot } from "@/lib/spots";

export interface LandingSpot {
  slug: string;
  name: string;
  nameZh?: string;
  /** Taiwan spots only. */
  region?: Region;
  country: string;
  area: string;
}

export function toLandingSpot(s: Spot): LandingSpot {
  return {
    slug: s.slug,
    name: s.name,
    ...(s.nameZh ? { nameZh: s.nameZh } : {}),
    ...(s.region ? { region: s.region } : {}),
    country: s.country,
    area: s.area,
  };
}

const cached = unstable_cache(async () => (await listSpots()).map(toLandingSpot), ["landing-spots"], {
  revalidate: 3600,
});

/** Cached for an hour (the list changes rarely). Never throws: on any
 *  failure it returns null and the landing page simply hides the section. */
export async function getLandingSpots(): Promise<LandingSpot[] | null> {
  try {
    const spots = await cached();
    return spots.length > 0 ? spots : null;
  } catch (e) {
    console.warn("[landing] spot list unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}
