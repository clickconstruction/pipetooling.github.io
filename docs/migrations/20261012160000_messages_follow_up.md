# 20261012160000_messages_follow_up.sql (2026-10-12, v2.5274)

Messages, cut 2, Follow up (`to-dos/gc-mode/messages/BUILD_PLAN.md` and `BUILD_HELPERS.md`'s cluster 2 on branch
`spike/gc-mode`; the kernels are `src/lib/followUp/queue.ts`, `src/lib/messages/owed.ts` and
`src/lib/messages/promises.ts`, v2.5251). On the spine (`20261012010000_messages_spine.sql`, v2.5258): the
conversation's state and who has it, what we owe, what a line was read as, highlights, the presses the Follow up tab
and the thread call, and the badge. Nothing in the app calls them until cut 2's screens.

## What it does

1. **`contacts` gains** `state` (`waiting`, which the screens call Open; `snoozed`; `done`, the default), `snoozed_until`
   (a snooze has its day and nothing else has one), `has_user_id` (set null when the user goes), `has_since` and
   `has_how` (`took`, `rule`, `handed`; whoever has it has both). Indexed where the state is not done.
2. **`messages` gains** `back_words`, a note's day in the words typed when they were not a date (never beside
   `back_on`), and `back_done_at`, Done with it (only with a day). Notes only. Indexed for a person's notes with a day.
3. **`messages_move_state`**, `AFTER INSERT` on `messages` (`SECURITY DEFINER`, the database's own): their message
   opens the conversation and ends a snooze; ours, or a team note, closes it and clears who has it (whoever writes the
   note has looked); an event moves nothing; a line older than the other side's newest moves nothing (a backfilled
   email).
4. **`contact_owed`**: `contact_id` (`RESTRICT`: a contact folds, it does not go), `what`, `by_day` or `by_words` (never
   both; neither is no day, and a day is never refused), `marked_by`, `marked_at`, `done_at` with `done_how` (`note`,
   `message` or `folded`) and `done_note_message_id` (`RESTRICT`), the line that got it done, which `note` and
   `message` require. One open row per contact (`contact_owed_one_open`). **`contact_owed_guard`** (`BEFORE INSERT OR
   UPDATE`) holds that line to the person's own team note, or to a message we sent them (*Only their team note, or a
   message we sent them, marks what we owe done.*).
5. **`message_promises`**: `message_id` (cascade), `kind` (the eight: quote, start, papers; payment, decision, access;
   answer, cert; or `question`), `state`, `day` or `day_words`, `writes` (`start`/`delivery` for a start, `insurance`/
   `w9` for papers, required once those are written), `offered_at`, `decided_by`, `decided_at`.
   - A heard day is offered with no kind, then `written` with one, or `no` (just talk, kind still null).
   - A question is offered, then `asked` or `answered`, with no day.
   - One heard day and one question per line.
