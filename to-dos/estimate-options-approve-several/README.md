---
name: "Estimate options: approve more than one"
group: ready
status: PR 1 open 2026-09-17 (#3328 — the kernels, the column, the four functions; ships dark) · PRs 2–3 built next on stacked branches · no owner review of the design yet
summary: >
  **Estimate options: approve more than one.** Every option on an estimate is an alternative
  today — radio cards, one Approve, one option frozen — so a customer who wants the heater
  *and* the softener *and* the hose bibs cannot approve them together, and the office cannot
  record that they did. Proposed: each option is offered either as *one of the choices*
  (today) or as an *add-on* (tick any); the customer page shows *Choose one* and *Add to it*;
  acceptance freezes every accepted option's lines into the same fields every downstream
  reader already uses. Taunya's "5 separated" case is an all-add-on estimate. One additive
  migration, four edge functions redeployed. Mock-up in the folder.
next: >
  PR 2 the customer page, PR 3 the office builder (each live-tested); confirm the case with
  Taunya in one message (see Open questions); then delete this folder.
size: M
blocker: None. The owner's two calls (forecast floor vs ceiling; whether add-ons may be pre-ticked) change one constant each and can land after PR 3.
ver: mock-up 09-17
---

# Estimate options: approve more than one

## The ask, in the owner's words

Taunya, 2026-09-17, an in-app request: *"Reminder to fix Estimates and the ability to approve
more than 1 option."*

Second time the same wall: on 2026-09-01 she asked for more than four options because a
customer was *"asking for 5 separated"* — the ceiling went 4 → 6 (v2.2586) but the options
stayed alternatives. "Five separated" reads as five independent scopes the customer might take
several of, not five versions of one job. The word *fix* is read as this same friction; no
other open Estimates bug was found in the to-dos or the fragments (see Open questions).

## What exists

Estimate Options shipped 2026-08-28 (v2.2457 schema + builder, v2.2460 the customer flow,
v2.2462 activity + the acceptance record). The design is deliberately single-choice:

- `estimates.options_snapshot jsonb` — `[{ key, name, description, recommended, line_items }]`,
  exactly one `recommended`; `estimates.accepted_option_key text` stamped at acceptance.
- The customer page renders `EstimateOptionsPicker` as a `radiogroup`; the Approve button
  names one option (*Approve "Replace 50-gal" — $3,400.00*); the POST carries one `optionKey`.
- `accept-estimate` requires the key when 2+ options exist (`400 option_required` /
  `option_unknown`) and **freezes** that one option: lines → `line_items_snapshot`, sum →
  `total_cents`, key → `accepted_option_key`. Everything downstream (the accepted document, the
  PDF, `createJobFromEstimateSubmit`, the Pipeline, `JobSignedAgreementModal`) reads the frozen
  fields and never looks at the snapshot again. **That freeze is what makes this change small.**
- Pre-acceptance the legacy fields mirror the RECOMMENDED option (owner decision 3, v2.2457), so
  list rows and Pipeline sums have a number before the customer decides.
- The Bid Room (v2.2470) shares the *shape* — base + alternates, "in lieu of the base" — with its
  own payload (`bidRoomPayload.ts`) and its own freeze in `sign-bid-room`. Out of scope here.

## The decision (proposed — the owner has not reviewed it)

**Each option carries a kind.** `kind: 'choice' | 'add_on'`, absent = `'choice'`, so every
existing snapshot and every existing estimate behaves exactly as today.

| | Choices | Add-ons |
|---|---|---|
| Customer page | *Choose one* — radio cards, exactly one, the ★ pre-selected (today's picker) | *Add to it* — checkbox cards, any number, none pre-ticked |
| Rule | Required when the estimate has 2+ choices | Optional when choices exist; when **every** option is an add-on, at least one tick is required |
| Approve label | *Approve "Replace 50-gal" + 2 add-ons — $5,740.00* · all-add-on: *Approve 3 options — $9,050.00* · nothing ticked: disabled, *Choose at least one option* | |
| The freeze | `line_items_snapshot` = the accepted options' lines in offered order (flat); `total_cents` = their sum; **new** `accepted_option_keys text[]` = the accepted keys in offered order; `accepted_option_key` = **the chosen choice, null when the estimate had no choice group** (one rule; the two old readers are updated in PR 3 and read the list first) | |
| Forecast (pre-accept mirror) | Unchanged: the ★ option's total. An all-add-on estimate keeps the star on one card for this reason (**owner call**: floor = the starred option, or ceiling = every option; recommended floor — add-ons are upside, not forecast) | |
| Email | Every option's price as today; add-ons under their own sub-heading with a `+` | |
| Activity feed | `option_viewed` per key, unchanged | |
| Acceptance record | *Accepted "Replace 50-gal" + 2 add-ons · $5,740.00 (of 4 offered)*, then *Add-on: …* and *Not chosen: …* lines | |

Why per-option kind and not a per-estimate *pick one / pick any* switch: the mixed case is the
common one (a base you choose between, plus extras), and the switch would need two estimates
for it. The switch is the same as "every option is an add-on", which the kind expresses.

Rejected: nested options (an add-on that belongs to one choice only — the estimate is not a
configurator; if a softener only fits the replacement, the office writes that in the pitch);
per-option quantities; a separate `estimate_add_ons` table (options live inside the row on
purpose — one quote number, one token, one signature); changing the Bid Room's alternates
(construction alternates are additive as often as not, but that is a different document with
its own decision — noted as a follow-on below).

## The mock-up

[`before-after.html`](./before-after.html), drawn 2026-09-17 from the real component styles.
Four boards:

1. **Before** — the customer page today: four radio cards, one Approve; the softener and the
   hose bibs cannot ride with the heater.
2. **After, mixed** — *Choose one* (Repair · Replace ★) and *Add to it* (softener ✓ · hose bibs
   ✓); the total card and Approve sum to $5,740; the line items grouped by option.
3. **After, all add-ons** — five separate scopes, no *Choose one* group, three ticked;
   Taunya's case.
4. **After, the office** — the option-card strip with each card's kind, the *Offered as*
   segmented switch under the name field, and the acceptance record.

Read the page's *Assumptions* block before building — the Approve wording and the grouped
line-item display are placeholders for the owner's pick.

## Where it plugs in

No new table, so no read-only RLS re-appliers. One additive column. Four edge functions.

| Exists | Change |
|---|---|
| [`estimateOptions.ts`](../../src/lib/estimates/estimateOptions.ts) (client kernel, 13 tests) — `EstimateOption`, `normalizeEstimateOptionsFromJson`, `freezeAcceptedEstimateOption(options, key)`, `estimateOptionsDraftPersistFields`, `setRecommendedEstimateOption`, `MAX_ESTIMATE_OPTIONS = 6` | `kind` on the type (normalize: anything but `'add_on'` → `'choice'`); `estimateOptionsSelection.ts` — `isValidEstimateSelection(options, keys)` (exactly one choice key when choices exist; ≥ 1 key overall), `toggleEstimateOption(options, keys, key)` (a choice replaces the other choice, an add-on toggles), `defaultEstimateSelection(options)` (the ★ choice, no add-ons); `freezeAcceptedEstimateOptions(options, keys)` → `{ line_items_snapshot, total_cents, accepted_option_keys, accepted_option_key }`; the single-key freeze stays as a one-element wrapper |
| [`_shared/estimateOptions.ts`](../../supabase/functions/_shared/estimateOptions.ts) (server twin, dependency-free) + [`estimateOptionsSharedParity.test.ts`](../../src/lib/estimates/estimateOptionsSharedParity.test.ts) | The same additions; parity test covers `kind` normalization and the multi-key freeze byte for byte |
| Migration (number from `origin/main`'s latest; `SET lock_timeout = '3s';`) | `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS accepted_option_keys text[]` — nullable, additive; `docs/migrations/<version>_estimate_accepted_option_keys.md`; regenerate `src/types/database.ts` as its own `chore(types)` PR after the push |
| [`accept-estimate`](../../supabase/functions/accept-estimate/index.ts) — `body.optionKey`, `option_required` / `option_unknown`, `baseUpdate` spreads the freeze, `acceptedOptionLabel` for the staff email | **Done in #3328.** Accepts `optionKeys: string[]` (and still `optionKey` from an old client → `[optionKey]`); validates with the shared selection rule (`400 option_required` when a choice is missing or nothing is ticked, `option_unknown`); freezes the list; the staff notify label is *"Replace 50-gal" + 2 add-ons · $5,740.00*. **Deploy-order safety without a gate**: the new page sends **both** `optionKey` (the choice) and `optionKeys`, so an old server still accepts and a new server takes the list |
| [`get-estimate-for-customer`](../../supabase/functions/get-estimate-for-customer/index.ts) → `options` | Server-normalized options now carry `kind` (an old client ignores it and keeps rendering radios — see the gate in PR 4) |
| [`send-estimate-to-customer`](../../supabase/functions/send-estimate-to-customer/index.ts) → `buildEstimateLetterheadEmail({ options })` | Pass `kind`; the email's option table gets an add-on sub-heading and `+` prices (text + HTML) |
| [`log-estimate-option-view`](../../supabase/functions/log-estimate-option-view/index.ts) | Redeploy only (imports the shared kernel; no logic change) |
| [`EstimateOptionsPicker.tsx`](../../src/components/estimates/EstimateOptionsPicker.tsx) — `radiogroup`, `selectedKey`, `onSelect(key)`; `readOnly`; hardcoded heading | Two groups: choices keep `role="radio"`, add-ons render `role="checkbox"` under *Add to it*; props become `selectedKeys: string[]` + `onToggle(key)`; headings *Choose one* / *Add to it* / (all add-ons) *Pick what you want done*; still one component so the staff Page preview rehearses the real thing |
| [`EstimateAcceptBody.tsx`](../../src/components/estimates/EstimateAcceptBody.tsx) — `options`, `selectedOptionKey`, `onSelectOption`; `selectedOption` drives the total card, the document's lines, *Your selection —*, and the Approve label in three places (button, sticky bar, confirm title) | `selectedOptionKeys`; a `selectedOptions` memo; the document renders the accepted options' lines grouped with a small heading each; the three Approve labels come from one `estimateApproveLabel(options, keys)` kernel; disabled with nothing valid ticked |
| [`EstimateAccept.tsx`](../../src/pages/EstimateAccept.tsx) — `selectedOptionKey` state, the `optionKey` gate, the POST body, the fire-and-forget view log | `selectedOptionKeys` seeded by `defaultEstimateSelection`; the POST carries `optionKeys`; the view log fires per toggled-on key as today |
| [`EstimateAcceptStaffPreview.tsx`](../../src/pages/EstimateAcceptStaffPreview.tsx) + `StaffAcceptPreviewSnapshotV1.options` | Carries `kind` through (old snapshots parse unchanged) |
| [`Estimates.tsx`](../../src/pages/Estimates.tsx) — the draft builder (`addEstimateOption`, `switchViewedOption`, `patchViewedOption`, `removeViewedOption`, the ★ button, the card strip, name + pitch fields), `estimateOptionsDraftPersistFields` at save, the Customer-experience Page preview (`setPreviewSelectedOptionKey`), the acceptance record (*Accepted "…" · $ (of N offered)* + *Not chosen*), `estimateListOptionsSuffix` | The *Offered as* switch under the name field (`patchViewedOption({ kind })`); the card shows its kind; ★ only among choices, and moving the last choice to add-on moves the star to the first add-on; the Page preview holds `selectedKeys`; the record reads `accepted_option_keys` (falls back to `accepted_option_key`) and prints *Add-on:* lines before *Not chosen:*; the list suffix can say *· 4 options · 2 add-ons* (optional) |
| [`JobSignedAgreementModal.tsx`](../../src/components/jobs/JobSignedAgreementModal.tsx) → `acceptedOptionName` from `accepted_option_key` | Reads the keys array first: *option "Replace 50-gal" + 2 add-ons frozen at acceptance* |
| [`createJobFromEstimateSubmit.ts`](../../src/lib/createJobFromEstimateSubmit.ts), the accepted PDF, the Pipeline / list totals | **No change** — they read the frozen `line_items_snapshot` / `total_cents` |
| Help guide [`offer-options-on-an-estimate.md`](../../src/content/help/offer-options-on-an-estimate.md) | A section *Choices and add-ons* with the `{{chip:…|Add-on}}` and the segmented switch; the example gains the softener; the *What the customer sees* paragraph gets the two groups |
| `docs/ESTIMATES_TABS_ARCHITECTURE.md` (the builder and acceptance rows), `docs/EDGE_FUNCTIONS.md` (accept-estimate's body, the four redeploys), `docs/GLOSSARY.md` (*add-on option*) | Update with PR 4 |

## The plan

Server-first, three PRs (the first cut had four; the kernels, the column and the functions are
one dark, backward-compatible change and merging them apart only added a queue round trip).
Each ships alone with its release note, `docs/recent-features/` fragment and guide.

1. **PR 1 — the kernels, the column, the four functions** (S, ships dark) — **open as #3328**. Both kernels gain `kind`, the star rule, the selection helpers and the multi-key
   freeze; the parity suite pins them; migration `20260917053000` adds `accepted_option_keys`;
   `accept-estimate` takes `optionKeys` (keeps `optionKey`); the email ladder marks add-ons.
   After merge: `bash scripts/db-push.sh` **before** `supabase functions deploy accept-estimate
   get-estimate-for-customer send-estimate-to-customer log-estimate-option-view`, then the
   `chore(types)` regen PR.
2. **PR 2 — the customer page** (S). The picker's two groups (radio choices, checkbox add-ons),
   the body's selected set, the grouped lines, the Approve label from
   `describeEstimateSelection`, the POST carrying **both** `optionKey` and `optionKeys`, the
   staff preview. Render smoke: a mixed estimate ticks and un-ticks an add-on and the total
   moves; an all-add-on estimate disables Approve until one tick. No estimate carries an add-on
   until PR 3, so this ships dark too.
3. **PR 3 — the office** (M). The *Offered as* switch and the card's kind, the star rule in the
   builder, the Page preview's selected set, the acceptance record and the list suffix,
   `JobSignedAgreementModal`, the help guide, the three docs. No send gate: the functions from
   PR 1 are deployed before this merges (`npm run check:edge-drift` clean is the check).

Follow-on, not in this train: Bid Room alternates as add-alternates (`bidRoomPayload.ts` says
"in lieu of the base"; construction alternates are additive as often as not — the GC's
signature would then sum base + accepted alternates; its own to-do when a GC asks).

## Open questions

- **Taunya, one message**: was the customer choosing *among* five, or taking *several* of five?
  And what does *fix Estimates* point at beyond this — anything on the page itself? Her answer
  decides whether board 3 (all add-ons) is the real case; the train is the same either way.
- **Owner — forecast**: before acceptance, does the Pipeline show the ★ option alone (floor,
  recommended) or every option summed (ceiling)? Logged in
  [`../owner-decisions-pending.md`](../owner-decisions-pending.md).
- **Owner — pre-ticked add-ons**: none pre-ticked (recommended: an add-on the customer never
  touched should not end up in the freeze), or let the office pre-tick a *recommended* add-on?
- **Owner — the words**: *Choose one* / *Add to it* / *Pick what you want done*, and the Approve
  label pattern; all CX-overridable strings later, hardcoded first like the picker heading.

## How to verify

- `npm run dev`, then `/dev-login?as=1&to=/estimates` (Robert, dev). Create a draft on a
  **test customer** (never a real one — the send emails them).
- Builder: ＋ Option three times; name them Repair / Replace ★ / Water softener / Hose bibs;
  set the last two to *An add-on*. The card strip shows the kinds; ★ refuses to move onto an
  add-on; Remove option on the last choice moves the star to the first add-on.
- **Customer experience → Page**: two groups render; ticking the softener moves the total;
  switching Repair ↔ Replace keeps the add-ons. **Preview as customer** (new tab) matches.
- Send to your own address. On the real page: tick Replace + both add-ons, Approve — the
  confirm title names the selection; after signing, the accepted document lists the three
  groups and the total is the sum.
- Back in the office: the acceptance record reads *Accepted "Replace 50-gal" + 2 add-ons ·
  $… (of 4 offered)* with the *Add-on:* and *Not chosen:* lines; the Pipeline total equals the
  frozen sum; **Create job** from the estimate carries all three options' lines; the job's
  Signed agreement banner names the option and the add-ons.
- Second pass, all add-ons: five options, every one *An add-on*; the page has no *Choose one*
  group; Approve is disabled until one tick; approve three; the record reads *Accepted 3
  options*.
- Old-client check: with PR 2 deployed and PR 3 not yet, a sent two-choice estimate still
  accepts with the single `optionKey` (the staff preview page from a checkout at `main`).
- Delete both test estimates (draft → Delete; accepted → archive the job and the estimate the
  usual way) — leave nothing on a real customer.
