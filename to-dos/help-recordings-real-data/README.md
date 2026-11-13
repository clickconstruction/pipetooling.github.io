---
name: Help recordings that show real data
number: 336
group: ready
status: found 2026-11-13 by the names sweep's read of the recordings · not started
summary: >
  Twenty of the 44 screen recordings in the help guides show real-looking customers, builders, job names, streets and
  other details on screen. They ship on the public site. The names sweep rewrote the guides' words (#7906) and read
  every recording, but changed none. This card takes the twenty out of their guides until they are re-recorded on
  test data.
next: Take the twenty recordings out of their guides and delete the files, in one PR. Re-record the ones worth keeping later, on test data only.
size: S (one PR)
blocker: None. The list of which twenty is private and lives on the Mac that ran the audit (see below).
opinion: build — real customers' details stay on the public site until the files go
mockup: not required — recordings are removed; no screen changes
---

# Help recordings that show real data (#336)

## Why

The repo and the help guides are public. The standing rule: no real customer, owner, builder or job name, street,
email, job number or dollar figure in anything public. The names sweep rewrote text only: #7872 for the tests, then
#7906 to #7909 for the help guides, the release notes, the comments in the code and the docs. It also read the
recordings in `public/help/` frame by frame, and changed none of them.

## What was found

- 44 recordings. 24 are clean: test bids, the sample portal, demo data.
- 13 show a name from the sweep's private list on screen.
- 7 show other real-looking names.
- Some of the twenty show more than a name.

Which twenty, and what each one shows, is kept out of the repo on purpose: a public list would point at the very
files. It is in the audit note `gif-audit.md`, in the notes folder of the session that ran the sweep:
`~/Library/Application Support/Claude/side-session-notes/local_aae9235d-7cf0-49f4-9e23-3998fa67f857/`. The memory
note `fixture-names-sweep-stream` points there too. So this card needs the Mac that ran the audit, not a cloud session.
Never copy that note's contents, or which recording shows what, into the repo, a commit, a PR or a card.

## The build (one PR)

1. Take the twenty file names the audit marks SHOWS or OTHER NAMES. Leave the 24 it marks CLEAN alone.
2. For each one: remove its `{{gif:…}}` token from every guide in `src/content/help/` that uses it, and `git rm` the
   file from `public/help/`. Where a sentence points at the recording, reword it so the guide reads right without it.
   Put no static image in its place (`docs/HELP_MEDIA_PLAN.md`).
3. In the status table of `docs/HELP_MEDIA_PLAN.md`, mark each removed recording as a re-take due on test data. Say
   nothing about what the old one showed.
4. One release note and fragment that say only that some guide recordings were taken out until they are re-recorded
   on test data.
5. Run the four guide tests (`helpGuideContent`, `helpGuidePlainWords`, `helpGuideLinks.guides`,
   `helpShareCard.guides`), lint, typecheck and `npm run build`.

## Then

- Re-record the ones worth having, from the read-only training account on test data (`docs/HELP_MEDIA_PLAN.md`).
- Git history keeps the old files. Taking them out of history is a separate call for the owner.

## Done looks like

No guide names a removed file. The twenty files are gone from `public/help/`. The four guide tests pass. On the live
site, each changed guide opens with no broken recording.
