---
name: add-ticket
description: Add a feature idea, fix or chore to Surflog's BACKLOG.md, or move one to Done. Use when Avery says "add a ticket", "add X to the backlog", "note this for later", "backlog: …", "remember to build X someday", or asks to tick off / list backlog items.
---

# add-ticket — keep BACKLOG.md current

`BACKLOG.md` (repo root) is Avery's list of future work. It's **local
only** — gitignored, never committed. It has four sections, in this
order: **Next up**, **Ideas**, **Chores**, **Done**. If the file doesn't
exist (fresh clone), create it with a `# Backlog` title and those four
empty sections.

## Adding an item

1. Read `BACKLOG.md` in full.
2. **Check for duplicates.** If an existing line already covers it, don't add
   a second one — update that line instead (add the new detail) and say so.
3. **Pick the section:**
   - **Next up** — only if Avery says it's next / soon / a priority.
   - **Chores** — maintenance, cleanup, setup, testing, tooling, deploys.
   - **Ideas** — everything else (the default for a new feature).
   If it's genuinely unclear, use Ideas and mention the choice.
4. **Write the line** in the file's existing format:
   `- [ ] **Short name** — one-line what/why.` (bold name optional for
   short items, matching neighbours). Wrap at ~76 chars with a two-space
   continuation indent. Keep it to 1–3 lines; longer reasoning or decisions
   belong in CLAUDE.md, not here.
   - Use Avery's own wording where possible; don't pad it into a spec.
   - Metric units, absolute dates (`2026-09-29`, from the system date),
     never "today".
   - No secrets (keys, tokens) even though the file is local.
5. Append at the **bottom of the chosen section** (newest last), keeping one
   blank line between sections.
6. Several items in one request → add each the same way.

## Marking done

Move the line to **Done**, change `[ ]` to `[x]`, and prefix the date:
`- [x] 2026-09-29 — <short name/description>`. Newest done at the bottom.

## Listing

When asked "what's in the backlog", summarise by section (Next up first),
one short line each — don't paste the file.

## Finish

- Reply in one or two lines: what was added/changed and which section.
- Never commit it or un-ignore it — it's deliberately local.
- Don't reorder or reword other items unless asked.
