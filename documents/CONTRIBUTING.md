# Contributing to The 75 Project

Thanks for helping build this. This doc is the whole process — short on purpose, since the goal is friends actually shipping PRs, not navigating bureaucracy.

## Getting set up
Follow `SETUP.md` first — you'll need your own Supabase project (or access to the shared dev one), Google OAuth test access, and the two VLM keys before the app runs locally. Note this is a monorepo (`backend/` + `mobile/`, Section 2 of `SETUP.md`) — one clone gets you everything.

## Branching
- `main` is protected — no direct pushes, everything lands via PR.
- Branch off `main` per change: `feature/short-description`, `fix/short-description`, `chore/short-description`.
- When a change is scoped to just one side of the monorepo, say so in the name — `backend/jwt-verification`, `mobile/lab-batch-prompt` — it makes review faster for whoever's picking it up.
- Keep branches focused on one thing — easier to review, easier to revert if something's wrong.

## Commits
Loose [Conventional Commits](https://www.conventionalcommits.org/) style is enough — not enforced by a bot, just a shared habit:
```
feat: add worst-case burndown calculation
fix: quorum not reverting after dispute threshold crossed
docs: update RLS policy examples in SETUP.md
```

## Opening a pull request
Every PR description should cover:
1. **What changed and why** — a sentence or two is fine.
2. **How you tested it** — which device/emulator, offline behavior if relevant, screenshots for any UI change.
3. **Linked issue**, if one exists.

## Review
- At least one other person's approval before merging — even a quick "looks good, tested on my phone" counts.
- **PRs touching migration logic, the schema mapping in SRS Section 6, or anything under a `migration/` path need two reviewers, not one, and must include the result of running the migration against a real legacy dataset (SETUP.md Section 10), not just a fresh test fixture.** This is the one place where being extra careful is worth the friction — it's real people's real attendance history.
- If you're the only one around when something's ready, self-review against the PR description above before merging — don't skip the checklist just because no one else is online, but do flag migration-touching changes for review before merge even if that means waiting.
- Be direct about problems, kind about how you say it. Nobody's shipping this for a grade.

## Code style
- ESLint + Prettier on the `mobile/` side, `ruff`/`black` on the `backend/` side — config lives in the repo, run it before pushing.
- Match the patterns already in the file you're editing over introducing a new one, unless you're proposing to change the pattern itself (open an issue for that first).

## Issues and labels
- `bug`, `enhancement`, `question`, `good-first-issue` (for anything a new contributor can pick up without deep context on the sync engine or the regulation-profile logic), `migration` (anything touching Section 6 of the SRS — always gets the two-reviewer rule above regardless of size).
- If you're picking up a `good-first-issue`, comment first so two people don't duplicate the work.

## The one hard rule
Never commit a real secret, key, or credential — see `SETUP.md` Section 9. This includes JWT secrets and signing keys, not just the usual API keys. If you're not sure whether something's sensitive, ask before pushing rather than after.

## Code of conduct
Be respectful, assume good faith, keep feedback about the code and not the person. If this project grows past "friends we already know," adopting the [Contributor Covenant](https://www.contributor-covenant.org/) wholesale is a reasonable next step rather than writing one from scratch.
