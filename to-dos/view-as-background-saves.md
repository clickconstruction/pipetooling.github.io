---
name: "View as: the saves it held back, and what is left to walk"
number: 417
group: close
status: built 2026-11-21 · v2.8176 (#9218), v2.8241 (#9311), v2.8246 (#9318) and v2.8251 (#9324) merged, #9324 on 2026-11-23 with its migration on prod under its original stamp · walks 1, 2 and 4 walked on clicktooling.com on 2026-11-24 on Fable 5.2 and hold, walk 3 rests on its tests · left: four calls for Taunya, and her word to retire the card
summary: >
  A dev in View as is signed in as the person, so saves the app makes with no press landed on that
  person: their last seen time, their app time, a salaried clock sync, and "seen" marks that cleared
  answers and requests they had not read. Three client PRs now hold those while View as is on, and
  Exit no longer leaves a dev signed in as the person when the session swap is refused. A migration
  that makes the server refuse the activity heartbeat for an imitated session is on prod.
  Exit, the seen mark on a bid request and the server refusal were walked on the live site on
  2026-11-24 and hold. The salary sync rests on its tests.
next: Taunya's four calls below, and her word to retire the card. Nothing here is left to build, push or walk. The salary sync stays on its tests until someone sets up a salaried ZZ test person.
size: S; left: nothing to build or walk, four calls for Taunya
blocker: "None. Taunya's word of 2026-11-22, *Wait for Fable*, is met: #9324 merged on 2026-11-23, its migration is on prod, and the walks were done on Fable 5.2 on 2026-11-24. Until 2026-11-24 this line said that #9324, merged and not pushed, would hold every Pages deploy. That was wrong, and it never did. A deploy holds only when the client calls a function that a migration not yet on prod creates. A function such a migration replaces is a warning, and the client never calls `session_opened_by_imitation()`."
ver: v2.8176 · v2.8241 · v2.8246 · v2.8251
opinion: close it on Taunya's word, now that the push and the walks are done — the open calls below are new work, each its own card if Taunya wants it
mockup: not required — no screen changed; the walks read network calls and rows
---

# View as: the saves it held back, and what is left to walk (#417)

## Where this comes from

On 2026-11-20 a dev used View as on a teammate to show a page live. The browser was signed in as
that teammate, so two saves the app makes with no press landed on them: the app activity heartbeat
(their last seen time and app time) and the clock button's salary sync. Taunya posted it as a note
to fix. The work then grew on her word of 2026-11-21: *Help me fix the things you identified* and,
for the server side, *Yes, build it*.

The session that built it (a Code session started from the docs catch-up session) left a survey of
every save a page makes with no press, in the shared side-session notes folder as
`view-as-background-saves-survey.md`. The same table is in the body of PR #9218.

## What was built

- **v2.8176 (#9218).** The heartbeat (`bump_user_app_activity`) and the clock button's salary sync
  make no call while View as is on. The flag is read at each send, so a tick scheduled before an
  imitation is held too. Exit takes the flag off only after the dev's own session is back. Walked
  live on 2026-11-21 on the Sample superintendent: no heartbeat in 100 seconds, and the sample's
  last seen time did not move.
- **v2.8241 (#9311).** Exit reads the session swap's answer. A refusal, a throw or a stash with no
  session signs that browser out (local scope) and lands on the sign-in page. Before, a refused swap
  took the banner away while the browser was still the person's. One kernel, `leaveViewAs` in
  `src/lib/impersonationExit.ts`, serves both doors.
- **v2.8246 (#9318).** The seen marks are held while View as is on: a tagged note's answers, a bid
  request, a bid's unread notes, a plan question's answers, a law firm's intake answers, a first look.
  The My Time day editor's salary sync on an empty salaried day goes through the same unasked kernel
  as the clock button.
- **v2.8251 (#9324).** Migration `20261122021600_imitated_session_holds_app_activity.sql`:
  `session_opened_by_imitation()` reads the token's `amr` for a magic-link sign-in and looks for a
  `user_imitations` row of the same person from 2 minutes before it to 1 minute after.
  `bump_user_app_activity()` writes nothing for such a session. Its new SQL bed, `imitated-session`,
  passed in CI. The window is minutes, where `gmail-mine` reads back a day, because a person's own
  emailed sign-in link must never be held. Merged on 2026-11-23 at 16:39 UTC and on prod under that
  stamp. Read on 2026-11-24: the ledger holds `20261122021600`, `npm run check:migration-drift` is
  clean at 1,474 files, and the dev seat's catalog lists `session_opened_by_imitation`. A session
  cannot read a function's body on prod, so the early return in `bump_user_app_activity()` is proved
  by walk 4 below, not by reading it.

## Left to do and to walk (2026-11-22, walked 2026-11-24)

### Walks owed

Every walk is as a dev in Settings → View as… on a sample account, never a real person. Sign the
pane in with `node scripts/dev-pane-login.mjs`. Count the calls with a wrapper on the page's own
`fetch`, since the pane's network list missed the app's database calls on 2026-11-21. Press nothing
that saves except a ZZ test row's own setup and cleanup.

1. **Exit (v2.8241).** Watch: a press on Exit returns to the page left, the banner is gone, and no
   `sb-` key is left for the sample. The refused-swap path cannot be walked without breaking a live
   session, so it rests on `impersonationExit.test.ts` and the Exit render test. Walked on
   2026-11-24 and holds.
2. **The seen marks (v2.8246).** Set up as the dev: mark a ZZ test bid for the Sample estimator with a
   note (a press that writes one `bid_mark_requests` row). Then View as the Sample estimator and open
   that bid. Watch: the strip under the title shows the note, no `bid_mark_requests_seen` call goes
   out, and the request row's `seen_at` stays null. Exit, then take the request back. A request taken
   back stays as a closed row, since no press deletes one. The other five marks (`job_note_tags_seen`, `task_note_tags_seen`,
   `legal_firm_intake_seen`, the first look stamp, the `user_bid_notes_read_state` upsert and the
   `bid_plan_questions` update) need a sample with something unseen of each kind; one is enough to
   prove the pattern on the live build. Walked on 2026-11-24 for the bid request and holds. The other
   five were not walked.
3. **The salary sync, both doors (v2.8176, v2.8246).** No sample account is salaried, so neither the
   clock button's sync nor the day editor's can be shown live. Both rest on their tests
   (`ClockInOutButton.viewAsHoldsSalarySync.render.test.tsx`, `MyTimeEditorHooks.render.test.tsx`).
   A live walk would need a salaried ZZ test person, which nobody has set up. Not walked on
   2026-11-24, for that reason, and no salaried test person was made.
4. **The server refusal (#9324), after its push.** In View as on a sample, call the heartbeat by hand
   through the page's own Supabase client, since the client no longer sends it. Watch: the call
   answers, and the sample's `user_app_activity_daily.last_seen_at` does not move. Then Exit and
   check that the dev's own heartbeat still moves the dev's own row. The dev's pane sign-in is a
   magic link too, so this is the check that a session nobody imitated is never held. Walked on
   2026-11-24 and holds.

**Walks 1, 2 and 4, on clicktooling.com on 2026-11-24, 08:07 to 08:11 UTC.** As the dev in a headless browser at 1280 px, on Fable 5.2.
One kept browser profile with the service worker blocked, three sittings, every load 15 seconds apart, no 429.
At each sitting the page ran `index-13WdDLLG.js`, the bundle the host's `index.html` named when read from outside the browser.
Calls were counted by a wrapper on the page's own `fetch` and again on the wire, and the two counts agreed.
Rows were read through the dev seat.

- **1, Exit, holds.**
  - **View as…** was pressed in Settings, on the Estimator role, whose press named the Sample estimator.
  - In View as the header read **Exit impersonation (Sample estimator)**.
  - Exit was pressed two loads later, from the open bid.
  - It landed on `/settings`, the page View as was pressed on, signed in as the dev.
  - No exit press was left on the page, and the stash key `impersonation_original` was gone.
  - The browser held one `sb-` key, and it was the dev's. Session storage held none.
  - Not seen: the refused swap. It rests on `impersonationExit.test.ts` and `Layout.viewAsExit.render.test.tsx`, as before.
- **2, the seen marks, holds for the bid request.**
  - As the dev, the open bid's title was read before any press: BP398, ZZ Test.
  - **For someone…**, the Sample estimator from the list, a note that names this card, and **Mark for Sample** made one `bid_mark_requests` row. The phone box was not ticked.
  - In View as the Sample estimator the bid was opened twice, on two loads. Both times the strip under the title showed the note with **Not for me** and **Done**.
  - No `bid_mark_requests_seen` call left the page, in 80 seconds on the first look or in the second look.
  - The row's `seen_at` read null after the first look and after the take back. The dev's title read *not seen yet* after Exit.
  - After Exit, **Take it back** on the request's own card answered 1 row.
  - Not seen: the other five marks. The bid was opened on its Counts tab, which is not where a bid's notes are marked read.
- **3, the salary sync, not walked.** No sample account is salaried. It rests on `ClockInOutButton.viewAsHoldsSalarySync.render.test.tsx` and `MyTimeEditorHooks.render.test.tsx`.
- **4, the server refusal, holds.**
  - In View as the Sample estimator the client sent no heartbeat in 80 seconds, which is v2.8176's hold seen again.
  - Two heartbeats were then sent by hand through the page's own Supabase client, taken from the bundle's entry module.
  - The first was the seen bump, `p_seconds` 0. The second was a minute on a page, `p_seconds` 60 and `p_page` `bids:counts`, as an older build would send.
  - Both answered 204, at 08:09:28 and 08:09:30 UTC.
  - The sample's `user_app_activity_daily` did not move. It has no row for 2026-11-24, and its newest row is still 2026-11-21 with the same last seen time and app time.
  - `user_app_activity_page_daily` got no row for the sample.
  - After Exit the app's own heartbeat went out as the dev and answered 204 at 08:10:40. The dev's row then read a last seen time of 08:10:40.
  - The same seen bump by hand, as the dev, answered 204 at 08:10:52. The dev's row moved to 08:10:52 and its app time stayed as it was.
  - The dev's row was read in the page straight before and straight after that call, because other sessions were signed in as the same dev account and move that row too.
  - The dev's sign-in was a magic link with no imitation beside it. So a session nobody imitated is not held.
- **Left on production.**
  - One closed `bid_mark_requests` row on BP398, `f3b264e2-b07b-49bb-b7d7-ad4ff2155896`, `taken_back`, never seen. The test row of 2026-10-01 on another bid is the same kind.
  - One `user_imitations` row for the Sample estimator at 08:08 UTC. Every View as writes one.
  - Nothing on the sample's activity. The dev's row holds the dev's own visit.
- **Seen, not fixed.**
  - A guard at the browser was set to hold and list any table write the page made by itself in View as. It held none, on Settings and on the bid's Counts tab.
  - The RPCs the page sent in View as were reads by their names. The `team-scores` function was called once, and what it writes was not looked into.
  - Two heartbeats left the browser between the press on Exit and the hand call. Read from the code and not proved here: the first is the leaving page's part of a minute, sent once the dev's session is back, so the time spent looking lands on the dev.
  - The script and its three outputs are in the side-session notes folder of that night, under `417-view-as-walks`.

### Loose ends

- **#9324 and its push, done.** The building session was moved to Opus and asked whether to
  push and walk there. Taunya's answer on 2026-11-22: *Wait for Fable*. #9324 was 6th in the merge
  queue at 06:10 UTC and was taken out at 06:15 UTC, green and unarmed. It merged on 2026-11-23 at
  16:39 UTC, and its migration is on prod.
  Corrected on 2026-11-24: this loose end, the blocker line and a comment on #9324 said that the deploy's `check:calls-ahead --prod` step fails while a merged migration replaces a function the client calls, so every Pages deploy would wait until the push.
  That was wrong.
  The step holds a deploy only when the client calls a function that a migration not yet on prod creates, because prod would refuse that call.
  A function such a migration replaces is printed as a warning and the deploy goes on, because prod's old body answers until the push (`scripts/check-calls-ahead.ts`, the *replaced* and *missing* branches).
  #9324 replaces `bump_user_app_activity`, which the client calls, and creates `session_opened_by_imitation()`, which the client never calls.
  So its *push right after the merge* label was the warning, and #9324 never could have held a deploy, merged or not.
  A correcting comment is on #9324.
- **The migration's stamp fell behind main's, and it went on as it was.** `20261122021600` was the
  newest when it was written; by 07:00 UTC on 2026-11-22 main held three later ones (the last
  `20261122032000`). The rename this line asked for was not needed and was not done.
  The ledger holds the file under its original stamp, between `20261122000500` and `20261122021800`.
  How that push went was not looked into. `scripts/db-push.sh` retries with `--include-all` when a file is older than the last one applied.
- **The walks were held for Fable too**, on the same word. They were done on Fable 5.2 on 2026-11-24, and their results are under *Walks owed*.
- **The other unpressed saves still run in View as.** From the survey, still open: nav telemetry
  (`ui_nav_clicks`), the Dashboard's day book snapshot (`day_book_queue_snapshots`), the dispatch
  inbox self-heals (`dispatch_requests`), the hub's office schedule fill
  (`ensure_office_schedule_blocks`), the tally's silent payroll flags, the partnership tab's
  `set_job_partner_majority`, Job Mode's trip day (`trip_phone`), the bid working board's columns, a
  machine check sheet's open check, an old device's report reads and pinned tabs, and a draft
  estimate from `?newEstimate=true`. `useOutboxReplay` does not read the flag either. Not verified:
  whether `paid-job-email`'s preview or `bill-read` write on a read, and what
  `sync_roadmap_to_checklist` writes. None of these clears something the person has not read.
- **Server refusals not built.** The salary sync is left client-side on purpose: the server cannot
  tell the clock button's own sync from the sync after a pressed save, which can be for another day.
  The four seen-mark RPCs (`job_note_tags_seen`, `task_note_tags_seen`, `bid_mark_requests_seen`,
  `legal_firm_intake_seen`) could each take `session_opened_by_imitation()` in one line now that #9324
  is live. The table writes (`user_bid_notes_read_state`, `bid_plan_questions.seen_at`, the first look
  stamp) would need a policy or a trigger.
- **Exit's sign-in page says nothing.** A dev signed out by a refused swap lands on the plain sign-in
  page with no reason given, and a lost signal at the press signs out too, with no retry.

### Calls that are Taunya's

The recommendation after each is the building session's, not hers.

1. **Hold the rest of the unpressed saves in View as?** Recommended: not now. None of them costs the
   person something unread. Do it only with a CI check that refuses a new unpressed save without the
   flag, or the list grows back.
2. **Refuse the seen-mark RPCs on the server too?** Recommended: yes, as one small migration after
   #9324 is pushed and walked. Each is one line, and it covers an older build still open somewhere.
3. **Correct the activity rows from before the fix?** Recommended: change nothing. A day's row is
   totals with no session on it, so no correction can be exact. Nine real accounts were imitated on
   19 and 20 November; their first and last seen times can be read against `user_imitations`, their
   app time cannot be split.
4. **Refuse the salary sync on the server?** Recommended: no. The rows it writes are the ones the
   server's own schedule writes, and refusing it would also refuse a press made in View as, which
   saves as the person by design.