6. **`message_highlights`**: `message_id` (cascade), `text`, `highlighted_by`, `highlighted_at`; the same words on a
   line once (unique on the words' digest).
7. **One policy a table, the office team's** (`gc_office_team()` for every verb).
   - **`anon`** holds nothing.
   - **`authenticated`** holds `SELECT`, and only what the presses change: the five new `contacts` columns; on
     `messages`, `INSERT` of a line's contact, job, channel, direction, who and body and its note's day, and `UPDATE`
     of the note's day; `contact_owed`'s `INSERT`/`UPDATE` of what, the day and how it got done; `message_promises`'s
     `UPDATE` of the decision; `message_highlights`'s `INSERT` and `DELETE`.
   - **A restrictive policy, `messages_client_writes_own_team_lines`**: a line written by a person signed in is a team note or
     an event written as themselves. A call, a text or an email still arrives only from the service role. The same policy is written word for word in cut 4's migration (`20261012120000_messages_flows.sql`), each dropping all three names first, so whichever runs last leaves one: restrictive policies AND together, and two different ones refused the presses' event lines.
8. **The presses**, `SECURITY INVOKER` as the spine's are. Each refuses in words first, through `follow_up_press(doing)`:
   *Sign in to …*, *A training account cannot …*, *A digital twin cannot …*, *Only the office team can …*. The policies
   and the fences refuse the same writes behind them.
   - `take_it(contact)` and `hand_to(contact, user or null)` write the gray line (*Robert took Greg Paulk.*, *Rosa took
     Dr. Priya Raman from Robert.*, *Rosa handed …*, *Rosa gave …*, *… put … back for whoever answers first.*);
     unchanged writes nothing; only someone on the office team who is not archived can be handed it (a
     superintendent cannot open Follow up), else *Pick a teammate in the office.*
   - `set_state(contact, state)`: Reopen, Remind me Monday (the coming Monday from `app_today()`; a Monday's press
     means the Monday after; returns the day), No reply needed (also clears who has it).
   - `mark_owed(contact, what, by_day, by_words)` marks or changes the open row and writes *marked that we owe …*,
     *changed what we owe …: …, not …* and *set the day we owe … to …*; `owed_done(contact, note, job)` needs the note,
     writes it as a team note (which closes the row) and marks the row done by it.
   - `write_down(message, kind, writes)`: the kind must be one the person makes (a trade partner or a number: quote,
     start, papers; a customer: payment, decision, access; an architect: answer, cert); a double kind writes its first
     unless told; a null kind is just talk; a day is said once.
   - `read_question(message, asked | answered)`: asked writes *Sent to the architect as a plan question: “…”* as a gray
     event line, so the person stays waiting on the answer.
   - `add_note(contact, body, job_kind, job_id, back_on, back_words)` writes the reply box's team note with its day to
     come back, in one statement (helper 3's box calls it; a note left without its day would never come back), and
     closes the row as any note does. `set_back_day(note, on, words)` brings a team note back on a date or in words,
     moves it, or clears it; `back_done(note)` is Done with it.
   - `highlight(message, words)`, the message's own words, once (returns the highlight); `unhighlight(highlight)`.
   - `follow_up_count()`, the badge: each person once across a standing note whose day has come (a person's newest note
     with a day; a newer one replaces an older), an open or woken conversation, and an open row of what we owe. The
     portal's paper rows and the clause rows join it with their own reads.
   - Helpers: `follow_up_user_name` and `follow_up_user_known` (`SECURITY DEFINER`, a name and a yes only, since the
     users table hides some teammates from some roles), `contact_display_name` (as `src/lib/contacts/load.ts` names a
     person), `follow_up_day` (*Mon Oct 5*), `owed_by_tail`, `follow_up_event`.
9. **`app_settings` `messages_assign_rule_v1`** = `{"customer": null, "trade": null, "arch": null}`, the seats *Who gets
   a new message* reads (`whoGetsIt` in the kernel). The owner and dev set it through the key-scoped policy
   `master_or_dev_update_messages_assign_rule`.
10. **`contacts_fold_follow_up(victim, survivor)`**, which the spine's `contacts_fold` runs with every other
    `contacts_fold_%` function, after it moves the lines, numbers and jobs and before the victim goes (the lead's call,
    2026-10-12: no cut redefines the fold). It moves what they are owed (when both are owed something, the newest
    marked stands and the other closes as `folded`), opens the conversation when either was open (else snoozes to the
    sooner day, else done) and keeps who has it. The highlights and the heard days hang off the lines, which have
    moved.
11. **The three house calls**: `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()`,
    `apply_digital_twin_write_blocks()`. None of the three new tables carries `bid_id`, so a twin writes none.

## Checked before the push

**The SQL bed** (`npm run test:pg:messages-follow-up`, the new `messages-follow-up` bed, in CI's SQL beds workflow; no
session on the office Mac reaches Docker): every migration on Supabase Postgres 17, this one once more (changing
nothing), then the scenario, rolled back.

- Every conversation starts closed, the names read as the screens show them, and the badge reads 0.
- Signed out, nothing is pressed or read. No sign-in, a training account, a twin and the superintendent are each
  refused in words, on every press.
- Greg's text opens his conversation; Robert takes it, once; Rosa takes it from him, hands it to the superintendent and
  puts it back; an archived teammate is handed nothing; Rosa gives the unknown number to the owner. Every change is a
  gray line in words. Our reply closes it and clears who has it; an older email moves nothing; his next text reopens it;
  an older email of ours and an event move nothing.
- Remind me Monday runs to the coming Monday and leaves the badge; its day wakes it, and so does his next text sooner.
  No reply needed closes it and puts it back; Reopen opens it; a fourth state is refused; a conversation or a message
  that is not there is refused in words.
- Rosa marks what we owe Priya, changes what, moves the day to words and to no day, each a gray line, and nothing
  changed writes nothing. One open row; what comes first; a day is a date or words; a second open row is refused.
- The badge counts Priya once though she is in all three sections. A note whose day has come counts; a newer note's
  later day replaces it; once that is done, nothing older comes back.
- A team note marks it done and closes her row; the note is required; nothing owed, nothing done. Only her own team
  note or our message marks a row done, and done says how.
- Greg's heard days: a payment is refused for a trade partner, a W-9 for a start; a start writes a start; a day is
  said once; papers written as a W-9; just talk. Priya's quote is refused and her payment written.
- A plans question goes to the architect as a gray line and Greg still waits; asked once; a line that is no question.
- A note's day: Rosa writes a note tied to the clinic with its day in words, in one write; a note has words, and a day
  is a date or words; a team note only comes back; set in words, cleared, and nothing to clear after.
- Highlights: the same words twice are one; words not in the message are refused; removed once.
- Who is this? folds the unknown number into Hillside's own person: the newest owed stands, the other closes as
  folded, the conversation opens (she was waiting) and the owner still has it.
- The superintendent reads nothing and no badge. Nobody writes their text, or a note as someone else, by hand; a note
  of one's own is allowed and closes the row.
- The seats start empty; an estimator sets none; the owner sets them.

## Verify after the push

```sql
-- 1. The new tables' policies and grants, and the restrictive line policy.
SELECT tablename, policyname, permissive, cmd FROM pg_policies
WHERE tablename IN ('contact_owed', 'message_promises', 'message_highlights')
   OR policyname = 'messages_client_writes_own_team_lines' ORDER BY 1, 2;
-- expect: per new table the three digital_twin_write_fence_* and three read_only_users_cannot_* (RESTRICTIVE), <table>_team (PERMISSIVE, ALL);
--         messages_client_writes_own_team_lines (RESTRICTIVE, INSERT)
SELECT count(*) FROM information_schema.role_table_grants
WHERE table_name IN ('contact_owed', 'message_promises', 'message_highlights') AND grantee = 'anon';
-- expect: 0

-- 2. Every conversation starts closed; the seats' row is there.
SELECT state, count(*) FROM public.contacts GROUP BY 1;
-- expect: done only
SELECT value_text FROM public.app_settings WHERE key = 'messages_assign_rule_v1';

-- 3. The trigger, the guard and the fold's step.
SELECT tgrelid::regclass, tgname FROM pg_trigger WHERE tgname IN ('messages_move_state', 'contact_owed_guard') ORDER BY 1;
SELECT proname FROM pg_proc WHERE proname LIKE 'contacts\_fold\_%' ORDER BY 1;
-- expect: contacts_fold_follow_up among them
```

## Rollback

```sql
DROP TRIGGER IF EXISTS messages_move_state ON public.messages;
DROP TRIGGER IF EXISTS contact_owed_guard ON public.contact_owed;
DROP POLICY IF EXISTS messages_client_writes_own_team_lines ON public.messages;
DROP POLICY IF EXISTS master_or_dev_update_messages_assign_rule ON public.app_settings;
DELETE FROM public.app_settings WHERE key = 'messages_assign_rule_v1';
DROP FUNCTION IF EXISTS public.contacts_fold_follow_up(uuid, uuid), public.follow_up_count(), public.unhighlight(uuid),
  public.highlight(uuid, text), public.back_done(uuid), public.set_back_day(uuid, date, text),
  public.read_question(uuid, text), public.write_down(uuid, text, text), public.add_note(uuid, text, text, uuid, date, text), public.owed_done(uuid, text, text, uuid),
  public.mark_owed(uuid, text, date, text), public.owed_by_tail(date, text), public.set_state(uuid, text),
  public.hand_to(uuid, uuid), public.take_it(uuid), public.follow_up_event(uuid, text), public.follow_up_day(date),
  public.contact_display_name(uuid), public.follow_up_user_known(uuid), public.follow_up_user_name(uuid),
  public.follow_up_press(text), public.messages_move_state(), public.contact_owed_guard();
DROP TABLE IF EXISTS public.message_highlights, public.message_promises, public.contact_owed;
ALTER TABLE public.messages DROP COLUMN IF EXISTS back_words, DROP COLUMN IF EXISTS back_done_at;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS state, DROP COLUMN IF EXISTS snoozed_until,
  DROP COLUMN IF EXISTS has_user_id, DROP COLUMN IF EXISTS has_since, DROP COLUMN IF EXISTS has_how;
```

## Status

Written 2026-10-12 with the migration, stacked on the spine's (#5431), whose `contacts_fold` runs the `contacts_fold_%`
functions. Not pushed: `supabase db push` after both are on `main`.
