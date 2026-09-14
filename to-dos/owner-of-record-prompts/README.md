# Owner of record, asked at the right moment — three prompts so no lien notice is ever blocked on a missing owner

Status: **not started** · planned 2026-09-14 · mock-up drawn 2026-09-14 for the owner's review before the build ([`mockup.html`](./mockup.html) — the three moments on today's seven desk jobs, the critique, the plan; also a Claude artifact) · the prerequisite for [`gc-on-notice/`](../gc-on-notice/README.md) and the daily blocker on the Lien desk (every one of the seven jobs due on 2026-09-15 sat in *Needs the owner*) · build the Fix-ups count first (smallest piece; clears today's pile)

## The ask, in the owner's words

> To send those 9 notices I would first have to have the right property records and names of owners saved for all those locations. Where in this pipeline should I add a prompt to offer that?

## The reading

- The § 53.056 notice goes to the **owner of record** at a mailing address; without one the desk cannot mail, and the Lien window's affidavit gate stops too. Today the owner is entered on the property record (Customers → Properties, or Edit Job → Property record since v2.3401) — three doors from the Pipeline, and nobody is prompted.
- The app already does the hard part: the property record's **paste-the-CAD-page** box (`cadPagePaste.ts`) picks out the owner name, mailing address, legal description and the homestead exemption from a copied appraisal-district page, and `CustomerPropertyRecordPanel` runs the parcel lookup (county, legal) as it opens. So a prompt is one paste, not a form.
- The owner belongs to the **property**, not the job: RMC Dudley Mason's 16 jobs sit at a handful of addresses; one paste covers every job at an address, now and later.
- A builder entered as the customer with no GC set reads as "we contracted with the owner" and gets no monthly-notice clock at all; the same prompt should ask which it is.

## The decision — three moments, each lighter than the last

1. **When a job is created (or edited) with a GC on it — ask once, on the job form.** Beside the contract question (the v2.3385 door), when a GC is set: *"Who owns the site? Paste the county's page for <job address>"* with the appraisal-district link for the property's county and the paste box inline; a saved paste creates or fills the property record and links the job (the v2.3401 add-as-property path). Skipping is allowed. When the **customer is a builder and no GC is set**: *"Is <customer> the owner of this site, or building it for someone?"* — the second answer sets the GC on the job (which also fixes the notice clock).
2. **When the job is Working — the Pipeline's Fix-ups card.** `buildPipelineFixups` gains **`no-owner` — "No owner of record · N"** counting jobs with a GC (or a builder customer), approved hours, and no owner on the property record or the job override; the chip opens a fix-it list (job · address · county · CAD link · paste box per row — the same list the GC-on-notice modal's Step 1 uses). The card disappears when the data is clean, like the others.
3. **When the first bill goes out on a GC job — a quiet line in Bill Customer.** *"No owner of record on file — the lien notice for this job cannot be mailed until there is one."* with the same paste door. Never a block: a late bill is worse than a late owner.

The Lien desk's *Find the owner ›* stays as the exception.

Rejected: a hard block on Working or on billing; asking per job instead of per property; a free-text owner box (the paste is faster and gets the legal description too).

## Where it plugs in

| Exists | New |
|---|---|
| `src/lib/customers/cadPagePaste.ts`, `propertyLookupClient.ts`, `propertyRecord.ts`, `CustomerPropertyRecordPanel`, `CustomerPropertySheet`, `JobFormPropertyAddSheet` + `JobFormEditFactRows` (Property record row), `job_property_owners`, `customer_addresses.owner_*`, `pipelineOverview.ts` (`buildPipelineFixups`: no-customer · no-pictures · no-email), the Pipeline's Fix-ups card and its fix-it lists, `SendRecordInvoiceModal` (Bill Customer), the desk's `list_lien_notice_months().has_owner` | a job-form prompt component (`JobFormOwnerPrompt`) reusing the paste box; the builder-as-customer question; `no-owner` in `buildPipelineFixups` (+ the count from a small RPC or the existing lien RPCs' `has_owner`); an `OwnerFixupListModal` (job · address · county · CAD ↗ · paste), shared with `gc-on-notice` Step 1; the Bill Customer line |

## The plan

1. **PR 1 — the Fix-ups count and the list.** `no-owner` in `buildPipelineFixups` (+tests), the count (jobs with a GC or builder customer, approved hours, no owner), the fix-it list modal with the paste box per row writing the property record and linking the job. Clears today's pile in one sitting.
2. **PR 2 — the job-form prompt.** The owner question beside the contract door when a GC is set; the builder-as-customer question that sets the GC.
3. **PR 3 — the Bill Customer line.**
4. Guide: *file a lien and never miss its deadlines* → "Save the owner once, at the start"; the Fix-ups card's help text.

## Open decisions

- Should the card count every GC job with approved hours and no owner (wider than the desk's 30-day notice window), or only the desk's due items? Proposed: the wider count — the point is to have the owner before the window opens.
- Should the Fix-ups count include **Waiting** jobs with a GC (before any hours)? Proposed: no — hours are what the lien clock runs on.
- Should the job-form prompt fire for **every** new job, or only when a GC is set / the customer is a builder? Proposed: only those.
- When the CAD paste names a **homestead**, should the prompt say so on the spot ("a homestead lien needs a recorded pre-work contract — talk to the attorney before starting")? Proposed: yes, one line.

## How to verify

Dev login → Jobs → Pipeline: the Fix-ups card shows *No owner of record · N* equal to the desk's *Needs the owner* count; the chip's list shows each job's address and county with the CAD link; pasting a CAD page on a row saves the property record, links the job, and the row (and the desk's row) moves. New Job with a GC set shows the owner prompt; a builder customer with no GC shows the who-owns-the-site question and setting "building it for someone" fills the GC. Bill Customer on a GC job with no owner shows the quiet line. Prod-safe: pastes write real property records — use TEST jobs for the live pass.
