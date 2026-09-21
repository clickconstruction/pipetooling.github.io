---
name: "Contract sweep refresh: what the mock-up drew that is not built"
group: close
status: mock-up drawn twice 2026-09-21 (the second pass after "is this the best we can do?") · the core shipped the same day v2.3669 — the two doors, the Drive pass in the list, the contract field on the job · left: two cosmetic pieces and a week of use
summary: >
  **The sweep asked how to get a signature before asking whether one is needed**, and "they
  already have a contract with us, in Drive" was a small footer link. v2.3669 made that a
  first-class door in the sweep and a field on the job, and has the sweep run its own Drive pass
  and hand over the link — pre-filled only when the matcher is confident. What the mock-up drew
  and the build left: the three signing ways as one compact switch, and the footer's secondary
  actions folded into ⋯ More.
next: >
  Use it for a week. Watch two things: whether "In Drive" finds are right often enough to trust
  the green ones (if so, the ⋯ batch-file stays useful; if not, tighten `driveContractMatch`), and
  whether the 66-second scan is worth running on every first open. Then the two cosmetic pieces if
  wanted, and delete the folder.
size: S (the two cosmetic pieces)
blocker: A week of use.
ver: v2.3669
opinion: later — what changes what the office can do is shipped; what is left is tidying two render-tested controls.
---

# Contract sweep refresh

## The ask

The owner, 2026-09-21, with a screenshot of the sweep:

> "I don't think this modal is as good as it could be. Could you please take a look and come up
> with a refreshed mock-up. After you build that mock-up, could you ask yourself is this the best
> we can do? And one feature that I think is important is some of these people do have contracts
> with us and there should be a field to upload a link to the contract as it is stored in Google
> Drive. And then in the edit job modal, there should be a field for their contract."

## What was true

Both asks already existed and could not be found — a footer link (*Already signed? File it*) and an
Edit Job row whose only button was **Send contract**. Both write `job_contracts.signed_document_url`
through `fileSignedJobContract`, which is the right home: the sweep, every chip, the nudges and
Bill Customer read that record. **No second field on the job** — it would fall out of step.

## The two passes (`mockup.html`)

The first pass made the door first-class but was still a paste box: open Drive, search, copy, come
back, paste — per customer — while the app already had a Drive scanner under ⋯. It also drew a
button that revealed a field in Edit Job (the ask was a field), hid Preview PDF in a menu, and
showed the amount three times. The second pass — what is in the file, with the first collapsed
under it — has the sweep run the Drive pass itself and hand over the link.

**What the live data then taught the build**: a "check" find is often wrong (*"Plumbing Proposal
REVISED.pdf"*, a folder 23 jobs matched). Pre-filling it lit **File it & next** on the wrong paper.
Only a confident find pre-fills; a check find waits for **It is — use this file**. The mock-up's
amber *in Drive? check* row shows the chip but not this step — the code is the authority.

## Shipped (v2.3669 — `docs/recent-features/v2.3669.md`)

The pane's job header · the two doors (a builder's row and a found row open on *We already have
one*) · the Drive pass on open, cached 15 minutes, *checking Drive…* meanwhile · the list chip, the
header clause and the **In Drive** tab · the pre-filled filing sheet with an empty-or-file date ·
the contract field and **Open the contract ↗** on the job · the label column and the chip line.

## Left

1. **The signing ways as one compact switch** (mock-up §1): three tall radio cards → a three-way
   segmented control with a one-line explanation of the chosen way. `JobsContractSweepModal`'s
   `sweep-signing-ways` block; the render test selects the ways by `role="radio"`, so keep the
   radio semantics (a segmented control can be a radiogroup).
2. **⋯ More in the footer**: *Open the full editor · Email it and stay on this job · Fix the email
   on the job* behind one button; **Preview PDF** stays visible. The footer's buttons carry
   `data-testid`s the render test reads.
3. **Decide about the scan's cost** after a week: 66 s and up to 20 000 files per uncached open.
   Options if it is too much: run it only when the *In Drive* tab or the *We already have one* door
   is first touched; or a nightly scan into a table the sweep reads.

## How to verify

`docs/recent-features/v2.3669.md` → Verify.
