# Supply house directory — the estimator's door, and one directory behind all three of them

Status: **designed, not started** · asked, weighed and mocked up 2026-09-08; no code written · mock-up: [`mockup.html`](./mockup.html) beside this file (five screens; open it in a browser)

## The ask, in the owner's words

> "Estimator wendi is asking for access to the names and contacts of the supply houses. What should an estimator be able to see beyond this? right now this is all she sees after the last update"

— with a screenshot of Materials → **Parts Book**, which is the whole page for an estimator today.

Then, and this is why this is a to-do and not a one-line patch:

> "is this the most robust and right way to do it if long term we build an app that supports tens of estimators?"

## What is already true (re-checked against code 2026-09-08 — nothing was taken away)

- **The data already admits her.** `sup_supply_houses_select` (baseline) lists estimator, and `supply_house_contacts_select_office` (`20260902170045_supply_house_contacts.sql`) gives estimators SELECT **and** insert / update / delete on reps.
- **She already has a door, badly named.** The green **Price coverage** button on the Parts Book toolbar opens a modal with Name / Contact / Phone / Email and the full add-and-edit form. It was labelled "Supply Houses" until **v2.2903** renamed it — that rename is almost certainly "the last update" in the owner's message. Recorded as **quirk 16** in `docs/MATERIALS_TABS_ARCHITECTURE.md`.
- **Bids already shows her reps.** `RfqComposeModal` lists each house's contacts as To / CC chips and can remember a typed address as a rep (v2.2648).
- **What is deliberately hidden** is the Materials **Supply Houses** / **Job Accounts** / **PO Generator** tabs — `Materials.tsx` redirects estimators away from those three. That tab is an accounts-payable desk (invoice ledger, aging heat map, balances owed), not a directory, and `docs/ACCESS_CONTROL.md` states the exclusion for estimator and primary.

So the gap is **presentation, not permission**: the directory has no honest home, and the one home it has is named after something else.

## The decision

**Build a Directory pane and give it three doors — do not build an estimator-only page or table.**

| Option | Verdict |
|---|---|
| Rename the button back to "Supply houses" | Rejected as the endpoint — it re-creates the v2.2903 problem (one name, three surfaces) and still hides the directory inside a price-coverage modal. Acceptable only as a stop-gap if this to-do stalls. |
| Give estimators the existing Supply Houses tab | **Rejected** — it carries invoices, aging, balances owed and job accounts; estimators are kept out of job money everywhere else. |
| A separate estimator-only page or table | **Rejected** — one company by decision; a second copy of the roster is the drift this repo keeps paying for. |
| **Split the office tab into a Directory pane and an AP pane; render the Directory alone for estimators** | **Chosen.** One component, three doors. |

**Why the extra data work is in scope** (the "tens of estimators" question). Three things underneath the tab do not survive scale, and each is a separate PR below:

1. **Access is twelve literal role comparisons** in `Materials.tsx`, not a predicate. This is exactly the class **v2.2920** (the role sweep) was written to end: the shell admits a role the data refuses, or hides one the data allows. Adding a tenth estimator, or an estimator-like role, should edit one list.
2. **Directory editing already exists three times** — the office tab, the Price coverage modal, and the RFQ window's add-a-rep. A fourth copy means every future field ships four times.
3. **The schema keeps three facts in the wrong place** — contacts live on both `supply_houses` and `supply_house_contacts`; "is this a supply house" is the negative flag `is_insurer`, so a rental yard or a sub reads as one; and houses have no trade, so a trade-restricted estimator sees every house.

## Open questions for the owner

- **Do primaries and superintendents get the tab too?** They sit in the same "hidden" bucket as estimators today. The mock-up assumes estimator only.
- **Can an estimator add and edit a *house*, or only its *reps*?** Today's behaviour is both (the Price coverage modal and the contacts RLS allow it) — the mock-up keeps both. Worth a yes.
- **A house with no trade set** — visible to every estimator (assumed) or to none?
- **One tab name for both audiences?** Office says "Supply Houses", the mock-up says "Supply houses". One spelling, chosen once.

## Where it plugs in

**Exists**

