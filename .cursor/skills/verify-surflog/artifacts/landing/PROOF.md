# Landing proof (seed run)

Captured 2026-11-17 by exercising `.cursor/skills/verify-surflog` end to end:

1. `control-surflog launch --port 3456 --mode ui`
2. `control-surflog doctor` → ok
3. Drove [landing](../../features/landing.md) on `/dev/landing`
4. `control-surflog stop` — evidence retained

Stand-in notes (this Cloud Agent VM): app `npm install` already run; harness
used placeholder Google OAuth ids and no Supabase (`ui` mode). `/api/health`
503 is expected. Signed-out `/` with live spot catalogue and signed-in journal
journeys were **not** exercised in this seed proof.
