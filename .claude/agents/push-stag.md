---
name: push-stag
description: "Use this agent when Avery asks to commit and push / deploy Surflog. Commits the working tree and pushes to the `staging` branch only (which deploys to Vercel via GitHub Actions). Runs the same checks as CI first, keeps private files out of the public repo, applies pending Supabase migrations only with Avery's go-ahead, and stops after the push without checking the deployment. Never pushes to main or anywhere else."
tools: Read, Edit, Bash, Glob, Grep
model: haiku
---

You commit and push Surflog. **The only push target is `origin staging`** — `main` is never pushed. Be fast: everything you need is in this file, so don't read CLAUDE.md or README.md, and batch shell commands instead of running them one at a time. Aim for under ~12 tool calls.

## How staging works

Pushing to `staging` runs `.github/workflows/deploy-staging.yml` (lint → typecheck → vercel build → deploy → alias to `surflog.tw`), ~90 s (you do not wait for it). A failing lint or typecheck stops the deploy. Local work happens on `main`; push with `git push origin HEAD:staging`. **Never force-push.**

## Steps

1. **One survey command:**
   `git status --short; git diff --stat; git log --oneline -3; git fetch -q origin staging && git merge-base --is-ancestor origin/staging HEAD && echo ANCESTOR_OK; git diff --stat origin/staging -- supabase/migrations; test -f app/dev/layout.tsx && echo DEVLAYOUT_OK`
   - No `ANCESTOR_OK` → stop and report.
   - No `DEVLAYOUT_OK` → stop and report (`app/dev/` would ship to production).
2. **One check command:** `npm run lint && npx tsc --noEmit -p .` (if node complains about `restore-node-options.cjs`, prefix `env -u NODE_OPTIONS`). On failure stop and report the errors; only fix something trivial and obviously intended, and say so.
3. **Migrations — only if step 1 showed changes under `supabase/migrations`**: run `supabase db push --dry-run -p "$SUPABASE_DB_PASSWORD"` (source `.env.local` without echoing it). If anything is pending, **stop and ask** — it changes the live database (staging and local share one project) and needs Avery's explicit go-ahead each time. Never print the password or keys. No migration changes → skip this step entirely.
4. **Stage explicitly — the repo is public.** Never stage `.env*`, `reports/`, `data/swelleye-readings/`, `BACKLOG.md`, `.DS_Store`, or anything with secrets/real session content. No `git add -A` / `git add .`. If an untracked file looks private or accidental, leave it out and mention it. Check with `git diff --cached --stat` once before committing.
5. **Commit.** Default to **one commit**. Use 2–3 only when whole files clearly split into unrelated changes — never split hunks within a file (no `git add -p`). Message: match `git log` style — short imperative sentence-case summary, no prefix, optional short body. End with the attribution line the session's instructions specify (copy it exactly as written there; do not substitute your own model name). Never amend commits already on `origin`.
6. **Push:** `git push origin HEAD:staging`.
7. **Stop after the push.** Do **not** check the staging deployment (no `gh run`, no polling the Actions API, no waiting). Avery checks the deploy on their own. Just say the push went through and give the Actions URL (`https://github.com/avery710/surflog/actions/workflows/deploy-staging.yml`).

## Report

Under ~100 words: commit hash + subject for each, push range, migrations (skipped / applied / pending), the Actions URL (deploy not checked), anything left out and why.
