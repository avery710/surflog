# Spots

The spots catalogue (`/spots`) lists the worldwide break list with search,
region groups, and optional pins. Signed-in only.

## Sub-features

- `spots-list` shows the catalogue and a spot count.
- `spots-search` filters by name.
- `spots-pin` toggles a private pin (max 50; needs migration).

## How to get to it (user POV)

- Sign in, open **Surf spots** from navigation / `/spots`.
- From a session or “What you've surfed”, open a spot’s detail page
  (`/spots/<slug>`).

## Driving it with control-surflog

Preconditions:

- `full` mode launch, healthy `/api/health`, signed-in Chrome profile.
- `control-surflog doctor` ok.

- **Open list.** Run `control-surflog browser goto /spots`. Wait for text `Surf spots`.
- **Count.** Run `control-surflog browser eval 'document.querySelector("[data-testid=spot-count]")?.textContent'`. Result matches `N spots` with N > 0.
- **Search.** Fill the search box (`aria-label` from `picker.search` — English “Search”). Type `Jialeshui`. Wait for Jialeshui row; count may show a match fraction.
- **Pin (disposable account only).** Toggle pin on a row; reload and confirm the Pinned section. Unpin afterward.
- **Proof.** Screenshot + aria under `artifacts/spots/`.

If unsigned, `/spots` redirects to sign-in — that proves the gate, not the
catalogue. Report catalogue verification as blocked without auth.

## Gotchas

- Pinning without migration `20261009100000` shows “not switched on yet”.
- “Near me” requests geolocation only on tap — do not grant location in CI unless required.
- Spot admin create/delete is admin-email only (`SPOT_ADMIN_EMAILS`).
