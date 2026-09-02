# RFQ Round 2 Plan

> **Purpose**: the owner's post-lane-B build list (2026-09-02), sequenced so
> nothing collides and every rung passes the same gate: deep think →
> mockup → **"is this the best we can do?"** review → revise → build →
> typecheck/lint/tests → live test → docs → PR. Predecessor:
> `docs/SUPPLY_HOUSE_RFQ_PLAN.md` (lanes A/B/C all shipped,
> v2.2629–v2.2636). Status: **planned, awaiting go**.

## Sequencing logic

Small independent rungs land first (they de-risk surfaces the bigger rungs
touch); the two schema-bearing rungs (contacts, file parsing) go through
the full mockup cycle; the cost-bridge study runs LAST as a decision
document, because it reaches outside the RFQ system into the Workbench's
cost model and deserves its own owner sign-off before any build.

Ground truth already verified in code:
- `bids.plans_link` and `bids.count_tooling_plans_link` exist (rung A).
- Supply houses are managed in `SupplyHousesTab.tsx` / `SupplyHouseForm.tsx`
  (rung D's contacts editor lives there + inline in compose).
- The sale side already has a per-row override table
  (`bid_count_row_custom_prices`) — the exact precedent rung G's bridge
  would mirror on the cost side.
- Workbench per-row cost = the **Takeoffs unit price** ("No Takeoffs cost
  yet — assign a part or assembly"), i.e. derived from assigned
  parts/assemblies — the thing a quoted price would override.

## Rung A — plans link + urgency sort (owner items 5 + 6) — SHIPPED v2.2642

- **Attach the plans**: compose gains "include plans link" (default ON
  when the bid has one; `bids.plans_link` ONLY — see the revision note),
  rendered in the email under the CTA and on the `/q` page header. Scope
  snapshot carries it so reminders/resends stay consistent.
- **Urgency sort**: kernel `rfqUrgency(rfq, now)` → tier + reason label
  ("bounced", "unviewed 2+ days", "viewed but silent · needed by in 3
  days", …); desk sorts by tier then age; reason chip on the row.
  Bounced > needed-by-at-risk > unviewed-stale > viewed-silent > fresh >
  quoted.
- Mockup: artboard 5 on the RFQ Desk canvas; the review pass kept the
  trail on every row (reason chips ONLY on rows needing attention) and
  bound the toggle to `bids.plans_link` alone — the CountTooling link is
  internal and never reaches a vendor.

## Rung B — freight into compare (owner item 3) — SHIPPED v2.2643

Design questions the mockup must answer before code:
- Freight is **quote-level**; compare totals are line sums. Proposal:
  freight rides the house chip ("+ $45 freight"), joins the
  **apples-to-apples common-lines total** (once per house), and joins the
  **picked total** once per house that has ≥1 pick — with the footer
  showing the split ("parts $566 + freight $45").
- Best-price stars stay **unit-price** stars (freight is order-level, not
  line-level) — but the house chip ordering should use the freight-in
  common total, or the cheap-parts/expensive-freight house games the
  chip.
- The vendor page already captures freight; the Plug-in modal already
  captures freight; nothing new is stored — this is display + totals
  math (kernel change in `quoteCompare.ts` + tests).
- Review revision (artboard 6): **null ≠ free** — "free freight" is an
  affirmative $0; "freight not stated" ranks as 0 but wears an amber
  caveat so silence can't quietly win; picked-total split names every
  picked house's freight.

## Rung C — vendor page prefill (owner item 4) — SHIPPED v2.2646

- `get-rfq-quote-page` returns the requesting house's OWN last-quoted
  prices (per fixture, with age) — never another house's, never our
  cost/sale data.
- Page UX to settle in the mockup: prefills must not let stale prices
  submit silently. Proposal: a banner — "We filled in your prices from
  last time (newest 6 days ago) — confirm or fix them" with a one-tap
  **Confirm all** and per-line changed-highlighting; prefill only when
  memory is fresher than ~90 days; drafts in localStorage still win over
  prefills.
- Server-side: submit is unchanged (prices are prices); the win is pure
  vendor friction removal.
- Review revision (artboard 7): auto-ghost prefill REPLACED by an
  explicit one-tap "Fill with last time's prices" — one deliberate
  action instead of an unconfirmed-ghost state machine; hand-editing a
  line drops its "from last time" tag; existing drafts always win.

## Rung D — per-house contacts (owner item 1; 1 PR + 1 migration, full mockup cycle)

- Schema: `supply_house_contacts` (supply_house_id, name, email, label
  e.g. "inside sales" / "outside rep" / "branch", is_default, archived_at,
  timestamps; RLS mirroring supply_houses).
- Compose: house cards become contact pickers — default contact
  pre-checked, others one tap, **CC** support (send-rfq-email accepts
  `emails: string[]` per request; Resend `to`+`cc`); free-text stays as
  the escape hatch and OFFERS to save itself as a contact ("remember
  danny@… as Moore Supply's rep?").
- Backfill: one-time seed from historical `bid_rfqs.sent_email` (newest
  per house) so day one already knows everyone.
- Management: contacts editor inside `SupplyHouseForm` (the existing
  surface) + the inline save-from-compose path. Desk rows show the
  contact's name, not just the address.
- Mockup must answer: does a "request" go to one contact with CCs, or
  fan out one-request-per-contact? (Proposal: one request, one To, CCs —
  one link per house keeps the desk one-row-per-house.)

## Rung E — PDF/spreadsheet replies (owner item 2) — SHIPPED v2.2651 (phases 1+2; scanned-PDF LLM lane still deferred)

Three input classes, phased:
1. **Spreadsheets (xlsx/csv)** — parse client-side (SheetJS for xlsx,
   plain split for csv), flatten rows to text lines, feed the EXISTING
   `parseVendorReply` — deterministic, zero new infra. The Plug-in modal
   grows a drop-zone next to the paste box.
2. **Text-layer PDFs** — pdf.js client-side text extraction → same
   pipeline. (Vendors' emailed quote PDFs are usually generated, so most
   have a text layer.)
3. **Scanned/image PDFs** — the only class needing an LLM (vision) via a
   new edge function; costs money and a key. **Phase it behind 1+2** and
   only build if real files demand it — the drop-zone can say "this PDF
   has no readable text — copy/paste it for now" and count how often.
- Provenance: keep `raw_paste` = extracted text; original-file storage
  (Supabase storage bucket) is a mockup-time decision — proposal: skip
  file storage in v1, store the extracted text + filename.
- The mockup shows: drop-zone states (parsed ✓ / needs-review ? /
  no-text-layer), and the same match-grid flow after — the human-confirm
  step stays identical to paste.
- Review rule that mattered (artboard 9): **the extended-price trap** —
  vendor sheets carry unit AND extended columns and the parser prefers
  the last number, so the flattener is header-aware and DROPS
  ext/total/amount columns (tested kernel; the [file:…] header names
  what was dropped). xlsx rides the existing exceljs dep; pdf.js added
  as a lazy chunk; lot-wording lines get the amber rung-G hint.

## Rung F — desk recording for the help guide (follow-through)

Once A–E settle the desk's final shape: screen-record the desk +
compose-preview flow into the quote-link guide (matching the house
gif standard set in v2.2633).

## Rung G — "apply picks to bid costs": the study (owner item 7; decision doc, NO build yet)

**The problem in plain terms**: the Workbench's COST/UNIT per fixture is
*derived* — each fixture name maps (via Takeoffs) to an assigned part or
assembly, and its cost is that takeoff unit price. Quotes are keyed on
fixture *names* with one $/each number and no part breakdown. There is no
bridge from "WC-1 (name)" to "the takeoff part rows behind WC-1", so a
picked quote price has nothing to write to — writing into part prices
would corrupt shared book data with one bid's negotiated number.

**Owner decision 2026-09-02 — packages/lots**: vendors' best prices are
often package prices (one price spanning several rows). Resolution, in
three layers: (1) **capture lots** — `lot_id` + `lot_total_cents` on
quote lines, grouped by a human tap (parser flags "all in/package/lot"
candidates); (2) **compare lots as lots** — bracketed group at the house
total level, excluded from per-line stars, picked atomically; (3)
**apply with a visible, adjustable split** — default allocation
proportional to takeoff-derived cost (fallback per-unit), editable
before writing, group provenance ("Ferguson · carrier package · 9/2"),
group-level revert only. Rung E's parser must surface lot keywords.

**Bridge options to put in front of the owner**:
- **(a) Fixture-level cost override** (recommended shape): a
  `bid_count_row_custom_costs` sibling of the existing sale-side
  `bid_count_row_custom_prices` — `cost_source: takeoff | quoted`,
  cents, provenance (quote line id, house, date), a visible "cost from
  Ferguson 9/2" tag on the row, and one-tap revert. Applied only via an
  explicit "Apply picks to costs" button with a before/after margin
  preview. Doesn't touch shared part data; drift-safe (the tag shows
  when the quote is stale).
- **(b) Part-level mapping** — map quotes down into takeoff parts.
  Requires the name→part bridge AND per-part quote granularity vendors
  don't give. Wrong direction; rejected unless something changes.
- **(c) Status quo+** — keep costs derived, lean on compare's existing
  cost-baseline column to *show* quoted-vs-cost deltas, humans edit
  takeoffs by hand. Zero risk, zero automation.
- **Open question to verify in code before deciding**: whether the
  takeoff unit price is materials-only or blends labor — a quote is
  materials-only, so if takeoff cost blends labor, option (a) needs a
  materials-only sub-field or the override corrupts margins.
- Deliverable: this section grows into a 1-page decision doc + a
  mockup of option (a)'s row treatment; owner picks; only then a build
  phase.

## Cross-cutting (every rung)

- The gate: mockup → "is this the best we can do?" → revise → build →
  full test suite → live test on the dev server against prod data
  (self-addressed emails only; test writes cleaned after) → release note
  + recent-features fragment (+ migration fragment where schema moves)
  → help-guide updates → PR with auto-merge + watcher.
- Roles: everything stays behind `canPackageAndSendBidPricing`.
- Mockups land on the existing RFQ Desk canvas (artifact
  b731a34b-0ba5-4e82-a450-8f2aec1f64e1) or a Round-2 sibling if it
  outgrows it.

last_updated: 2026-09-02
