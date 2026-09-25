---
name: "Contract sweep refresh: what the mock-up drew that is not built"
number: 28
group: close
status: mock-up drawn twice 2026-09-21 · the core shipped the same day v2.3669 (the two doors, the Drive pass in the list, the contract field on the job) · the last four pieces redrawn 2026-09-22 after "is this the best we can do?" (`final-pass.html`) · PR 1 shipped v2.3703 (the tabs on the list, the header says each number once) · PR 2 shipped v2.3706 (the ways as one row, one primary, ⋯ More) · PR 3 shipped v2.3707 (the amount is the job's number, read out on the sweep and in the full editor; a draft typed earlier is named and blocked) · the scan's cost answered v2.3709 (one scan for the office, kept an hour; the walk eight wide) · the live look's two finds fixed v2.3713 (the save word on This job, the tabs wrap) · first look at the Drive finds 2026-09-24 (0 confident, 5 checks, two of them a contract for another address) — v2.3796 rules those out · left: the rest of the week
summary: >
  **The sweep asked how to get a signature before asking whether one is needed**, and "they
  already have a contract with us, in Drive" was a small footer link. v2.3669 made that a
  first-class door in the sweep and a field on the job, and has the sweep run its own Drive pass
  and hand over the link — pre-filled only when the matcher is confident. What the mock-up drew
  and the build left: the three signing ways as one compact switch, and the footer's secondary
  actions folded into ⋯ More. Two further owner asks, drawn the same day
  (`amount-and-tabs.html`): the contract **amount stops being a typed box** — it is the job's
  line-item total, read-only with a door to the line items, because a typed number lets the signed
  agreement and the bill disagree — and the **filter becomes tabs on the list**, with each count
  shown once. **Everything drawn is built** (v2.3703 · v2.3706 · v2.3707 · v2.3713); what is left
  is watching whether the Drive finds can be trusted — the first look (2026-09-24) found no green
  find yet and two amber ones pointing at paper for another address, which v2.3796 rules out.
next: >
  Use it for a week (from 2026-09-22). Watch one thing: whether "In Drive" finds are right often enough to trust the green ones
  (if so, the ⋯ batch-file stays useful; if not, tighten `driveContractMatch` again — the 2026-09-24 look already
  ruled out paper for another address, v2.3796). No green find has appeared yet; the first one decides. Then delete the folder.
size: XS — a week of use
blocker: A week of use. The amount ships with no typed override, as recommended — say so if one is ever wanted.
ver: v2.3669 · v2.3703 · v2.3706 · v2.3707 · v2.3709 · v2.3713 · v2.3796
opinion: your call — everything drawn is built, the scan's cost is answered and the first look at the finds is taken; what is left is the rest of the week, then deleting the folder.
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

1. **The signing ways as one compact switch** — shipped v2.3706: one row of three, a line under it
   for the chosen way and for the ways that are out (`docs/recent-features/v2.3706.md`).
2. **⋯ More in the footer** — shipped v2.3706: one primary; *Open the full editor* and the one-job
   send (while *& next* shows) under ⋯ More; *Fix email on the job* stays in the open.
3. **The scan's cost** — answered v2.3709 without waiting the week: the function keeps the last scan
   in `drive_contract_scans` and answers from it for an hour (one minute-long read for the whole
   office, not one per tab), the folder walk runs eight files wide, and the *Found in Drive* window
   reads the same scan with *read it again* instead of running its own
   (`docs/recent-features/v2.3709.md`).

4. **The amount follows the line items** — shipped v2.3707: the job's number read out with its source and one door, on the sweep and in the full editor; a draft typed earlier wears *Amount differs*, is out of Send all, and takes the job's number in one press (`docs/recent-features/v2.3707.md`).
5. **The filter as the list's tabs** — shipped v2.3703: tabs on the list, each count once, the header says only what the tabs cannot (`docs/recent-features/v2.3703.md`). The row wraps instead of clipping since v2.3713.
6. **From the 2026-09-22 live look** (*is this the best we can do?*) — shipped v2.3713: the *saves as you type* line moved off the read-only Amount onto the This job heading (`docs/recent-features/v2.3713.md`).
7. **The first look at the finds** — 2026-09-24, v2.3796: five In Drive rows, all amber, none green.
   Three were proposals (J651 *Shafiu Residence Plumbing Proposal*, J1044 *Proposal 2502001*, J583
   *Gun Dog Plumbing Proposal* — that one is the right job, the wrong paper). Two were signed
   contracts for **another address** in the same customer's folder — *105 Dover* offered to J950 at
   141 Encino, *9511 Arcade Ridge* to J1046 at 214 Beechwood. `driveContractMatch` now drops a job
   the paper's own street contradicts (`docs/recent-features/v2.3796.md`); the tab reads three rows.

## The final pass (`final-pass.html`) — drawn 2026-09-22

All four remaining pieces on one page — the whole pane as it will be, then each piece before and after, with the 2026-09-21 first pass and the critique that changed it (*Is this the best we can do?*) at the bottom. The changes it made: the amount is one line in the *This job* block, not a big number; no time-and-materials checkbox (a job with no amount already sends as T&M and already wears the chip); a draft typed earlier is a **flag** — amber chip, out of Send all, named in the footer, one click to take the job's number — not a warning box; no hint line under the tabs; the header repeats no count; the full editor gets the same read-out; *Fix email on the job* stays out of the ⋯ More menu.

## The amount and the tabs (`amount-and-tabs.html`) — drawn 2026-09-21, the first pass (both built: v2.3703 · v2.3707)

Two asks from screenshots in one session (the Lien desk clean-up session, which did not own this
modal and so left them here). Same modal, **two separate PRs**: the tabs are cosmetic; the amount
changes what the office can do.

### A · The amount is the job's number, not a box

**The ask.** *"If this number is set by the line items, perhaps we should not make it easy to
change as a whole number and the user should have to go in and adjust line items."*

**What is true.** It is set by the line items. `buildJobContractPrefill`
(`src/lib/jobs/jobContractDocument.ts`) takes the accepted estimate's `total_cents` when there is
one, else `jobs_ledger.revenue` — which the Job form writes as `revenueDollarsFromFixtures(fixtures)`
+ rider fees (`JobFormModal.tsx`). The sweep's **Amount** box (`aria-label="Contract amount"`,
`paneEdit.amountText` → `editedFields` → the draft's `fields.amount_cents`, autosaved) changes
**only the agreement**. Nothing writes back to the job and nothing compares the two, so a typed
$120,000 is a signed contract for $120,000 on a job that bills $123,600.

**The decision (proposed — the owner has seen the mock-up and asked for it to be parked here).**

- The amount is **read-only**, with its source beside it — *From the job's N line items* / *From
  the estimate the customer accepted <date>* — and a door: **Adjust line items ›** (`onEditJob`,
  already a prop; it opens the job) or *Open the estimate ›*. On return the pane re-reads the job.
- **Time and materials is a checkbox**, not an empty box with a placeholder (*Blank = time and
  materials* today). Ticked → `amount_cents: null`, and the pane says no fixed amount prints.
- **No line items** → *No amount* with **Add line items ›**; the row becomes Ready by adding line
  items or ticking T&M — today, by typing any number.
- **Drafts that already carry a typed amount** that differs from the job's are **flagged, never
  rewritten**: *This draft says $120,000 but the job's line items total $123,600* ·
  **Use the job's $123,600**. A `sent` draft stays locked exactly as now.

**Open — the owner's call.** *Any typed override at all?* Recommended: **none**. The one real case
for one is an agreement for the original scope on a job whose line items have since grown through
change orders; if that happens in practice, add an explicit *Agreement covers a different
amount…* that records a reason — adding it later is easy, removing it once people rely on it is
not.

**Where it plugs in.**

- New kernel, e.g. `contractAmountSource(job, acceptedEstimate, draftFields)` →
  `{ source: 'estimate' | 'line_items' | 'none', cents, lineCount, draftDiffersCents | null }` —
  pure, unit-tested; the pane only renders it. `buildJobContractPrefill` already knows the
  preference order; lift the amount half of it rather than restating it.
- `contractSweepRowState.ts` → `assessContractSweepRows`: `no_amount` is `!(revenue > 0)`, and
  `readyForBulk` needs an email, a non-thin scope, an amount and not a GC job. **A T&M row has no
  amount** — decide whether it may be bulk-sent (add a `timeAndMaterials` input so it is not
  `no_amount`) or stays a one-at-a-time send. Default: not in the bulk send; say so in the fragment.
- T&M needs a home in `JobContractFields` only if `amount_cents: null` is not enough to tell "T&M
  on purpose" from "nobody set it" — it probably is not. A `time_and_materials: boolean` in the
  draft's `fields` jsonb needs no migration; check `parseJobContractFields` and the document
  builder (`paymentTermsSentence`, the PDF) read it.
- The modal: `paneEdit.amountText`, `overrides[jobId].amountCents`, `editedFields`, the
  `sweep-save-state` span beside the box (it moves — scope and payment still autosave).
- The **full editor** (`JobContractModal` / *Open the full editor*) has its own amount field.
  Locking the sweep and leaving that one typed moves the hole one click away — do both, or say
  in the fragment why not.
- The list's amount column and the summary's `revenueTotal` already read `inputs[].revenue`; with
  no typed override they become the job's numbers again with no further change.

**Verify.** Kernel cases: estimate wins over line items; line items; none; a draft that differs; a
draft that matches; a sent draft. Render: no `Contract amount` textbox; the door calls `onEditJob`
with the job; T&M tick clears the amount and the row's state follows the decision above; the
differing draft shows the warning and *Use the job's* clears it. Live (dev login, prod data —
**do not send**): J523 Mission Hills reads $123,600 from its line items; pick a *no amount* row
under *Needs a look*; find a draft with an edited amount, if one exists
(`job_contracts.fields->>'amount_cents'` vs `jobs_ledger.revenue`, read-only through dev-mcp).

