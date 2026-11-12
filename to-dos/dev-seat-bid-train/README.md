# The bid train: hand-off kit (not for merging)

This branch, `claude/bid-train-handoff`, only carries the working scripts of the dev seat's bid train so a session on any computer can pick the train up. **Never merge it.** The plan is `to-dos/mcp-servers.md` → "The bid train"; the state is the punch list card `to-dos/dev-seat-bid-train.md` on main.

## What is where

| Thing | Where |
|---|---|
| PR 3, takeoff, built | draft PR #7717, branch `claude/dev-seat-bid-takeoff` |
| PR 4, labor, kernel drafted and untested | branch `claude/dev-seat-bid-labor-draft` (one commit on top of takeoff's): `supabase/functions/_shared/devMcpBidLabor.ts` |
| The scripts below | this folder |

## Why scripts

Every seat PR moves the same shared lines: `SERVER_VERSION`, the verb count in words and digits, the `restRows(` count, the instructions line, a README row, GLOSSARY and ACCESS_CONTROL sentences. Another seat PR landing first makes all of them conflict. The cure that worked five times on 2026-11-11: **take main's copy of every shared file and run the scripts again**, never hand-resolve.

## Bringing a seat PR up to main (the recipe)

From the PR's branch, with a clean tree:

1. `git fetch origin main` and read main's pins: `SERVER_VERSION` in `supabase/functions/dev-mcp/index.ts`, the words in `Writes are <N> verbs and nothing else`, and the count of `restRows(` in that file.
2. `git merge origin/main`. Expect conflicts in the pins.
3. Take main's copy of every shared file, conflicted or not:
   `git checkout origin/main -- supabase/functions/dev-mcp/index.ts supabase/functions/_shared/devMcpWrites.ts docs/dev-mcp/README.md docs/GLOSSARY.md docs/ACCESS_CONTROL.md docs/EDGE_FUNCTIONS.md to-dos/mcp-servers.md scripts/edge-kernels.mjs src/lib/gc/edgeKernels.test.ts src/lib/devMcp src/lib/photos/boxPhotoRefile.test.ts`
   (the PR's own new files under `src/lib/devMcp` and `_shared` are not in main, so they stay).
4. Run the PR's splice scripts again, then the pins. For takeoff, with main at version `M`, count word `W`, digits `D`, restRows `R`, and the new values `M+1`, `W+2`, `D+2`, `R+5`:
   - `node scripts/wire-takeoff-edge.mjs && npm run gen:edge-kernels`
   - `node scripts/wire-takeoff.mjs`
   - `node scripts/bump.mjs <M> <M+1> <W> <W+2> <D> <D+2> <R> <R+5>`
   - the one pin outside the folder: `src/lib/photos/boxPhotoRefile.test.ts` holds `SERVER_VERSION = '0\.NN\.0'` as a regex; move it by hand or with sed.
   - `node scripts/fix-tv3.mjs` (the rpc-null verb list in `devMcpWrites.test.ts`)
   - `node scripts/docs-takeoff.mjs <M+1> <W> <W+2> "<main's last 'N since vX…' phrase in the README, without its closing bracket>" <the version main's GLOSSARY sentence says 'since'>`
   - the PR's own test expects `since v2.6968's bid takeoff` in the README; it needs no edit.
   Every script throws when an anchor is not found exactly once. That is the signal that main changed a sentence: read main's sentence and fix the anchor, do not force it.
5. Check: the seat's test folder plus every test that reads the docs or the kernel copy, the kernel copy check, the function link check, the typecheck:
   - `npx vitest run $(grep -rlE "EDGE_FUNCTIONS\.md|GLOSSARY\.md|ACCESS_CONTROL\.md|dev-mcp/README|edge-kernels|to-dos/|recent-features|releaseNotes/|gcKernels|_shared/devMcp|dev-mcp/index|twin-mcp/index" src scripts --include="*.test.ts" --include="*.test.tsx")`
   - `npm run gen:edge-kernels -- --check` · `npm run check:edge-bundles` · `npm run typecheck` (read the log for `error TS`) · `npm run check:todos`
6. Stage the named files (never `git add -A`), commit the merge, push with a plain `git push` (no rebase, no force), then `gh pr merge <n> --auto`.
7. A push is refused while the PR sits in the merge queue: wait for the queue to drop it, then push and re-arm.

`wire-counts.mjs`, `docs-counts.mjs` and `resolve3.mjs` are PR 2's scripts and PR 1's resolver, kept as patterns for PR 4's and PR 5's.

## After a seat PR merges

1. `git checkout --detach origin/main`, confirm `SERVER_VERSION`, then `supabase functions deploy dev-mcp --project-ref yewfzhbofbbyvkvtaatw` (a worktree needs `supabase/.temp` copied from the main checkout).
2. `scripts/seat.sh whoami '{}' 20000` (it reads `PT_DEV_MCP_TOKEN` from the environment and never prints it): the server version and the new verbs listed.
3. `npm run check:edge-drift`. Each seat PR adds file names to the kernel copy's index header, so `customer-portal`, `drive-link`, `gc-trade-portal` and `photo-save` read as behind: deploy each, check drift again, and probe each with an OPTIONS request for a 200.
4. A dry run on b398 "ZZ Test" with `seat.sh plan_… '<json>'`. b398 has versions and a job, so it shows the per-GC refusal and reads a real sheet. A live `apply_` on prod was refused by the session's permission layer on 2026-11-11: ask the owner before one.

## Type-checking the function without deno

`typecheck-shim/`: copy `tsconfig.template.json` to a scratch folder as `tsconfig.json`, replace `REPO` with the checkout's absolute path and `SHIM` with the folder holding `deno.d.ts`, then `npx tsc -p <that tsconfig>`. Six errors are old and not ours (the `unpdf` and `pdf-lib` modules, `sha256Hex`, two `'f' is possibly null`, one `JobRow`); anything else is new.
