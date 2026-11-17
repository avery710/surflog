# Sign in

Sign in presents the Surflog card with “Continue with Google”. Unsigned visits
to protected routes redirect here with a `callbackUrl`.

## Sub-features

- `signin-open` shows the sign-in card on `/signin`.
- `signin-redirect` sends an unsigned `/spots` visit to `/signin?callbackUrl=…`.
- `signin-google` starts the Google OAuth flow (real credentials only).

## How to get to it (user POV)

- Open `/signin`.
- Open a gated route such as `/spots` while signed out.
- Choose **Sign in** on the landing header (real `/`, not `/dev/landing`).

## Driving it with control-surflog

Preconditions:

- `control-surflog doctor` ok.
- Placeholder Google ids are enough to **render** the card; completing OAuth
  needs real `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and a browser Google login.

- **Open sign-in.** Run `control-surflog browser goto /signin`. Status 200.
- **Card.** Run `control-surflog browser wait --text "Continue with Google"` and `control-surflog browser text --role button --name "Continue with Google"`. The CTA is visible under the Surflog logo.
- **Gate redirect.** Run `control-surflog browser goto /spots` then `control-surflog browser eval 'location.pathname + location.search'`. Path is `/signin` and `callbackUrl` includes `/spots`.
- **OAuth (optional, full creds).** Click Continue with Google only when real OAuth is configured and `SURFLOG_VERIFY_HEADED=1`. Otherwise record skip: unmet Google credentials.
- **Proof.** Run `control-surflog browser screenshot --path .cursor/skills/verify-surflog/artifacts/sign-in/card.png` and `control-surflog browser aria --path .cursor/skills/verify-surflog/artifacts/sign-in/card.aria.txt`. Artifacts show Surflog and Continue with Google.

## Gotchas

- Clicking Continue with placeholder credentials leaves Google’s error page — not a Surflog regression.
- Staging may also sit behind Vercel Authentication; that wall is outside this local harness.
- `SIGNIN_ALLOWED_EMAILS`, when set, denies non-listed Google accounts after OAuth (`AccessDenied`).