### B · The filter is the list's tabs, and each number appears once

**The ask.** *"This area doesn't look great, can we improve it?"* — the *To send · 27 / Needs a
look · 82 / All · 109* control at the top right.

**What is wrong.** (1) The summary and the control say the same numbers side by side (*109
without a contract … 82 need a look* / *All · 109 · Needs a look · 82*), while the one that
matters, ready to send, is only in the control. (2) It is a faint outline with no dividers; the
unselected options read as plain text. (3) It filters the list on the left but floats over the
agreement pane on the right.

**The decision (drawn).** The control becomes **tabs across the top of the list column** — equal
width, an accent underline and a raised ground on the selected one, the count in a badge, not
after a "·". The summary keeps only what the tabs do not say: **$1,307,528 of work has no
contract** as the headline, then the job count and *sent this sweep / filed / floor*. One line
under the tabs says what the selected group means — write it from the kernel's flags, not from
the mock-up's placeholder: *Ready* = a valid email, a real scope, an amount, and not a GC job;
*Needs a look* = any of `no_email`, `thin_scope`, `no_amount`, `gc_job`, and **Send all skips
them** (today that is only said inside the confirm dialog). *To send* is renamed **Ready to
send**, to match the green **Ready** chip on each row.

**Drawn before v2.3669 added *📄 In Drive*** — the mock-up includes it as a fourth tab. With four
on a phone, let the tab row scroll sideways inside the list rather than wrap.

**Where it plugs in.** `JobsContractSweepModal.tsx`: the `role="group" aria-label="Which rows to
show"` block and `segStyle`, the `sweep-summary` line above it, `shownFilters` / `filterLabel` /
`filterCounts`; labels in `CONTRACT_SWEEP_FILTER_LABELS` (`contractSweepRowState.ts`). The buttons
are `aria-pressed` today and the render test finds them by name — moving to `role="tab"` /
`aria-selected` changes those queries. Mobile (`isMobile`, `showList`) shows the list or the pane,
never both: the tabs belong to the list view.

**Verify.** Render: four tabs when the Drive pass found something, three otherwise; counts match
`filterCounts`; picking one filters the list and clears the selection as now; the hint follows
the tab. Live: desktop and 375px, light and dark; the summary no longer repeats a tab's number.

## How to verify

`docs/recent-features/v2.3669.md` → Verify. The two drawn pieces carry their own *Verify* above.
