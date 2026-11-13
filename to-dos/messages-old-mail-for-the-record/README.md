---
name: "Messages: old mail lands for the record, and a thread can be closed in plain sight"
number: 324
group: close
status: built 2026-11-12 as five PRs, all merged and live · the migration pushed, gmail-mine and dev-mcp deployed · left: the first tag a person presses in My email, and the dev's call on the batch of 2026-11-09
summary: >
  On 2026-11-09 a batch of old email conversations was tagged from a teammate's own mailbox onto
  jobs through the dev seat. Every mail landed at its own date, months back, and Messages read each
  one as a message nobody had answered: unnamed senders in New under Who is this?, Our move with
  three-digit day counts, Nobody has it. The cause is one missing comparison. Every line keeps
  when it was written and when it landed, and nothing that asks "is someone waiting" reads the
  second. The same look found that closing a thread with no reply exists (No reply needed) but sits
  in a menu, is not offered on a New row at all, and leaves no trace of who closed it or when.
  Four small pieces: a mail more than 14 days old when it lands is filed for the record and is
  nobody's move; the age decides and a person overrules in one press; No reply needed and the
  thread's state sit in plain sight, on New's cards too; and a fold lists what was done with no
  reply this week, each with Reopen. No new lane, no new state, no third word.
next: Watch the first save an office person presses in Messages → My email (the press is **Save to job…** since v2.7073), and read the line the green bar prints after it. Then the dev's call 2, whether the batch of 2026-11-09 stays on its jobs. Delete the folder after both.
size: M as a train of five (S · S · S · S · S), all built; left: a look at one real press (XS)
blocker: Nobody in the office has tagged by their own press since the line after a tag went live (v2.7032), so the line is unproven by use.
ver: v2.7026 · 7027 · 7029 · 7030 · 7032
opinion: built — the cause is gone and the exit is in sight; watch one real press, then close the card
---

# Messages: old mail lands for the record, and a thread can be closed in plain sight

Mock-up: [`mockup.html`](./mockup.html). One spot at a time, **Now** against **My suggestion**, the recommendation first. Every name, address, job and date in it is made up.

## The ask, in the dev's words (2026-11-12)

> Job tags are great … it would allow anyone to catch up on what's happening on a job. But right now in messages, these are showing up as new, suggesting that we should have someone respond to them, instead of the backfill which they seem to appear to have attempted to be. How can the app facilitate this? Sometimes a thread closes and there's no need for a reply on either side, but the only options I see at the moment are: New, Needs you, Needs a reply, We owe them, Waiting on them, Went out. Help me look at the app holistically and let me know how we might be able to overcome this.

## The recommendation, short

1. **Old mail lands for the record.** A mail more than 14 days old at the moment it lands is marked as history. It sits in the thread and on the job at its own date. It opens nothing, counts nowhere and is nobody's move. A new mail in the same conversation still opens the thread.
2. **The age decides, and a person overrules in one press.** No tick before a tag. The tag says what it did and offers the opposite. The seat's plan says it per mail and can force "for the record" for a batch.
3. **No reply needed, in plain sight.** The press sits on the thread beside *We owe them…*, on New's sort card and on the Sort desk. The thread shows its state. The press writes one grey line, so there is a who and a when.
4. **A fold, not a seventh lane.** *N done with no reply this week*, under the queue, each row with **Reopen**.

Keep the words the app has: **Done** for the state, **No reply needed** for the press. Do not add *Closed*.

## Final changes, from the second look (2026-11-12)

The dev asked for one more pass, *is this the best we can do?*, before the build. Reading the plan against the code again changed five things. Where a section below disagrees with this list, this list stands.

