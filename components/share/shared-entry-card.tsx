"use client";

import { EntryCard } from "@/components/entry-card";
import { FixedLanguageProvider, type Lang } from "@/lib/i18n";
import { SpotCatalogProvider } from "@/lib/spot-catalog";
import type { PublicShare } from "@/lib/share-public";

const noop = () => {};

/** The public share page's session card: the journal's own EntryCard,
 *  read-only (no ⋯ menu, nothing calls the API), drawn from the allow-listed
 *  `PublicShare.card` with its media through the token-scoped route. */
export function SharedEntryCard({
  card,
  lang,
  mediaBase,
  byline,
}: {
  card: PublicShare["card"];
  lang: Lang;
  mediaBase?: string;
  /** "Surfed by …", shown under the spot name. */
  byline?: React.ReactNode;
}) {
  return (
    <FixedLanguageProvider lang={lang}>
      <SpotCatalogProvider
        spots={card.spot ? [card.spot] : []}
        requests={[]}
        onAdd={noop}
        onReplace={noop}
        onRemove={noop}
        onRequestChanged={noop}
      >
        <EntryCard
          session={mediaBase ? card.session : { ...card.session, photos: [] }}
          boards={card.board ? [card.board] : []}
          onUpdated={noop}
          onDeleted={noop}
          readOnly
          mediaBase={mediaBase}
          byline={byline}
          plain
        />
      </SpotCatalogProvider>
    </FixedLanguageProvider>
  );
}
