---
name: "Edge functions: the kernel copy rides a function file by file, so dev-mcp keeps its headroom"
number: 359
group: ready
status: building since 2026-11-14 (the owner asked for it ahead of the 4.3 MB trigger) · step 1 read · PR 1 (v2.7288, #8145) the copy's index trimmed to what is read through it, the portals 3.0 → 1.6 MB · PR 2 (v2.7289) customerLang off portalI18n, dev-mcp 4.03 → 3.91 MB · PR 3 (v2.7290) SendPurpose off quo/send, dev-mcp 3.82 MB · PR 4 (v2.7291) OverheadPartsDetailLine off the overhead reads, dev-mcp 3.75 MB · PR 5 (v2.7292) FormValues and the GC entity's name in files of their own, dev-mcp 3.70 MB · PR 6 (v2.7293) the copy inlines a row alias where a kernel names it, dev-mcp 3.40 MB and no slim types · next the four portal kernels written plain so the portals drop the slim file too
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
next: PR 7, the four portal kernels whose Database uses are not plain aliases (drawRows, changeOrderOfficeRows, legalRoute, customerContactDisplay) written as aliases, so the portals drop the slim file too (−315 KB each). Step 3 (the descriptions and the catalog) is not due: dev-mcp is 3.40 MB, under the 3.5 MB line.
size: S to read · S per cut, two or three cuts · M for the descriptions and the catalog if it comes to that
blocker: none; it waits on dev-mcp's growth, so that a cut lands before the ceiling and not after a refused deploy
opinion: cut the chains, never raise the ceiling, since the wall at 5 MB is Supabase's; the portals get the same cuts for free
mockup: not required — a refactor of imports and files with no screen
---

# Edge functions: the kernel copy rides a function file by file, so dev-mcp keeps its headroom (#359)

## Where it stands (2026-11-14, evening)

**Step 1 is read**, on main at v2.7278, with two scratch scripts over `edgeUploadGraph`: one scores every import edge in a function's upload by the bytes the upload loses when that edge alone is cut (a file reached two ways scores nothing on either), the other lists every function that uploads a file and the importers inside each upload. The full tables are in the session notes; what matters:

| Saves | Cut | Who |
|---|---|---|
| 1.37 MB a portal | **The copy's index.** Five files outside the copy import it (`gcCustomerSchedule`, `gcTradePortalSchedule`, `gcTradePortalSample`, drive-link, photo-save), using 15 of its 130 entries; every other entry is read by path by its own function, yet the index exported it, so every portal uploaded the morning run, My email, the Monday email and the rest. | 14 functions: customer-portal 3.01 → 1.64 MB, the rest 2.7–3.0 → 1.3–1.6 MB. **PR 1, v2.7288.** |
| 127 KB | `messages/customerLang.ts` → `gc/portalI18n.ts` (122 KB) for `PORTAL_SPANISH_ON` and `type PortalLang`; `quickReplies/language.ts` takes the type too | dev-mcp; quo-send (122 KB, through bio, jobModeText, techSend) |
| 84 KB | `quo/textsSwitch.ts` → `quo/send.ts` for `type SendPurpose`, which drags events, textOut, boxes, thread | dev-mcp |
| 74 KB | `overheadPartsAccountingBuckets.ts` → `overheadOfficePartsReads.ts` for `type OverheadPartsDetailLine`, which drags inKind, paging, errorHandling and a slim-types import | dev-mcp |
| 26 KB | `_shared/messagesEmail.ts` → `gcCustomerEmails.ts` for one constant | dev-mcp, messages-email |
| 22 KB | `_shared/hoursStatementForm.ts` → `formSchema.ts` for `type FormValues` | dev-mcp, accept-contract, hours-statement-signing |
| 31 KB | `submittals/procurementLog.ts` → `parseFixtureSchedule.ts` for `normalizeTag` | dev-mcp alone, under the 50 KB bar |
| 315 KB | **The slim `types/database.ts`.** Not one chain: nine files in dev-mcp import it, every one `import type { Database }` for a Row (lienProperty, costEstimateDirectCosts, overheadOfficePartsReads, lienDeadlines, lienDesk, submittalRevision, bidPricingEngineTypes, types/bids, laborRowHours), and five in the portals (boardRows for `Json`, drawRows, changeOrderOfficeRows, legalRoute, customerContactDisplay). Cutting lienProperty alone saves nothing. | dev-mcp and the portals, once every importer stops naming the whole file |
| 377 KB + 463 KB | dev-mcp's own `catalog.ts` and the tool descriptions in `index.ts` | step 3 |

The slim-types design put to the owner: a folder `src/types/rows/` of one-line alias files (`export type CustomerAddressRow = Database['public']['Tables']['customer_addresses']['Row']`), each importing `Database` in src, which the generator writes into the copy with the body inlined from the parts it already reads and refuses with any other line; the importers switch to them and re-export. Projected dev-mcp: about 3.70 MB after PRs 2–5, about 3.38 MB with the slim types gone.

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

## The build

1. **Read** (done 2026-11-14, above). For dev-mcp, list every copy file reached with its chain (`edgeUpload(...).via(path)`) and the bytes a cut would save: a file reached only through one import that uses a sliver of it. Put the list on this card.
2. **Cut the chains over 50 KB**, one PR each, the index first (PR 1, v2.7288). A cut is a kernel split: the sliver (a constant, a type, a two-line helper) moves to a small file of its own in `src/lib`, the old file re-exports it so no import in the app changes, `scripts/edge-kernels.mjs` carries the new file, and the importer in the copy points at the small file. Tests move with the code. The first two are `customerLang` off `portalI18n` and `lienProperty` off the slim types. The eight portals take the same cuts for free where they share the chain.
3. **Only if still needed**, move the tool descriptions out of `dev-mcp/index.ts` into a resource the server reads at boot, and have `build-dev-mcp-catalog.mjs` write only the tables and functions the verbs name.

Never raise `UPLOAD_CEILING_BYTES`: it is 0.5 MB under Supabase's wall on purpose, so a PR fails before a deploy does.

## How to read it any day

```bash
node scripts/lib/edgeUploadGraph.mjs
```

prints every function largest first; `node scripts/lib/edgeUploadGraph.mjs dev-mcp` prints one. `npm run check:edge-bundles` prints the five biggest on every run and fails past the ceiling.
