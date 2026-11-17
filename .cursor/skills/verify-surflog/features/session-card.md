# Session card

The session card (`EntryCard`) shows spot, time, board/goal chips, notes, tags,
condition tiles (swell, period, wind, water temp, tide chart), and media. The
canonical multi-case surface is `/dev/session-card` with synthetic sessions.

## Sub-features

- `card-full` renders a full Open-Meteo + CWA case (Jialeshui).
- `card-tiles` shows condition figures in mono.
- `card-edit-open` opens the edit panel from the ⋯ menu (Save hits real API and fails unsigned — expected on `/dev`).

## How to get to it (user POV)

- Open `/dev/session-card` on a local non-production server.
- On the signed-in journal, scroll the session list (requires auth — see journal-log).

## Driving it with control-surflog

Preconditions:

- `control-surflog doctor` ok (`ui` mode is enough).

- **Open showcase.** Run `control-surflog browser goto /dev/session-card`. Status 200.
- **Full case.** Run `control-surflog browser wait --text "Full data — Jialeshui"`. The first case heading is visible.
- **Spot on card.** Run `control-surflog browser wait --text "Jialeshui"`. At least one card shows the spot.
- **Tide chart.** Run `control-surflog browser eval 'document.querySelectorAll("svg[role=img]").length'`. Result ≥ 1 (tide charts use `role="img"`).
- **Proof.** Run `control-surflog browser screenshot --path .cursor/skills/verify-surflog/artifacts/session-card/full.png` and `control-surflog browser aria --path .cursor/skills/verify-surflog/artifacts/session-card/full.aria.txt`. Artifacts show the Full data case and Jialeshui.

## Gotchas

- Cases are stacked in iframes at some widths (`frame/`); if a wait misses, scroll or widen — the harness defaults to 1280×850.
- Edit / Delete / upload inside the card call real `/api/*` and 401 when unsigned; treat that as known `/dev` limit, not a card render failure.
- Do not assert against Avery’s live journal from this feature file.
