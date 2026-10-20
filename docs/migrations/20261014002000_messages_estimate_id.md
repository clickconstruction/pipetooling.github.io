# 20261014002000_messages_estimate_id.sql (2026-10-12, v2.5426)

Messages, residential R8 · 8, PR 1 (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R8 on branch `spike/gc-mode`): the estimate a customer's message became a line on.

The kernel is `src/lib/estimates/lineFromMessage.ts` (v2.5403). A line from a message joins the job's open draft estimate, or starts a new one. So many messages can feed one draft.

## Why the column is on the message

The plan named `estimates.source_message_id`. The lead moved it to the message side, and the owner agreed (2026-10-12):
- One column on `estimates` holds one message. Only the first message would keep its link.
- A line cannot carry it either. `normalizeEstimateLineItem` rebuilds each line of `line_items_snapshot` with five fields, so a message id inside a line is dropped on the next save.
- Example: Dana's hose bib text starts estimate 1044, and her water heater text joins it as line 2. With the column on the estimate, the second text has no "became line 2" chip, and nothing stops it being drafted twice. With the column on the message, each text says its estimate, and PR 2 refuses a second draft.

Neither shape says which line a message became, since a line has no stable key. The line's number stays the draft-time toast.

## What it does

1. **`messages.estimate_id`** (`uuid`, null, `REFERENCES estimates(id) ON DELETE SET NULL`): the estimate this message became a line on.
   - Many messages may point at one estimate.
   - It is null when the message became none, or its draft was deleted.
   - Nothing on main deletes a message, since a contact folds rather than goes.
2. **`messages_estimate`**: a partial index on `(estimate_id) WHERE estimate_id IS NOT NULL`, for an estimate's list of its messages. It is not unique, since many messages feed one draft.
3. **No column grant.** `messages` grants `UPDATE` column by column, and this column is not among them. PR 2 writes it through a definer that saves the line on the estimate and stamps the message in one call. It refuses a message that already has an estimate, as cut 4b's `gc_draft_change_order_from_message` does for a change order.

No new table, so there are no fence calls. `estimates_protect_after_accept` is untouched, since the column is not on `estimates`.

## Safety

- `SET lock_timeout = '3s'`. Adding a nullable column with no default is metadata-only on `messages`. Its foreign key briefly locks `estimates` and checks no rows, since every value is null.
- The index build briefly blocks writes to `messages` while it reads the table. It holds no entries yet, since every value is null. The Quo webhook writes to `messages` all the time, so push at a quiet moment. A lock wait over 3s fails the push, and a retry is safe.
- Idempotent: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and a comment that can be restated.
- **Old clients**: nothing reads the column yet, so the client needs no deploy first.

## The bed

`npm run test:pg:messages-spine` (`supabase/tests/messages_spine/20_scenario.sql`, section 12) checks four things:
- two of Elena's lines can feed one draft;
- the index is there, partial and not unique;
- the office holds neither `UPDATE` nor `INSERT` on the column, and a hand-written `UPDATE` is refused;
- deleting the draft leaves both lines on the thread, unlinked.

The bed runs in CI on this PR (SQL beds), since no Docker or Postgres server is reachable from the office Mac.

## After the push

The types regenerate from prod in one types PR (`messages.estimate_id`). PR 2 then adds the definer and the ⋯ press, and the message's chip reads its estimate from the column.
