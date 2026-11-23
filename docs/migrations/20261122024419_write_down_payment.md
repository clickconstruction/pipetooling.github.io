# 20261122024419_write_down_payment.sql (2026-11-21, v2.8268)

Punch list #129, the leftovers: the mark a payment word leaves on its line. The owner's call of 2026-11-21 (*Yes, build it*, asked whether a word written from a line should also mark that line's promise on Follow up). One function, additive and idempotent. It ships alone, ahead of the client that calls it.

## Why

**Write down their word** under a customer's line in Messages saves the day they said they will pay as the Pipeline's payment promise (`add_job_payment_promise`). The line kept no mark of it. Two screens read a line's promise from `message_promises`, and so said nothing:

- the job's thread summary, whose *They promised* line went on reading *Nothing promised yet. A day Dana gives for a payment or an answer lands here.*
- the thread's move chip, which reads *Their move · until Fri Nov 27 · payment* once our word is the newest, and read *Their move · 2d* instead.

Nothing a signed-in client can call writes that row for a line with no offered day. `write_down` takes an offered row, no reader makes one, and the table grants a client no insert.

## What it does

**`write_down_payment(p_message_id uuid, p_day date DEFAULT NULL)`**, `SECURITY DEFINER`, returns nothing.

- **The guard** is Follow up's own (`follow_up_press('write down a promise')`): a sign-in, no training account, no digital twin, the office team. Each refusal is in words.
- **The line** must be a customer's own call, voicemail, missed call, text or email, the lines the press draws under. Any other line answers *A payment promise is written on a customer's own line.* A line that is not there answers *That line is not there.*
- **With a day**, the line's promise is a payment, written, with that day and who wrote it. The row is made when the line has none. A day still offered, a day called just talk and an earlier payment day are written over, since the day on the sheet is the one the customer named last. A day already written as another kind (their answer on our bid, a day we can be on site) is somebody's answer and is refused: *Someone has said what that day is already.*
- **With no day**, a payment mark comes back off as *just talk*, its day kept on the row. This is for a word the office voided with **Never said that**. A line with no payment mark is left as it is.

No table is created or altered, so the four `apply_*` fence calls are not needed. The fences on `message_promises` and `messages` are untouched: the function writes as its definer, and the guard refuses a training account and a twin first.

## The live client meanwhile

Nothing calls the function until the client PR that follows the push and the types. The sheet saves the Pipeline's promise as before.

## Verified

- **The CI bed**: `supabase/tests/messages_follow_up/40_payment_word.sql`, run by `scripts/pgtest-messages-follow-up.sh` after the cut's own scenario and `log_call`'s, on the whole schema with its row security (Docker; `npm run test:pg:messages-follow-up`). Twenty-five checks: the four refusals of the guard, the lines that take no mark, the row made, the same press twice, a new day by another person, an offered day and just talk written over, a missed call's line, the refusal over another kind, the mark taken off and put back, and what a reader counts afterwards.
- **A stand-in rig on the local Postgres 15** (Docker is down on the Mac that wrote this): the real `message_promises` table with its constraints and indexes, the real `follow_up_press`, `follow_up_user_name` and `write_down`, stub tables for the rest with no row security, this file applied twice, then the same test file: all twenty-five pass. The rig proves the function against the table's constraints; the CI bed is the proof under row security.

## Apply

`supabase db push` once this PR is on `main`. Nothing on the client depends on the order.

## Applied

On the prod ledger, read on 2026-11-23 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here. The types followed in #9365.
