---
name: Sample names left on a few screens
number: 337
group: ready
status: found 2026-11-13 by the names sweep (#7908 left them on purpose) · waits for #7872 to merge
summary: >
  The names sweep changed only comments in the source. Fourteen lines still hold a real-looking name as live text:
  seven sample subjects and names in the email catalog, one sample name in an email preview, two helper lines on the
  customer form, three placeholders, and one word in the contract match's list of ignored words. Thirteen can take
  the sweep's own made-up names. The fourteenth changes what matches, so it is the owner's call.
next: Once #7872 has merged, run the private rename list over the six files, keep the 13 lines, and fix any test that reads them. One PR.
size: XS (one PR)
blocker: PR #7872 merges first, so the tests and these screens use the same made-up names.
opinion: build — a sample on screen should never read like a real customer
mockup: not required — only sample names change
---

# Sample names left on a few screens (#337)

## Why

The repo is public. The names sweep for the code (#7908) rewrote comments and checked every changed line against the
TypeScript syntax tree. A change that touched a string, a template or JSX text was put back, so no word on screen
changed. That left fourteen lines where a real-looking name is live text.

## The lines

- `src/lib/emailCatalog.ts`: seven sample subjects and sample names.
- `src/lib/bids/bidRoomLinkEmailPreview.ts`: one sample name.
- `src/components/EditCustomerForm.tsx`: two helper lines under the form's ticks.
- `src/components/jobs/legal/AccountWriteDownPanel.tsx`, `src/components/jobs/legal/LegalAffidavitWindow.tsx` and
  `src/components/people/PeopleVehiclesTab.tsx`: one placeholder each.
- `src/lib/jobs/driveContractMatch.ts`: one word in `NAME_NOISE`, the words the contract match ignores. Changing it
  changes what matches. Leave it for the owner.

## The build (one PR, after #7872 merges)

1. The private rename list and its scripts live outside the repo, because they hold the old strings. The memory note
   `fixture-names-sweep-stream` says where, or see
   `~/Library/Application Support/Claude/side-session-notes/local_e8791a10-852a-4b7e-b9c1-561c4a25aca9/fixture-names-sweep/`.
   Never copy the list, or any old string, into the repo, a commit, a PR or a card.
2. Run `sweep.mjs` with `--write` over the first six files only. Read the diff: every changed line is one of the 13.
3. Grep the tests for each changed string, old and new, and fix any test that reads one. A render test may read a
   placeholder or a sample subject.
4. One release note and fragment that say only that sample names on a few screens are now made up.
5. Run the tests of the touched files, lint and typecheck.

## Also still holding old strings, each the owner's call (not this card)

- The help recordings: #336.
- The frozen aggregators: `docs/RECENT_FEATURES.md` and `src/content/releaseNotesArchive.ts`.
- `supabase/migrations/` (applied to prod), `supabase/functions/` (a change needs a deploy) and `supabase/seed.sql`.
- Four twin docs that ride the `twin-mcp` bundle: `docs/twins/EXTRACTOR.md`, `PLACEMENT.md`, `pricer.md` and
  `missions/estimator.md`. A change needs `node scripts/build-twin-mcp-briefs.mjs` and a deploy.
- The two scripts in `scripts/sweeps/`. Their file names hold a name too.
- The public billing template under `public/templates/`, which three tests read by its path.
- Pictures and PDFs under `docs/` and `to-dos/`.
- Git history.

## Done looks like

`count.mjs` over the non-test source files finds one line: the billing template's path. The PR is merged, and the
changed samples read right on the live site.
