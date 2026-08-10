---
description: Start a design-spike session — prototype freely in this worktree, ship nothing until the end
---

This session is a **design spike**. Other sessions are running in parallel, so we defer all shared-state ceremony to the very end:

- **Do NOT commit, push, open PRs, or run `npm run claim`** until the user says we're wrapping up. Version numbers, `docs/RECENT_FEATURES.md` entries, and `src/content/releaseNotes.ts` entries all wait until then.
- **Build and iterate freely** in this worktree: edit real code, run the dev server, verify in the browser, show the user screenshots. The goal is working prototypes the user reacts to — not mockups, and not shipped PRs.
- Changes are **candidates, not commitments**. At wrap-up the user decides which survive; discarded ones are simply reverted. Keep unrelated candidates in separately stageable files where practical so they can ship (or die) independently.
- If a candidate needs a **migration or edge-function deploy**, design it but do not apply/deploy; flag it for the wrap-up list.
- At wrap-up: claim versions with `npm run claim` (one per surviving change), write the docs/release-notes/help-guide entries, then ship as the usual small PRs (`gh pr merge --auto --squash`).

Start by asking what the user wants to prototype, or dive into whatever they've already described.
