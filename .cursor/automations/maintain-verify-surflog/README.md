# Automation: maintain verify-surflog

Daily Cursor Automation that runs `/maintain-verification-skill` on
`.cursor/skills/verify-surflog/`.

| Field | Value |
|-------|--------|
| Name | `maintain-verify-surflog` |
| Trigger | Scheduled — every day **09:00 Asia/Taipei** (`0 1 * * *` UTC) |
| Repository | `github.com/avery710/surflog` |
| Branch | `main` |
| Tools | Pull request creation (default); Memories optional |
| Instructions | Paste or reference [PROMPT.md](./PROMPT.md) |

Create or edit the live automation at [cursor.com/automations](https://cursor.com/automations).
Scheduled triggers default to no repository — set the Surflog repo + `main` explicitly.

This automation only becomes useful after `verify-surflog` is on `main`.
