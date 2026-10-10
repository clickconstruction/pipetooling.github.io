---
name: "What customers see: the bid room, portal and estimate samples, built through their kernels"
number: 103
group: ready
status: open · written 2026-10-09 from #62's next line · PR 1 is #5213 and PR 4 is #5218 (Helper 16, both armed) · PR 2 is #5219 (Helper 14, armed) · PR 3 not started
summary: >
  Settings → What customers see shows a sample bid room, a sample customer portal and a sample
  estimate. All three are written by hand in `_shared/customerSampleFixtures.ts`, while the real
  pages are built by kernels. So a sample can drift from the real page. The portal sample leaves
  out six sections a real portal sends, and the estimate sample never shows options. The
  submittal room's sample moved onto its kernel in v2.4595. These three follow it.
next: #5213 and #5218 merge, then one deploy run for both. PR 2, the portal's money, is #5219 (Helper 14). PR 3, the portal sections the sample leaves out, is not started.
size: S (PR 1, the bid room) · M (PR 2, the portal's money) · S–M (PR 3, the portal sections the sample leaves out) · S (PR 4, the estimate)
blocker: None. The rule is already set — samples are built only through the real kernels (#62, 2026-10-05, in GLOSSARY).
ver: v2.4595 · 4608
opinion: build — a sample is how the office learns a page, and a hand-written one drifts every time the real page changes.
mockup: not required — the sample pages render as they do today; only where their data comes from changes
---

# What customers see: the bid room, portal and estimate samples, built through their kernels

## The ask

Punch list #62 set the rule on 2026-10-05. Every "as they see it" view is one of three kinds. The third kind is a sample, and a sample is built only through the real kernels. It is never written by hand. A preview that can differ from the real thing is worse than none. The rule's home is `docs/GLOSSARY.md` → *What customers see (Settings)*.

The submittal room's sample moved onto its kernel in v2.4595. #62's next line left the rest as a row still to write: the bid room and the customer portal. The estimate was added on review. This is that row.

## What the samples are today

Both answer from their function's own sample branch. The answers are written in `supabase/functions/_shared/customerSampleFixtures.ts`.

### The bid room

`/bid-room?t=sample` is the open room and `sample-done` is the signed one.

- `sampleBidRoomResponse` writes the revision payload by hand. It copies `SAMPLE_BID.options` straight into `options`.
- A real payload is built by `buildBidRoomRevisionPayload` in `src/lib/bids/bidRoomPayload.ts` when the office publishes. `get-bid-proposal-room` reads it back through `parseSharedBidRoomPayload`.
- So nothing holds the sample to the builder's rules. It sets `header_brand` by hand. Its `add_ons` list is always empty, so the with-and-without alternates of v2.4197 never show. No option carries a `bid_version_id`.
- The one change order is written by hand as well. The real room reads its documents straight from `estimates`, with no kernel in between. That part can stay a fixture row in the same shape.

### The customer portal

`/portal?t=sample` is the homeowner, `sample-gc` the general contractor and `sample-owner` the owner of a job we build.

- `sampleCustomerPortalResponse` and `sampleOwnerPortalResponse` write every bill, waiver, test report and agreement by hand.
- Only the GC's stage rows go through a kernel, `gcPortalStages`. That is the call `customer-portal` makes for a real job.
- The real answer always sends six keys the homeowner and GC samples leave out: `sharedBills`, `propertyNotices`, `checks`, `promise`, `ownerRecords` and `gcJobs`. Of the six, the owner sample sends `gcJobs` alone. So the sample portal never shows the other sections.

### The estimate

`/estimate/accept?t=sample` is the open estimate and `sample-done` the thank-you page.

- `sampleEstimateResponse` writes the four lines and the total by hand. It sends `options: []`.
- So the estimate sample never shows options. There is no choice to pick and no add-on to tick, the Estimate Options train of v2.2457 to v2.2465.
- Its customer experience already goes through a kernel, `resolveEstimateCustomerExperience`.
- A real estimate's `options_snapshot` is written by `estimateOptionsDraftPersistFields` in `src/lib/estimates/estimateOptions.ts` when the office saves. The same kernel mirrors the recommended option into `line_items_snapshot` and `total_cents`. `get-estimate-for-customer` reads the options back through `normalizeSharedEstimateOptions`.

## Which kernel each should come through

| Sample piece | Kernel | File |
|---|---|---|
| The bid room's payload | `buildBidRoomRevisionPayload`, then `parseSharedBidRoomPayload` | `src/lib/bids/bidRoomPayload.ts`, `_shared/bidRoomPayload.ts` |
| Portal bills | `buildPortalBills` | `_shared/portalMergedBills.ts` |
| Bills another party pays | `buildPortalSharedBills` | `_shared/portalMergedBills.ts` |
| Lien waivers | `buildPortalWaivers` | `_shared/portalWaivers.ts` |
| Where the checks went | `buildPortalChecks` | `_shared/portalChecks.ts` |
| Notices on a property | `buildPortalPropertyNotices` | `_shared/portalPropertyNotices.ts` |
| Properties to ask about | `buildPortalProperties` | `_shared/portalProperties.ts` |
| Test report titles | `testReportTitle`, `testReportShortLabel` | `_shared/testReport.ts` |
| Agreement signer lines | `signerNamesLine`, `framesWaitingLine` | `_shared/jobContractSigners.ts` |
| The owner's GC jobs | `gcPortalJobs` | `_shared/gcPortal.ts` |
| The GC's stages | `gcPortalStages`, already | `_shared/gcStages.ts` |
| The estimate's options, lines and total | `estimateOptionsDraftPersistFields`, then `normalizeSharedEstimateOptions` | `src/lib/estimates/estimateOptions.ts`, `_shared/estimateOptions.ts` |

## Where it plugs in

- An edge function cannot import the bid room builder today. It lives in `src/lib/bids/`, and `_shared/bidRoomPayload.ts` holds only the parser. PR 1 moves the builder to `_shared/` so both sides call one copy. `src/lib/customerSampleEmails.ts` already imports `parseSharedBidRoomPayload` from `_shared/`. `bidRoomPayloadSharedParity.test.ts` already holds the two parsers together.
- The portal kernels already live in `_shared/`. The sample needs fixture rows in their input shapes: jobs, invoices, payments, releases and filings. The sample names stay in `_shared/customerSample.ts`: `SAMPLE_HOMEOWNER`, `SAMPLE_GC` and `SAMPLE_OWNER`.
- The estimate's persist kernel is client-only as well. PR 4 moves it to `_shared/estimateOptions.ts` beside the parser, the same move PR 1 makes for the bid room builder. `estimateOptionsSharedParity.test.ts` already holds the two parsers together.
- Deploys: `get-bid-proposal-room` after PR 1, `customer-portal` after PR 2 and after PR 3, and `get-estimate-for-customer` after PR 4. Run `npm run check:edge-drift` after each one.

## The plan

Where it stands on 2026-10-09: PR 1 is #5213 (v2.5105) and PR 4 is #5218 (v2.5112), both armed, with one deploy run owed after both merge. PR 2 is #5219 (v2.5110, Helper 14). PR 3 is not started.


1. **PR 1, the bid room (S).** The sample becomes `SAMPLE_BID`'s sections and one add-on. They run through `buildBidRoomRevisionPayload`, then `parseSharedBidRoomPayload`, as a real room does. The add-on makes the with-and-without alternate show. A new test holds the sample to the builder's output. Then deploy `get-bid-proposal-room`.
2. **PR 2, the portal's money (M).** Bills, shared bills, waivers and checks come from fixture rows through their kernels. This covers the homeowner, the GC and the owner. Then deploy `customer-portal`.
3. **PR 3, what the sample leaves out (S–M).** Property notices, properties, test report titles, signer lines, the promise, owner records and the owner's GC jobs come through their kernels. Each section a real portal can show appears on the sample at least once. Then deploy `customer-portal`.
4. **PR 4, the estimate (S).** The sample becomes options, a recommended choice, a second choice and an add-on. They are saved through `estimateOptionsDraftPersistFields` and read back through `normalizeSharedEstimateOptions`, as a real estimate is. Then deploy `get-estimate-for-customer`. It does not wait on PR 2 or PR 3.

## How to verify

- Before and after each PR, open the sample on Settings → What customers see, on a phone and a desktop. Every figure the old sample showed is the same, or the PR says why it changed.
- Each sample gets a test that runs the kernel on the fixture rows and compares the result with the function's sample answer. `src/lib/submittals/sampleSubmittalRoom.test.ts` from v2.4595 is the pattern.
- After each deploy, open the sample token on the live site. `npm run check:edge-drift` reads the function current.

## Not in this card

The same file writes other samples by hand: the sub portal, the job contract, the contract, the RFQ quote page and the legal portal. Each can be its own row when someone wants it. The estimate sample is in this card, as PR 4.
