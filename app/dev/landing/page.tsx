import { Landing } from "@/components/landing/landing";
import { toLandingSpot, type LandingSpot } from "@/lib/landing-spots";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";

/**
 * DEV-ONLY: the signed-out landing page ("/" without a session), so it can
 * be checked from a signed-in browser. Same component; sign-in is a no-op. The spot list is an example (no
 * database here): a handful of Taiwan spots from the static fixture plus some Siargao and Bali names, so the
 * worldwide grouping shows. The live page shows the whole catalogue.
 */
const TAIWAN_EXAMPLE = new Set(["wushi-north", "double-lions", "fulong", "jialeshui", "nanwan", "donghe", "jinzun"]);

const abroad = (country: string, area: string, spots: [slug: string, name: string][]): LandingSpot[] =>
  spots.map(([slug, name]) => ({ slug, name, country, area }));

const EXAMPLE_SPOTS: LandingSpot[] = [
  ...TAIWAN_SPOTS_FIXTURE.filter((s) => TAIWAN_EXAMPLE.has(s.slug)).map(toLandingSpot),
  ...abroad("Philippines", "Siargao", [
    ["cloud-9", "Cloud 9"],
    ["jacking-horse", "Jacking Horse"],
    ["quicksilver", "Quicksilver"],
    ["tuason-point", "Tuason Point"],
    ["stimpys", "Stimpy's"],
    ["pacifico", "Pacifico"],
  ]),
  ...abroad("Indonesia", "Bali", [
    ["uluwatu-suluban", "Uluwatu (Suluban)"],
    ["padang-padang", "Padang Padang"],
    ["impossibles", "Impossibles"],
    ["bingin", "Bingin"],
    ["dreamland", "Dreamland"],
    ["balangan", "Balangan"],
    ["echo-beach", "Echo Beach"],
    ["medewi", "Medewi"],
  ]),
];

export default function LandingPreviewPage() {
  return (
    <Landing
      spots={EXAMPLE_SPOTS}
      signInAction={async () => {
        "use server";
      }}
    />
  );
}
