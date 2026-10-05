"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { TAIWAN_SPOTS_FIXTURE } from "./spot-fixtures";
import { isRequestSlug, requestSlug, REQUEST_SLUG_PREFIX, type Spot } from "./spots";
import type { SpotRequest } from "./spot-requests";
import type { Lang } from "./i18n";

/**
 * The one catalogue the UI reads: every spot of the `spots` table (loaded
 * once per page in app/page.tsx), plus the viewer's own spot requests, so
 * sessions logged against a pending request (`req:<id>`) still show the name
 * they typed. spotBySlug-style lookups are synchronous, so client components
 * go through this instead of importing a list. Without a provider (landing
 * page, /dev showcases) it is the demo fixture only — see lib/spot-fixtures.ts.
 */

/** A request the viewer made — only what logging against it needs. */
export type OwnRequest = Pick<SpotRequest, "id" | "name" | "status" | "spotSlug">;

interface Catalog {
  /** Every spot. */
  spots: Spot[];
  /** The viewer's own spot requests (any status), newest first. */
  requests: OwnRequest[];
  /** The viewer is a spot admin (SPOT_ADMIN_EMAILS): may add/edit/delete spots. False without a provider. */
  canManage: boolean;
  /** Spot by slug; `req:` and `custom:` values have no Spot. */
  bySlug: (slug: string) => Spot | undefined;
  /** Display name. A `req:<id>` slug shows the requested name; "custom:" free
   *  text and unknown slugs fall back as before. */
  label: (slug: string, lang?: Lang) => string;
  addSpot: (spot: Spot) => void;
  replaceSpot: (spot: Spot) => void;
  removeSpot: (slug: string) => void;
  /** A request was just created (or resolved) — keep the list current. */
  upsertRequest: (request: OwnRequest) => void;
  /** Open the "request a spot" dialog (mounted by the journal); undefined where there is none. */
  requestSpot?: (query: string) => void;
}

const noop = () => {};

type Actions = Pick<Catalog, "addSpot" | "replaceSpot" | "removeSpot" | "upsertRequest" | "requestSpot">;

function build(spots: Spot[], requests: OwnRequest[], canManage: boolean, actions: Actions): Catalog {
  const map = new Map(spots.map((s) => [s.slug, s]));
  const reqById = new Map(requests.map((r) => [r.id, r]));
  return {
    spots,
    requests,
    canManage,
    bySlug: (slug) => map.get(slug),
    label: (slug, lang = "en") => {
      if (!slug) return "Unknown spot";
      if (slug.startsWith("custom:")) return slug.slice(7);
      if (isRequestSlug(slug)) return reqById.get(slug.slice(REQUEST_SLUG_PREFIX.length))?.name ?? "Requested spot";
      const spot = map.get(slug);
      if (!spot) return slug;
      return lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name;
    },
    ...actions,
  };
}

const DEMO = build(TAIWAN_SPOTS_FIXTURE, [], false, {
  addSpot: noop,
  replaceSpot: noop,
  removeSpot: noop,
  upsertRequest: noop,
});
const Ctx = createContext<Catalog>(DEMO);

export function SpotCatalogProvider({
  spots,
  requests,
  canManage = false,
  onAdd,
  onReplace,
  onRemove,
  onRequestChanged,
  onRequestSpot,
  children,
}: {
  spots: Spot[];
  requests: OwnRequest[];
  canManage?: boolean;
  onAdd: (spot: Spot) => void;
  onReplace: (spot: Spot) => void;
  onRemove: (slug: string) => void;
  onRequestChanged: (request: OwnRequest) => void;
  onRequestSpot?: (query: string) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () =>
      build(spots, requests, canManage, {
        addSpot: onAdd,
        replaceSpot: onReplace,
        removeSpot: onRemove,
        upsertRequest: onRequestChanged,
        requestSpot: onRequestSpot,
      }),
    [spots, requests, canManage, onAdd, onReplace, onRemove, onRequestChanged, onRequestSpot]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSpotCatalog = () => useContext(Ctx);

/** The slug a session stores for a pending request. */
export { requestSlug };