1. **The age rule belongs to the tag, not to the writer.** The first plan stamped the mark inside `email_write_line`, which every mail writer calls. A reader of a company box that fell 15 days behind (a revoked token, an outage) would then have filed real customer mail in silence. Mail in a person's own box was seen by that person when it came. Mail in the team box was seen by nobody until the app read it. So only `gmail-mine` decides, and the company boxes' readers never file.
2. **A filed mail of ours still counts as our answer.** A customer writes to the team box, a teammate answers from their own mail, and three weeks later tags the conversation. The first plan made filed mail nobody's move both ways, which would have left that thread open. Now a filed mail of theirs asks nobody, and a filed mail of ours still answers, as any late line of ours does today.
3. **Reopen takes the mark off.** A reopened thread with only filed mail would have read Open with *Nothing waits* and no row in New. `set_state` now un-files the thread's mail on Reopen, since a person has said it is live.
4. **The migration clears the four stale threads.** Marking the old lines without closing the threads they opened would have left four Open rows with no words. The migration closes a thread only filed mail opened and nobody holds. The four presses in section 6 are not needed.
5. **The move line reads the state.** Today a thread that is Done after a note or after **No reply needed** still says *Our move · 2 d* in its header, the same confusion from the other side. A Done thread whose last word is theirs says *Nothing waits*.

Two smaller ones. **No reply needed** needs no new function: it calls `set_state` and then `follow_up_event`, as Heard back does. The card said its grey line would stop an old mail reopening the thread. It does not, and it does not need to: the mark does that. And `set_state` never cleared a tech's hold on close, so **No reply needed** on a held thread was refused. Fixed in PR 1.

The train is five PRs, not four: the migration goes first and alone, because the client reads the new column by name.

## What happened, measured

Read on 2026-11-12 from prod through a local copy of the app signed in as the dev, with every request that was not a GET refused. Counts and ages only.

| | |
|---|---|
| Tags on jobs, all time | 22: 1 on 11-07, **17 on 11-09**, 4 the app placed since from a person's Sent |
| Lines the 11-09 tags wrote | 38, about half in and half out |
| Their age when they landed | 37 were 3 to 12 months old, 1 over a year |
| People they landed on | 10, of whom 8 did not exist before the tag |
| Open today from those tags | 6. All read *Our move*. Nobody has any of them. |
| Of those 6, stale | **4**: the newest mail from them is over 90 days old |
| Of those 6, live | 2: mail from the last week, which should stay open |
| Pushes sent for any tagged line | 0 |
| The whole board | 30 open conversations, 24 of them unnamed senders; New shows 27 |
| Open and landed late | 4, and they are exactly the 4 stale ones |
| Open, 15 to 30 days old, landed on time | 7. Real mail nobody has sorted. Not this card's doing. |

Two things follow. The batch left four wrong rows, not dozens, and New sorts the oldest first, so those four sit at the top of the lane where the dev looked. And the test this card proposes, *landed more than 14 days after it was written*, picks exactly those four and nothing else on the board.

## What the code does today (read on main, 2026-11-12)

**The state.** `contacts.state` is Open, Snoozed or Done (`src/lib/followUp/queue.ts`). The trigger `messages_move_state` (last stated in `20261107083000_hold_ends_with_holder.sql`) moves it as a line lands: a line in opens the thread unless a line of ours or a note is newer *by the line's own date*; a line out or a note closes it. It skips a line the app sent by itself (`messages.auto`).

**A tagged mail.** `landMail` in `supabase/functions/gmail-mine/index.ts` places the sender (`email_place_address`, which makes an unnamed contact when no one holds the address) and writes the line through `email_write_line` at the mail's own date. The tag, the follow and the Sent read all land through it. Nothing reads how old the mail is.

**So, for an old mail:**

