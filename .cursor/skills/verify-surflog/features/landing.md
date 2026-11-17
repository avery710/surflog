# Landing

Landing is the signed-out home page: Surflog brand, hero copy, demo dashboard /
session card / AI / spots / share sections, and a Sign-in CTA. It uses synthetic
demo data and never writes to the API.

## Sub-features

- `landing-open` loads the marketing page with the Surflog wordmark.
- `landing-hero` shows the hero title and a Sign-in control.
- `landing-demo-card` shows a read-only session card under “Conditions fill themselves”.
- `landing-dev-mirror` serves the same component at `/dev/landing` without auth.

## How to get to it (user POV)

- Open `/` while signed out.
- Open `/dev/landing` in a non-production local server (auth bypass in `proxy.ts`).

## Driving it with control-surflog

Preconditions:

- `control-surflog doctor` reports ok in `ui` or `full` mode.
- Prefer `/dev/landing` for ui-mode proof (no Supabase required). Signed-out `/`
  is also valid; its spot catalogue may be empty without Supabase.

- **Open landing.** Go to the page. Run `control-surflog browser goto /dev/landing`. Status 200 and the URL ends with `/dev/landing`.
- **Brand.** Confirm the wordmark. Run `control-surflog browser eval 'document.querySelector("img[alt=Surflog]")?.getAttribute("alt")'`. Result is `Surflog`.
- **Hero.** Confirm hero copy. Run `control-surflog browser wait --text "Conditions fill themselves"`. The conditions section title is visible.
- **Sign-in control.** Confirm the header CTA. Run `control-surflog browser text --role button --name "Sign in"`. The button is visible (on `/dev/landing` it is a no-op submit).
- **Demo session card.** Confirm a spot name from the demo card (may be below the fold). Run `control-surflog browser wait --text "Jialeshui" --state attached --scroll`. The page contains Jialeshui; scrolling brings a card into view when possible.
- **Proof.** Capture state. Run `control-surflog browser screenshot --path .cursor/skills/verify-surflog/artifacts/landing/hero.jpg` and `control-surflog browser aria --path .cursor/skills/verify-surflog/artifacts/landing/hero.aria.txt`. Both identify Surflog and the hero / conditions section.

## Gotchas

- Signed-out `/` calls `getLandingSpots()`; without Supabase the spots section hides — do not treat a missing spot count as a landing failure in `ui` mode.
- `/dev/landing` Sign-in buttons are intentionally inert; proving OAuth belongs in [sign-in.md](./sign-in.md).
- Language may be zh-TW from a shared profile; reset `surflog:lang` to `en` before English assertions.
- A root `loading.tsx` is intentionally absent; do not wait for a journal skeleton on the landing.
