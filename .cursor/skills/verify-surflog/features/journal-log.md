# Journal log

Signed-in users open **Log a session** from the header `+` (or `?log=1` on `/`)
to save spot, time, duration, tags, notes, and media. Conditions attach at save
time via Open-Meteo / CWA.

## Sub-features

- `log-open` opens the log dialog from the header control.
- `log-save` persists a session and shows it in the list.
- `log-future-blocked` refuses a future start time.

## How to get to it (user POV)

- Sign in, open `/`, choose the header control labeled **Log a session**.
- On sub pages, the same control opens the global log dialog.
- Visit `/?log=1` (optional `&spot=<slug>`).

## Driving it with control-surflog

Preconditions:

- `control-surflog launch --mode full` with real Supabase + Google OAuth.
- Chrome profile has a completed Google session for a **disposable** account
  (or Avery’s account with mandatory cleanup).
- `control-surflog doctor` ok and `/api/health` 200.

- **Open journal.** Run `control-surflog browser goto /`. After auth, the page is the journal (not landing). Wait for `Days in the water` or `What you've surfed`.
- **Open log form.** Run `control-surflog browser click --role button --name "Log a session"`. A dialog appears with Spot / date / notes fields (`form.spot`, notes labeled `Notes`).
- **Fill and save (disposable only).** Choose a catalogue spot, keep a past/now half-hour slot, set notes to `verify-surflog probe`, save. Wait for the dialog to close and the list to show the notes.
- **Confirm persistence.** Reload `/` and wait for `verify-surflog probe`.
- **Cleanup.** Delete the probe session via the card ⋯ → Delete confirm.
- **Proof.** Screenshots of open dialog and post-save list under `artifacts/journal-log/`.

If Google OAuth is unavailable, **stop and report failure**: precondition unmet.
Do not weaken the journey to `/dev` and call it journal-log verified.

## Gotchas

- Date/time are fixed after create; duration is also fixed after create.
- Future sessions are rejected (now-at-spot + 15 minutes).
- Tags migration must be applied or saving tags errors with “not switched on yet”.
- Never leave probe sessions in production (`tosozexlcqedocfcckwh`).