- A new sender is made unnamed and the trigger opens the thread. `newLane` (`followUp/newLane.ts`) sorts any unnamed sender with a line in as **Who is this?**, whatever its age.
- **An old mail reopens a thread that was Done by a press.** *No reply needed* writes no line, so the trigger finds nothing of ours after the old mail and opens it. Not checked before; confirmed in the trigger.
- The move line counts from the mail's date (`courtOf` in `messages/thread.ts`), so it reads *Our move · 178 d*.
- The badge (`follow_up_count`) counts every Open contact, so each of these raised it.
- *Longest wait right now* on the week strip (`weekStrip.ts`, `waitsFromQueue`) reads Needs a reply's oldest row, so an old mail on a named person would lead that tile.
- **No push.** `messages-notify` sweeps lines whose own date is inside the last hour or so (`sweepSince`) and only for customers, leads and subs (`PUSH_KINDS`). `gmail-mine` never names a line to it. The read above found no push row for any tagged line.
- **Waiting on them is safe by luck.** It reads the last 30 days of lines (`waitingOnThemIo.ts`), so a month-old mail of ours is out of its window. A mail of ours 15 to 30 days old would show as *Their move · 20 d*.
- The nudges (`flows/nudges.ts`) read each person's quiet days and our last message. Not read line by line. PR 1 checks whether a filed mail can move them.

**Closing with no reply.** It exists and it is hard to see.

- `stateMenu` offers **No reply needed**, **Remind me Monday** and **Reopen**. They draw in the thread's ⋯ menu (`useFollowUpThreadSlots.tsx`), on a row in Needs a reply (`FollowUpSections.tsx`) and on the Answer all desk.
- **A New row has no such press.** Its card (`NewLaneCard.tsx`) offers the guesses and *A notice, not a person*. The Sort desk offers *Skip for now*. An unnamed sender can only be named or called a notice. The four stale rows were all in New.
- The thread shows a chip when it is Snoozed and nothing when it is Open or Done. The status row holds *We owe them…* and the note's day.
- `set_state` writes the state and nothing else: no line, no who, no when. So nothing can list what was closed.
- Their side has its own exit: Waiting on them's **Heard back ▾ → No answer needed** (`waitingOnThem.ts`), which does write a grey line.

## The decision

### 1. History at landing

**A mail lands for the record when it is more than 14 days old at the moment it lands.** Judged per mail, not per conversation.

- **Why per mail.** The trigger already runs per line. A conversation with eight old mails and one from this morning then does the right thing with no special case: eight are filed, the ninth opens the thread. Judging the conversation as a whole would need a rule for mixed ones and would get the follow wrong, which lands one mail at a time.
- **Why 14 days.** A person tags mail from their own box as it comes, so a live tag is hours or days old. Past two working weeks, whoever was waiting has chased another way. The data cannot choose: nothing in the batch was between 8 and 90 days old, so 7, 14 and 30 treat it the same. 14 is a judgement, and call 1 is his.
- **What "for the record" means.** The line is marked (`messages.history`), as a line the app sent by itself is marked (`messages.auto`, v2.6012). Every reader that asks whose move it is skips it, the way they skip `auto`: the trigger, `lastIn` and `lastOut` and so the move line, `newLane`, Needs a reply's wait, Waiting on them, the nudges' quiet days.
- **What follows with no further code.** A contact starts Done. With no line to open it, an unnamed sender made by a filed mail never reaches New, the badge or the longest wait. A thread already Done stays Done. A thread already Open stays Open.
- **The newest mail is recent and theirs.** That one is live. It opens the thread, New asks *Who is this?*, the office hears as it would for any mail.
- **What a person reads.** Each filed line wears a small chip, `filed Nov 9`, with the hover *This mail is from March 3. It was filed here on November 9. It asked nobody for a reply.* A thread with nothing live says *Nothing waits* where the move line is. The tag's grey line gains two sentences: *This is old mail, filed for the record. Nothing went on Follow up.*
- **The unnamed sender.** Not asked about anywhere until they write again. The Activity line carries the name the mail gave. In My email the person who tags is still asked *Who is this?* on the spot, as today.

### 2. Who decides

**The age, by default. A person overrules after, in one press. The seat can say so before.**

