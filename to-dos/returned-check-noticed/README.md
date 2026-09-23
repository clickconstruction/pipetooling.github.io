---
name: A returned check is noticed by the app, not by the bank
number: 40
group: ready
status: asked 2026-09-23 · PR 1 in flight (session "Surface bank-returned deposits before anyone asks", started 2026-09-23 from a chip) · PR 2 and 3 not started
summary: >
  **A check the bank returns stays counted as paid until someone notices in the bank.** Take 5 –
  Seguin, 2026-09-23: Southern Post's $13,680 check was matched to the first draw in Accounts
  Receivable on Sep 21 and came back on Sep 23 (Mercury `status = failed`, *Insufficient funds*).
  Mercury's webhook had already written that into `mercury_transactions`; nothing in the app reads
  it. The Pipeline row read 35% Paid, the lien claim was $13,680 short, and Taunya learned it from
  the bank. v2.3784 gave the row a chip and a working *Unlink and remove*; this to-do makes the app
  say it first. Three layers: the read side where the office already looks (a red Needs-you card
  and an Accounts Receivable chip), a message the moment the webhook flips a linked deposit, and a
  badge on the Pipeline row.
next: >
  PR 1 lands from the running session; then PR 2 (the webhook message) as its own PR; PR 3 last.
  Delete the folder when all three ship — the release notes carry the record.
size: S (PR 1) · S (PR 2) · XS (PR 3)
blocker: none — the signal is already in the table; the owner's rule (loud signal, a person presses) is settled by v2.3784.
ver: v2.3784
opinion: build — six real returns in eighteen months, each a paid figure that was wrong for days; the read side is cheap and PR 2 is what "noticed on its own" means.
---

# A returned check is noticed by the app, not by the bank

**The ask (Grace, 2026-09-23):** *"I like the idea of noticing a returned check on its own, we should
explore this"* → *"add to the punchlist to build 1–3."*

## What the data says (prod, 2026-09-23, read-only)

Seventeen check deposits have ever gone `failed` in `mercury_transactions`. **Six were real
returns** — the check *posted* and then failed 3–5 days later: Southern Post $13,680 (Sep 18 → Sep
23, *Insufficient funds*), Dudley $8,000 (Jun 1 → Jun 4, *Insufficient funds*), Poolcorp $3,125
twice (*Stop payment*, Mar and Apr), M&M Roofing $1,380 (*Refer to maker*, Nov 2025), Maria Ortiz
Sauceda $275 (*Insufficient funds*, Mar 2025). The other eleven **never posted** — Mercury's
*"There was an issue with this transaction"* — and were simply re-deposited (Southern Post's first
try on Sep 16 is one). Thirteen more failed rows are `internalTransfer` shuffles between Mercury
accounts.

Two rules fall out of that:

- **Posted, then failed, is a return.** `status = 'failed' AND posted_at IS NOT NULL AND kind =
  'checkDeposit'` (or any money-in kind). A failed row with no `posted_at` is a processing failure
  and must raise nothing, or the nudge cries wolf twice as often as it helps.
- **The 3–5 day gap is the window.** It is exactly when Accounts Receivable can match the deposit
  to a job. Today one failed deposit is still linked to a job payment (the Take 5 one); the rest
  were never matched or were already unlinked.

The status reaches the app on its own: `mercury-webhook` upserts the transaction on `mercury_id`
when Mercury sends the change (minutes), and the Banking page's sync re-reads 90 days. No new sync.

## The rule the owner settled (v2.3784)

The app never stops counting the money by itself — that would move the Pipeline, the lien claim
and the customer's statement before anyone looked. It says it loudly; a person presses *Unlink and
remove*; the RPC then deletes the row, writes the `removed` event and marks the deposit returned in
AR. Every layer below is a read, or a message. The one write stays behind the button.

## The plan

1. **PR 1 — read the status where the office already looks** (in flight). A red Needs-you item,
   key `returned-check`, *"A check the bank returned is still counted as paid — Take 5 – Seguin ·
   $13,680 · Insufficient funds"*, one line per linked payment, opening Edit Job's ③ Payments
   received where v2.3784's chip and button already do the work. In Accounts Receivable, a
   posted-then-failed deposit nobody matched wears *returned by the bank · Insufficient funds*
   (`arDepositRowState` gains the state from the status, not only from the hand-set tick) and is
   kept out of the exact-match sweep and the close-out, as a hand-marked return is today. Guide
   *match bank deposits to the bills they pay* → the *If a check bounces* section gains the nudge.
2. **PR 2 — tell the office the moment it happens.** In `mercury-webhook`, after the upsert: when
   the row is a money-in kind that has `posted_at` and just went `failed`, and a
   `jobs_ledger_payments` row carries its id, send the office one message — *"Southern Post's
   check for $13,680 on Take 5 – Seguin came back: Insufficient funds. Open the job → Payments
   received → Unlink and remove."* — through the existing office channels (the `notify-*`
   functions' pattern; an email client beside `moneyWaitingEmailClient.ts`, and push where a
   subscription exists). Once per transaction (a `notified_at` on a small table, or the event row),
   never on a processing failure, never for a deposit nobody matched (that one is PR 1's chip).
   `docs/EDGE_FUNCTIONS.md` section for the webhook gains the paragraph.
3. **PR 3 — the Pipeline row.** In Billed Awaiting Payment (and the phone's one-line row), a small
   red *check returned* badge beside the paid figure while a linked deposit is failed, opening the
   same payments row. Redundant once the card exists; cheap; Taunya's eye lives on that row.

## Where it plugs in

- Read side: `mercury_transactions.status` + `raw->>'reasonForFailure'` (already read per row by
  `JobFormPaymentsTable` since v2.3784 — `mercuryDepositFailed` / `mercuryDepositFailedWords` in
  `jobFormPaymentPredicates.ts` are the words); `jobs_ledger_payments.mercury_transaction_id` is
  the link; `dashboardNeedsYou.ts` (`NeedsYouItem` keys + rank), the AR row state kernel
  `arDepositRowState.ts`, `list_mercury_transactions_for_bank_payments` (returns `returned` from the
  hand tick; PR 1 either adds `status` to the RPC's row or reads it beside).
- Write side, unchanged: `remove_jobs_ledger_payment_and_reconcile` (v2.3784) — the button.
- PR 2: `supabase/functions/mercury-webhook/index.ts` (the upsert at the end of the handler),
  `_shared/` email helpers, `push_subscriptions` readers in the `notify-*` functions.

## Verify

- PR 1: on prod data the card lists nothing once Take 5's row is unlinked — seed the check with a
  local job whose payment points at a failed, posted Mercury row (`read_rows mercury_transactions`
  with `status eq failed` finds the six); the AR chip on the Dudley $8,000 and Poolcorp rows under
  *To match · All*; the sweep and close-out refuse them.
- PR 2: fire the webhook locally with a Mercury payload whose `status` is `failed` and `postedAt`
  set for a linked transaction → one message, a second fire → none; a payload with no `postedAt`
  → none.
- PR 3: the Take 5 row before the unlink (or the seeded one) shows the badge; after the unlink it
  is gone.
