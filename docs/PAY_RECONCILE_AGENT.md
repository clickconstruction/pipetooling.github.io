---
last_updated: 2026-09-17
sections: [The contract, The part memo, The scripts, Reading rules, The test bed]
---

# Pay reconcile — the agent contract

How an agent (or a person at a terminal) records, links and checks pay sends without reading component code. Everything here is the door the app itself uses; the tables' RLS, the read-only write blocks and the payroll gate apply to every call.

## The contract

Five SQL functions (migration `20260917200000_pay_sources`, v2.3578; the part memo and Apple Pay in `20260917210000_pay_sources_parts`, v2.3580). Each needs payroll access or the service role and runs as the caller.

| Call | Use it for |
|---|---|
| `pay_position(p_person)` | Where someone stands: each report's `net` (gross − deductions + additional lines — the formula the database enforces), `paid`, `remaining`, its payments with `source_kind`/`source_id`; `open_total`; pending offsets; the person's Cash App queue. **Never recompute net from gross.** |
| `record_pay_send(p_source_kind, p_source_id, p_person, p_amount, p_paid_on, p_note, p_dry_run = true)` | A send that no payment records. Allocates oldest-open-first, splits at week edges, files any leftover as an `advance` offset, sets the Cash App lane. Idempotent on `(kind, id)` — a repeat returns `already_recorded`. Call with the default dry run first and read the plan. |
| `link_pay_send(p_payment_id, p_source_kind, p_source_id, p_amount = null)` | A payment that exists but does not say which send paid it. Optionally corrects the amount (the trigger still refuses more than net). Refuses a payment already carrying a different source. |
| `split_pay_payment(p_payment_id, p_parts)` | One payment that merged several sends → one row per send, same total. |
| `set_cashapp_lane(p_id, p_lane, p_person = null, p_note = null)` | Not pay: `expense`, `before_records`, `not_staff`, `ignored`, or back to `review`. |

`source_kind` is `cashapp` (id = the Cash App transaction id, `#D-…`), `mercury` (id = the app's `mercury_transactions.id` of an outgoing payment), `apple_pay` (id = the Mercury card row of the Apple Wallet send; may be recorded before it posts), `client_direct`, or `other`. The memo a recorded send wears is `pay_send_memo` in SQL and `paySendMemo()` in [`src/lib/people/paySources.ts`](../src/lib/people/paySources.ts): `Cash App #D-… "note"` (the reconcile matcher reads the id back), `Mercury "note"`, `Apple Pay "note"`, `Client direct "note"`, `Payment "note"`.

From the app's client: `supabase.rpc('pay_position', { p_person: 'Taunya' })`. From a script: sign in through `dev-login` as the owner (see the script) — never the service key from a laptop.

## The part memo

When one send lands on more than one report row, every row says its part and the whole — the owner's rule, written by the functions so nobody has to remember:

```
Apple Pay "Tristen" · 1 of 2 from $1,067.23
Apple Pay "Tristen" · 2 of 2 from $1,067.23
```

`record_pay_send` stamps the rows it writes; `link_pay_send` restamps every row sharing the source after each link (`pay_send_stamp_parts`, idempotent — a stale suffix is replaced, never doubled); a leftover advance offset reads `· $323.81 of $1,500.00 ahead`; a single-report send wears no suffix. Read it back with `parsePaySendPart()` when a person's eyes need it; a robot groups rows by `source_kind` / `source_id` instead.

## The scripts

```bash
npm run pay:record -- --person Tristen                                                     # where they stand
npm run pay:record -- --person Tristen --kind apple_pay --amount 1067.23 --date 2026-09-17 \
                       --source <mercury_transactions.id> --note "Tristen" --apply           # one send
npm run pay:backfill -- --csv ~/Downloads/cash_app_report.csv --out plan.md                 # the export
```

`pay:record` is one send through `record_pay_send`: the dry run prints the allocation and the memos, `--apply` writes and prints the position after. Both scripts sign in as the owner through `dev-login` (`scripts/lib/paySession.ts`).

`pay:backfill`:

Dry run by default: imports nothing, writes nothing, prints the plan. What it does with `--apply`:

1. **Import** the export into `cashapp_transactions` exactly as the reconcile modal does — every row, staff sends resolved through `cashapp_aliases`. A counterparty with no alias is listed at the end; name them in the modal's names step, the script never invents an alias.
2. **Match** every Cash App send in `review` / `recorded` / `advance` and every Mercury outgoing payment whose counterparty the Cash App aliases resolve (the Tally payroll flag marks the debit-card side of the Cash App sends, not payouts, so it cannot pick these) to payments that carry no source ([`backfillPlan.ts`](../src/lib/cashapp/backfillPlan.ts)):
   - the reconcile rules — id in memo, exact amount, one send covering 2–3 reports, memo numbers — become **link** (one send, one or more rows) or **split** (one row, several sends); a memo naming a send bigger than the row ("1200 sent" on five rows) links every row naming it, and a memo naming part of a payment ("500 advance" on $1,014.32, "Mercury 100 + 445.39") is filled from one unmatched send of exactly the gap, Cash App or Mercury;
   - **near** — within **$5** of an unlinked payment for the person in the window: link and correct the amount to the send. Beyond $5 nothing is corrected;
   - expenses and pre-record sends are **filed** to their lane; an unknown counterparty, a gap beyond $5, a note that does not say pay or advance, or a send inside the first week of records (it pays the week before) is **left for a person** with the reason.
3. **`--record-review`** — sends whose note says pay or advance and that no payment records are planned through `record_pay_send` (dry run unless `--apply`).

`--person <name>` narrows everything to one person. Re-running is safe: every write is idempotent on the send.

## Reading rules

Facts the 2026-09-17 by-hand pass needed that no table states:

- **Tristen is paid through Taunya's Cash App and Mercury.** The alias note rule (`note_contains = "Tristen"` → Tristen) carries it; a Mercury memo "for Tristen last week" resolves the same way.
- A note like **"Week − 500"** means an advance already sent was netted from the week; the 500 is not missing.
- **Client-direct** payments (a customer paid the person) are in no bank feed; they are recorded with `source_kind = client_direct` and taken at face value.
- One Mercury send may be **duplicated** (the same amount twice on one day, two ids). Both are real; the second is an overpayment to link, never to delete.
- The Cash App export includes reimbursements, tolls, parts, gifts, and money for other people ("Darren"). The note lane files most; the rest is a person's call.
- The week ending on the most recent Saturday is normally unpaid; that is this week's run, not a gap.
- **Apple Wallet card rows carry no recipient** (unlike Cash App's, which name the person in the bank description), so the matcher cannot resolve who an Apple Pay send was for. Record those with `pay:record`, and put the person in the Mercury note.

## The test bed

```bash
npm run test:pg:pay-sources
```

Starts a throwaway Postgres 15 in Docker, loads a stand-in schema (`supabase/tests/pay_sources/00_schema.sql`), the baseline's real payment triggers (extracted at run time), the `pay_sources` migration, then `20_scenario.sql` — 13 steps covering dry run, apply, idempotent repeat, leftover to advance, nothing open, link with correction, second-source refusal, over-net refusal, split, bad-sum refusal, lanes, the unique index, Apple Pay settling two weeks with the part memos, restamping on link, and the access gate. Ends with `ALL SCENARIO ASSERTIONS PASSED`. Add a step to the scenario whenever one of the functions changes; add the migration to the runner's list when a later one touches them. Never runs against prod.