- **My email.** No tick before the tag: the common tag is today's mail and a tick would tax every one. The line the tab prints after a tag says what was done and offers the opposite. Old mail: *Tagged onto JP1077. 6 old mails were filed for the record.* with **Put on Follow up**. Live mail: *Tagged onto JP1077. Their last mail is on Follow up.* with **No reply needed**.
- **The seat.** `plan_mail_tag` reads back, per mail, whether it would land for the record or on Follow up. One new argument, `for_record: true`, files every mail of the tag whatever its age, for a batch with nobody watching. No argument to force old mail live: nothing needs it.

### 3. A visible close

- **On the thread.** **No reply needed** sits beside *We owe them…* while the thread is Open. When it is Done the same spot shows a grey chip, *Done · no reply needed · Rosa, Nov 12*, and **Reopen**. The ⋯ rows stay.
- **On New.** The sort card and the Sort desk gain **No reply needed**. The sender stays unnamed until they write again.
- **A trace.** The press writes one grey line through `follow_up_event`: *Rosa said on Nov 12 that no reply is needed.* It mirrors Heard back's line. It gives the chip and the fold their who and when.
- **Where closed threads are seen.** A fold under the queue lanes, built like New's *notices set aside this week* (`setAsideFold.ts`): **5 done with no reply this week**. Each row names the person, how it was done (*No reply needed · Rosa, Tue* or *Old mail filed Mon · 6 mails*) and offers **Reopen**. Not a seventh segment: the strip is already tight on a phone, and a lane with a count reads as work.
- **The word.** **Done** is the state's word and **No reply needed** is the press. The fold says *done with no reply*. *Closed* or *Settled* would be a third word for the same thing. *Filed for the record* is new because the fact is new: nobody decided anything, the app filed it.

### 4. Both sides done, or our side done

They are not different states. They are the same press read from each side, and a thread only ever needs one of them.

- Their word is last: **No reply needed** ends it.
- Our word is last: the thread is already Done on our side. It shows in Waiting on them from day 2 to day 30, and **Heard back ▾ → No answer needed** ends that.

So the thread's spot shows whichever fits: **No reply needed** when their word is last, **No answer needed** when ours is and the row is in Waiting on them. Both are words the app has. *Reply* is ours and *answer* is theirs, which is the right distinction and worth keeping.

### 5. In bulk

- **Every thread one tag opened.** Not needed once piece 1 is in. A tag then opens a thread only for recent mail of theirs, which is one thread, and the after-tag line holds its **No reply needed**.
- **The Sort desk.** It gains **No reply needed** on each card (piece 3). One press a person is the desk's unit, and New holds 27.
- **A counted press on New's header**, *No reply needed for 7 older than 14 days*: not now. See What I would not build.

### 6. The threads there now

**Four presses, no code.** Open Messages. The four are the top rows of New, since New sorts the oldest first: each reads a month from last winter or spring. Open each, press **⋯**, press **No reply needed**. The two with mail from the last week are live: sort them as usual.

No script and no seat verb. Four rows cost eight presses. A prod script costs a review, and a seat verb that closes threads is a new write for the dev seat with one use.

**If the batch stays on its jobs** (call 2): PR 1's migration can mark the lines already there by the same test (38 lines), so the four threads read *Nothing waits* and wear the chip (call 7).

**If the batch comes off:** the untag deletes the lines. I found nothing in it that touches the contact, so the four would stay Open with nothing in them and fall to the foot of Needs a reply as rows with no words. The same four presses clear them. Worth a line to the session building the seat's untag: an untag that empties a contact it made should leave it Done.

### 7. What stays true

- **A new mail in a filed conversation opens the thread.** The follow lands it through the same `landMail`, minutes old, so it is live. PR 1 ships a test for exactly this.
- **Job Activity shows every line.** The mark changes whose move it is and nothing about where a line shows. Filed lines keep their job, their files and their `.eml`.
- Search, *Everyone we have talked with* and the Legal desk's evidence read the lines as before.

### 8. What I would not build, and is this the best we can do

**Would not build:**

