# Surflog verification map

Maintained source for verifying Surflog's user-facing behavior. Read this
index, then the matching feature file.

## Baseline preconditions

- Launch with `control-surflog launch --port 3456` (`ui` mode) unless the
  feature file requires `full` / signed-in.
- Run `control-surflog doctor` and require `"ok": true`.
- English UI: if the Chrome profile has `localStorage.surflog:lang = "zh-TW"`,
  set it back to `"en"` before asserting English strings
  (`control-surflog browser eval 'localStorage.setItem("surflog:lang","en")'`
  then reload).
- Never drive an instance that was not started by this verification run.
- Default evidence dir:
  `.cursor/skills/verify-surflog/artifacts/<feature-id>/`.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names (`Sign in`, `Continue with Google`,
  `Log a session`) over CSS position.
- Treat every command as literal.
- Run browser actions through `control-surflog browser`.
- Run HTTP checks through `control-surflog http get`.
- Restore seeded / disposable data after a mutation. Keep proof artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the Surflog logo
  (or `alt="Surflog"`) visible.
- Mutation proof includes a second read of the stored value (reload or list).
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the unmet precondition. Do not claim a
  skipped signed-in entry point was verified via `/dev`.

## Feature entry contract

Each feature file: H1 + one paragraph, then exactly these H2s in order:

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with control-surflog`
4. `Gotchas`

## Features

- [Landing](./landing.md) — signed-out marketing page and `/dev/landing` mirror.
- [Sign in](./sign-in.md) — Google sign-in card and redirect gate.
- [Session card](./session-card.md) — `EntryCard` showcase on `/dev/session-card`.
- [Journal log](./journal-log.md) — signed-in “Log a session” dialog (needs OAuth).
- [Spots](./spots.md) — signed-in spot catalogue `/spots` (needs OAuth + Supabase).
