---
name: "Edge functions: the kernel copy rides a function file by file, so dev-mcp keeps its headroom"
number: 359
group: waiting
status: carded 2026-11-14 from a read of today's main after v2.7256 · nothing built · the trigger is dev-mcp's upload passing 4.3 MB, which `check:edge-bundles` prints on every run
summary: >
  v2.7256 took the whole database types file out of every edge upload: dev-mcp went from 5.02 MB,
  which the deploy refused, to 4.03 MB, and the eight portals from about 4.1 MB to about 3.0 MB.
  CI now holds each upload under 4.5 MB. Read on 2026-11-14, dev-mcp has about 0.5 MB of headroom
  and a verb pair adds about 0.15 MB, so three or four more dev-seat PRs reach the ceiling. Of its
  4.03 MB, 0.86 MB is its own (the tool descriptions in index.ts, 474 KB, and the generated
  catalog, 386 KB), 2.84 MB is the kernel copy and _shared, and 0.32 MB is the slim types file.
  The copy is already imported by file, not through its barrel, and dev-mcp still reaches 131 of
  the copy's 352 files, because small helpers import big neighbours: devMcpBill reaches the portal
  translations (portalI18n, 125 KB) through customerLang for one constant, and
  devMcpAffidavitDraft reaches the slim types through lienProperty for a type. The fix is to cut
  those chains, not to re-export less.
next: Build when dev-mcp's upload passes 4.3 MB, or before a dev-seat PR that would take it there. Step 1, read-only, lists every kernel-copy file dev-mcp reaches with the chain that reaches it (`edgeUpload('supabase/functions/dev-mcp/index.ts').via(path)` in `scripts/lib/edgeUploadGraph.mjs`) and sorts them by what a cut would save. Step 2 cuts the chains worth more than 50 KB each, one PR per cut, each a kernel split with its tests moved and every old import kept through a re-export; the first two are customerLang off portalI18n and lienProperty off the slim types. Step 3, if still needed, moves the tool descriptions out of dev-mcp's index.ts into a resource the server reads, and trims the catalog to the names the verbs use.
size: S to read · S per cut, two or three cuts · M for the descriptions and the catalog if it comes to that
blocker: none; it waits on dev-mcp's growth, so that a cut lands before the ceiling and not after a refused deploy
opinion: cut the chains, never raise the ceiling, since the wall at 5 MB is Supabase's; the portals get the same cuts for free
mockup: not required — a refactor of imports and files with no screen
---

# Edge functions: the kernel copy rides a function file by file, so dev-mcp keeps its headroom (#359)

## Where it stands (2026-11-14)

A note from an earlier session said dev-mcp was at 4.71 MB and that the fix was to stop the kernel copy pulling in the 1.46 MB database types file. v2.7256 (#8101, merged 2026-11-14) did that: the copy carries a slim `types/database.ts` holding only what the copy names, `gen-types` rewrites it, and `check:edge-bundles` walks each function's upload as the CLI does and fails a PR past 4.5 MB of raw source. Measured on `main` at v2.7277 with `node scripts/lib/edgeUploadGraph.mjs`:

| Function | Before v2.7256 | 2026-11-14 |
|---|---|---|
| dev-mcp | 5.02 MB | 4.03 MB · 243 files |
| customer-portal, sub-portal and the six other portals | about 4.1 MB | 2.94 to 3.01 MB |
| bridge-weekly-sheet | 2.34 MB | 1.18 MB |

So the note's fix is done and its number is stale. What is left is headroom: dev-mcp sits 0.47 MB under the CI ceiling and about 1 MB under the wall the deploy refused at. #8089 (v2.7247, the affidavit draft pair) added 0.15 MB, and two trains are adding dev-seat verbs this week.

## What dev-mcp carries

| Part | Size |
|---|---|
| Its own files: `index.ts` 474 KB (the tool descriptions), `catalog.ts` 386 KB (generated) | 0.86 MB |
| The kernel copy and `_shared`: 131 of the copy's 352 files, the `devMcp*` modules | 2.84 MB |
| The slim types file | 0.32 MB |

The copy is already imported by file path, never through `gcKernels/index.ts`. The reach comes from chains inside the copy, three of which carry the biggest files:

- `portalI18n.ts` (125 KB, the portal's translations) ← `lib/messages/customerLang.ts` ← `devMcpBill.ts` ← `index.ts`. `customerLang` imports one constant and a type from it.
- `types/database.ts` (322 KB) ← `lib/jobs/lienProperty.ts` ← `devMcpAffidavitDraft.ts`. A type-only import, which the CLI uploads all the same.
- `lib/submittals/procurementLog.ts` (54 KB) ← `devMcpSubmittals.ts`, which does use it.

## The build, when it comes

1. **Read.** For dev-mcp, list every copy file reached with its chain (`edgeUpload(...).via(path)`) and the bytes a cut would save: a file reached only through one import that uses a sliver of it. Put the list on this card.
2. **Cut the chains over 50 KB**, one PR each. A cut is a kernel split: the sliver (a constant, a type, a two-line helper) moves to a small file of its own in `src/lib`, the old file re-exports it so no import in the app changes, `scripts/edge-kernels.mjs` carries the new file, and the importer in the copy points at the small file. Tests move with the code. The first two are `customerLang` off `portalI18n` and `lienProperty` off the slim types. The eight portals take the same cuts for free where they share the chain.
3. **Only if still needed**, move the tool descriptions out of `dev-mcp/index.ts` into a resource the server reads at boot, and have `build-dev-mcp-catalog.mjs` write only the tables and functions the verbs name.

Never raise `UPLOAD_CEILING_BYTES`: it is 0.5 MB under Supabase's wall on purpose, so a PR fails before a deploy does.

## How to read it any day

```bash
node scripts/lib/edgeUploadGraph.mjs
```

prints every function largest first; `node scripts/lib/edgeUploadGraph.mjs dev-mcp` prints one. `npm run check:edge-bundles` prints the five biggest on every run and fails past the ceiling.
