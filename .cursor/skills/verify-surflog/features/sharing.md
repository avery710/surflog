# Share a session

From a session card's `⋯` menu (`aria-label` `Session actions`) choose `Share`. The dialog is titled `Share this session` (`components/share-dialog.tsx`). It draws a PNG in the browser and can publish a link.

## Sub-features

- Image style group `aria-label` `Image style`: `Strip`, `Column`, `Card`. Color mode `Light` / `Dark`. Toggles under `Show` for date, wave data, board, and log. At least one must stay on (`Turn at least one thing on.`).
- Image language `English` / `中文` for the PNG only. It does not change the page language.
- `Save image` / `Copy image`. The PNG is produced by `lib/share-image.tsx`. Goal ticks are never drawn. Notes are wrapped by `lib/share-text.ts`.
- Public link: label `Share link`, switch `#share-link-switch`. Off by default. On, a readonly input `aria-label` `Public link` shows `{origin}/share/<token>`. `Copy link` copies it. Turning the switch off deletes the row and the URL 404s immediately.
- Public page `/share/<token>` does not use `EntryCard`. Media is served from `/api/share/<token>/media/<blobId>`, not from `/api/blob/:id` (that route stays owner-only).
- Preview image for chats: `/share/<token>/card.png` is `no-store`.

## How to get to it (user POV)

Sign in, find one of your own sessions (log one first if the journal is empty — then delete it at the end, which also removes the share). Open `Session actions`, click `Share`. Turn on `Share link`, copy the public URL, open it in a second tab that has no cookie, then turn the link off and reload the public tab.

## Driving it with Chrome

Needs a signed-in owner and one session that belongs to them. If there is no session, run the sessions journey far enough to create one, and delete that session at the end of this one. If sign-in is impossible, stop. Do not drive `/dev/share` and call it published: that page does not write `session_shares`.

1. Open `Session actions` on the chosen card and click `Share`. Dialog title `Share this session` is visible. The switch `#share-link-switch` is unchecked and the copy says the link is off (`Only you can see this session` is the off description's opening).
2. Click `#share-link-switch`. Wait until the public-link input is populated. The value matches `/^https?:\/\/[^/]+\/share\/[A-Za-z0-9_-]{20,128}$/`. `GET` that path with **no** cookie returns 200 and shows the spot name. `GET /share/<token>/card.png` with no cookie returns 200 and `content-type` image.
3. Toggle a `Show` checkbox off and on. The preview image updates (its request URL or the `<img alt="Preview of the share image">` changes). The dialog does not close.
4. Turn `#share-link-switch` off. The UI says the link is off. `GET` the same `/share/<token>` path, still with no cookie, returns 404.
5. If the session was created for this run, delete it from `Session actions` → `Delete` and confirm it is gone from `GET /api/sessions?page=1`.

**End state.** A share token was issued, the public page and `card.png` loaded without a cookie, and after the switch was turned off that URL 404'd. No share row remains. The session is either the owner's pre-existing one, untouched apart from the share toggle, or a probe session that has been deleted.

## Gotchas

- Token is stored in plaintext so the owner can copy it again. Evidence must not include a still-valid token. Turn the link off before the run ends, and do not paste a live token into a committed file. `evidence/` is gitignored; keep it that way.
- Unknown tokens and turned-off tokens both 404. A 404 alone does not prove the toggle worked; the 200-then-404 pair does.
- `/api/blob/:id` without the owner cookie is not the public media path. A 401 or 404 there is expected and is not a share failure.
- Share images request font subsets at draw time. If the font host is unreachable the image route returns 503 and there is no fallback font. Record the 503; do not substitute a screenshot of `/dev/share`.
- The public page must not show goal ticks, tags (tags are off the public page by default), or another user's sessions.
- Per-IP rate limit in `proxy.ts` returns 429. Back off; do not hammer `/share/`.