- **A seventh lane.** Five lanes mean someone is waiting and the sixth is a log of sends. A lane of closed threads with a count would be read as a queue.
- **A new state** on the conversation. History is a fact about one mail. A conversation with old mail and a new one is simply Open.
- **A third word.** *Closed* beside Done and No reply needed.
- **A tick before every tag.** It taxes the common case to serve the rare one.
- **A sweep that closes old Open threads by age.** Seven threads on the board are 15 to 30 days old and landed on time. Those are real mail nobody sorted. The app must never decide that for the office. Only the gap between written and landed is evidence that nobody was asked.
- **A bulk close on New's header.** It would close exactly those seven real ones in one press. The Sort desk with the new press clears them one look at a time.
- **A script or a seat verb for the four.**
- **Hiding filed lines** from the thread. Catching up is the point.

**Is this the best we can do?** For the cause, yes: one comparison in one place fixes the tag, the follow, the seat and any later import, and it is the same shape as `auto`, which has held since October. Three honest limits:

1. **Age is not intent.** A mail 20 days old that truly went unanswered lands silent. The tag says so and offers **Put on Follow up**, but a batch through the seat has nobody reading that line. That is why the plan prints it per mail.
2. **The state is per person, not per topic.** One person with a finished conversation and a live one has one state. That suits an office that answers people, and a per-topic state would touch every lane. Not proposed.
3. **Nobody in the office has tagged by their own press yet.** All 17 came through the seat. Piece 2's after-tag line is designed and unproven, which is why it is the last PR.

## The calls

Taken as picked on 2026-11-12, when the dev said to build the train. Call 2 is still his.

| # | Call | My pick |
|---|---|---|
| 1 | The age a mail is filed at: 7, 14 or 30 days | **14** |
| 2 | The batch of 2026-11-09: stays on its jobs, or comes off | his alone; the design holds either way |
| 3 | The word: keep Done and No reply needed, or add Closed | **keep** |
| 4 | Where closed threads show: a fold, or a seventh segment | **a fold** |
| 5 | No reply needed on New's card and the Sort desk, leaving the sender unnamed | **yes** |
| 6 | The seat's `for_record` argument and the plan's per-mail word | **yes, in PR 4** |
| 7 | PR 1's migration also marks the late lines already there | **yes if the batch stays** |
| 8 | A filed mail from an unnamed sender asks *Who is this?* nowhere until they write again | **yes** |

## Where it plugs in

| What | Exists | New |
|---|---|---|
| The mark | `messages.auto` and how the trigger and kernels skip it | `messages.history boolean NOT NULL DEFAULT false` |
| The stamp | `email_write_line`, the one RPC every mail writer calls | sets `history` when the row does not say and `now() - at` is over 14 days; a caller may pass it |
| The state | `messages_move_state` | one more early return, beside `auto` |
| Whose move | `lastIn`, `lastOut`, `courtOf` (`messages/thread.ts`); `newestIn` (`followUp/queue.ts`); `newestLines` (`followUp/newLane.ts`); `waitingOnThem`; the nudges' quiet days | each skips a filed line; `courtOf` says *Nothing waits* when only filed lines remain |
| The chip | `bioMark` and its chip in `ThreadLine.tsx` (v2.6659) | `filedMark`, the same shape |
| The grey line | `myMailTagEventRow` and its words in `src/lib/myMail/mineFunction.ts` | two sentences when every mail was filed. PR 7778 owns these words now. |
| The close | `stateMenu`, `set_state`, `follow_up_event` | the press in the status row, on `NewLaneCard` and the Sort desk; one grey line a press |
| The fold | `setAsideFold.ts` and its fold under New | `doneFold.ts`, read from the last 7 days of those grey lines and of filed mail |
| The tag's answer | `MyMailTagOk` (`myMail/contract.ts`), the line `MyMailTab.tsx` prints | counts of filed and live mail; the one press |
| The seat | `mailTagArgs`, `MyMailTagPlanMail` (`_shared/devMcpMailTag.ts`) | `for_record`, and `lands` on each plan mail |

## The plan

Five PRs, each shippable alone, smallest first.

