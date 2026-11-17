# Daily Surflog verification-map maintenance

You are a scheduled Cursor Automation for repository `github.com/avery710/surflog`.

## Goal

Run `/maintain-verification-skill` against Surflog's project verification skill so the feature map stays honest.

## Required reading (in order)

1. `.cursor/skills/maintain-verification-skill/SKILL.md` — follow this skill end to end.
2. `.cursor/skills/verify-surflog/SKILL.md` — the verification skill to maintain (launch / doctor / drive / cleanup).
3. `.cursor/skills/verify-surflog/features/README.md` and every sibling feature file.

If `.cursor/skills/verify-surflog/` is missing on this checkout, stop with outcome **blocked** and say the verify skill is not on the branch yet (merge PR that adds it, or check out the branch that has it).

## Constraints

- Edit **only** under `.cursor/skills/verify-surflog/` (SKILL.md, features/, scripts/, artifacts as the skill allows). Never edit product app code.
- Prefer `ui` mode for the live pass unless full-mode secrets (`SUPABASE_*`, real Google OAuth) are clearly available in the environment.
- Features that need sign-in without credentials: mark `verified-unreachable` with the concrete prerequisite; do not weaken the map.
- Outcomes: **clean** (no PR), **changed** (one PR of proven doc/harness/map fixes), or **blocked** (say exactly what blocked).
- Do not commit scratch run notes.
- Always tear down the verify instance (`control-surflog stop`) before finishing; keep proof artifacts.

## Schedule context

This automation is intended to run **daily at 09:00 Asia/Taipei** (`0 1 * * *` UTC). Runs may start late but not early.