| Thing | Where | Note |
|---|---|---|
| Office tab (directory + AP in one file) | `src/components/SupplyHousesTab.tsx` | ~1,576 lines; the AP half is invoices, aging, job accounts |
| Page tabs + role gates | `src/pages/Materials.tsx` | `MATERIALS_TABS`, the estimator redirect, 12 literal role checks |
| House add/edit form | `src/components/SupplyHouseForm.tsx` | name, contact_name, phone, email, address, website_url, notes, monthly_payment_day, is_insurer |
| Reps section | `src/components/SupplyHouseContactsSection.tsx` | rendered only when editing an existing house |
| Website control | `src/components/SupplyHouseWebsiteLink.tsx` | |
| Price coverage stats | `src/lib/materials/supplyHouseStats.ts` | already computed per service type |
| Vendor picker | `src/lib/supplyHousePickerRows.ts` | filters `is_insurer = false` — the flag PR 5 replaces |
| RFQ compose | `src/components/bids/RfqComposeModal.tsx` | reads `supply_house_contacts` |
| Tab pill styling | `src/lib/pageTabStyle.ts` | |
| `supply_houses` | table | `address, contact_name, email, is_insurer, monthly_payment_day, name, notes, phone, website_url` |
| `supply_house_contacts` | table | `supply_house_id, label, name, email, is_default, archived_at, created_by` |
| Trade restriction | `users.estimator_service_type_ids` | already read by `Materials.tsx` |

**New**

- `src/lib/materials/materialsTabs.ts` — `materialsTabsFor(role)` kernel + tests.
- `src/components/materials/SupplyHouseDirectory.tsx` — the extracted pane.
- `can_manage_supply_house_directory()` — one SQL predicate for the RLS to call.
- `supply_houses.vendor_kind`, and a house ↔ service-type link table.
- Help guide `src/content/help/find-a-supply-house-and-its-rep.md`.

## The plan — six PRs, smallest shippable first

1. **Extract the Directory pane.** New `SupplyHouseDirectory.tsx` out of `SupplyHousesTab.tsx`; the office tab renders Directory above its unchanged AP pane. Add `materialsTabsFor(role)` with tests; `Materials.tsx` reads it instead of literal role checks. No visible change for the office, no role change. *(mock-up: "Office · Supply Houses tab, split")*
2. **Open the estimator's door.** `materialsTabsFor` admits estimator to `supply-houses`; the tab renders the Directory alone; drop `supply-houses` from the estimator redirect; add the `can_manage_supply_house_directory()` predicate and point the two RLS policies at it. Ship the help guide. *(mock-ups: "Estimator · Materials → Supply houses" and the phone screen)*
3. **Retire the duplicate.** The Price coverage modal drops its supply-house CRUD and means price coverage only; **quirk 16 closes** and `MATERIALS_TABS_ARCHITECTURE.md` loses it.
4. **Reps become the only home for contacts.** Migration backfills any `supply_houses.contact_name / phone / email` not already a rep, then the form and every reader derive the headline contact from the default rep. The house keeps one **main phone** (the counter). *(mock-up: "Edit vendor")*
5. **`vendor_kind` replaces `is_insurer`.** Migration adds the column (supply house / insurer / rental yard / subcontractor), backfills from the flag, and the directory + `supplyHousePickerRows` filter on it. `is_insurer` retires a PR later. *(mock-ups: "Edit vendor", "Bids · Send price requests")*
6. **Trades served** *(optional, last)*. House ↔ service-type link; a trade-restricted estimator sees only matching houses, and the RFQ picker defaults to the bid's trade.

PRs 4 and 5 carry migrations: number from `origin/main`, start with `SET lock_timeout = '3s';`, and `db push` only after the file is on main.

## How to verify

- **Sign in as an estimator, not as Robert.** Plain dev login is fixed to `robert@douglasmining.com` (dev). Use `/dev-login?as=twin:estimator&to=/materials` on your dev port to land as an estimator account and see the real RLS answer — `Materials.tsx` reads `role` from `public.users`, so an impersonated dev proves nothing.
- **The negative check is the point of PR 2**: as an estimator, `/materials?tab=job-accounts` and `?tab=po-generator` must still redirect, and no invoice, aging or balance number may appear on the new tab.
- **PR 4 needs a real edit both ways**: change a rep, confirm the directory's headline contact follows; confirm no writer still sets the retired house columns.
- **A restricted estimator** (non-empty `estimator_service_type_ids`) is the case PR 6 exists for — set one on a test user before judging the list.
- Live data note: the roster today mixes real supply houses with insurers and an "Outside Subcontractors" ledger bucket. That mix is the evidence for PR 5, not a data bug to clean up first.

## Mock-up

[`mockup.html`](./mockup.html) — five screens, drawn against the app's own tokens from `src/index.css`: the estimator tab, the same on a phone, the split office tab, the Edit vendor form, and the RFQ picker. Bracketed values are placeholders; dollar figures, part counts and dates are sample data.