1. **PR 1 (S): the migration, alone.** `20261112180000_messages_history.sql`: the column, `email_write_line` keeping the mark, the trigger, `set_state`, and the mail already there. The bed `messages-follow-up` gains section 18. Push it before PR 2 merges.
2. **PR 2 (S): the tag files old mail, and the app reads the mark.** `planTag` marks a mail more than 14 days old. The kernels that ask whose move it is skip a filed mail of theirs. The chip, *Nothing waits*, the grey line's two sentences, and the plan's word for each mail. Redeploy `gmail-mine`. Guide: the My email guide gains a short section.
3. **PR 3 (S): No reply needed in plain sight.** The status row's press and the Done chip with Reopen. The grey line a press writes. The press on New's card and the Sort desk. Guides: `answer-everyone-waiting-on-us-from-one-page` and `reply-to-a-person-from-their-thread`.
4. **PR 4 (S): the fold.** *N done with no reply this week* with **Reopen**, under the queue lanes.
5. **PR 5 (S): the overrule.** The after-tag line in My email with its one press. The seat's `for_record`, with `dev-mcp` redeployed.

## How to verify

- **PR 1, no prod write.** The kernels and the trigger's rule are pure or SQL: unit tests, and the trigger under `BEGIN … ROLLBACK` in psql as the memory recipe has it. Live: tag one old conversation onto a ZZ Test job through the seat's plan first, read the plan, then apply, then read New, the badge and the thread.
- **The measure.** Re-run the read in *What happened, measured*: open conversations that landed late should be 0 after the four presses, and stay 0 after the next old tag.
- **Gotchas met.** `preview_start` fails in a worktree, so the walk ran headless Chrome over a shell `vite`. Page-load RPCs are POSTs, so a read-only walk must refuse by method and read through GET.

## Where it stands

2026-11-13: built and live. Five PRs merged on 2026-11-12 and 11-13 (UTC): v2.7026 the migration, v2.7027 the tag files old mail, v2.7029 No reply needed in plain sight, v2.7030 the fold, v2.7032 the line after a tag and the seat's `for_record`. Each `docs/recent-features/v2.NNNN.md` says how.

**On prod.** The migration was pushed on 2026-11-12 after a dry run inside a transaction that rolled back. It marked 38 lines and set 4 threads to Done, as measured, and left no thread open on filed mail alone. `gmail-mine` and `dev-mcp` were deployed from `main` twice, after v2.7027 and after v2.7032. The seat answers as server 0.80.0.

**Checked live, with nothing written.**

- The site serves the new words of all five PRs.
- A read-only walk of the stack against prod on 2026-11-12: the fold read *5 done with no reply this week*, and a thread of filed mail showed the *filed Nov 9* chip, *Nothing waits* and *Done · old mail, filed Nov 9* with **Reopen**. The walk found one defect, fixed in v2.7029: the header said *They have not written yet* on a thread of filed mail.
- The seat's dry run on a ZZ Test job. A mail from August would be filed (`lands: record`). Three mails from the same day would land on Follow up (`lands: followUp`). With `for_record: true` all three would be filed, and the commitment carries the flag.

**Not built.** The thread's **No answer needed** for when our word is last (section 4). The thread's read carries no line keys, so it would show on threads Waiting on them had already cleared. The lane's **Heard back ▾** stays the way.

**Left.**

- The first tag a person in the office presses in My email. None has come since the line went live (v2.7032, 00:46 UTC on 11-13), so the green bar's line and its press have run only in tests. One save before it, at 19:05 UTC on 11-12, has no seat call behind it and was most likely a person's own press (#230, Where it stands, 2026-11-13).
- No apply has run with this code: the live checks were plans. The first real apply is the seat's or a person's next tag.
- Call 2, the batch of 2026-11-09: it stays on its jobs until the dev says otherwise. Its threads are Done and read as filed either way.

**Found, not fixed.** At 375 px wide the Messages page measured about 1,000 px wide in headless Chrome, on `main` before this train as well. It was seen with the page's writes refused and needs a look on a real phone.
