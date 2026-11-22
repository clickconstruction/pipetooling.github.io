---
name: "View as: the saves it held back, and what is left to walk"
number: 417
group: close
status: built 2026-11-21 · v2.8176 (#9218), v2.8241 (#9311) and v2.8246 (#9318) merged · the server refusal #9324 in the merge queue, 6th at 06:10 UTC on 2026-11-22 · left: the migration push after #9324, the walks below, and four calls for Taunya
summary: >
  A dev in View as is signed in as the person, so saves the app makes with no press landed on that
  person: their last seen time, their app time, a salaried clock sync, and "seen" marks that cleared
  answers and requests they had not read. Three client PRs now hold those while View as is on, and
  Exit no longer leaves a dev signed in as the person when the session swap is refused. A migration
  that makes the server refuse the activity heartbeat for an imitated session is in the merge queue.
  Nothing has been walked on the live site since the first PR.
next: When #9324 merges, push its migration (bash scripts/db-push.sh from a checkout at origin/main), then do the walks below as a dev in View as on a sample account.
size: S; left: one migration push (XS) and one sitting of walks (S)
blocker: "#9324 is still in the merge queue, and its push has to follow its merge within minutes, since check:calls-ahead holds every Pages deploy until it lands."
ver: v2.8176 · v2.8241 · v2.8246
opinion: close it after the push and the walks — the open calls below are new work, each its own card if Taunya wants it
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
- **#9324, not merged.** Migration `20261122021600_imitated_session_holds_app_activity.sql`:
  `session_opened_by_imitation()` reads the token's `amr` for a magic-link sign-in and looks for a
  `user_imitations` row of the same person from 2 minutes before it to 1 minute after.
  `bump_user_app_activity()` writes nothing for such a session. Its new SQL bed, `imitated-session`,
  passed in CI. The window is minutes, where `gmail-mine` reads back a day, because a person's own
  emailed sign-in link must never be held.

## Left to do and to walk (2026-11-22)

### Walks owed

Every walk is as a dev in Settings → View as… on a sample account, never a real person. Sign the
pane in with `node scripts/dev-pane-login.mjs`. Count the calls with a wrapper on the page's own
`fetch`, since the pane's network list missed the app's database calls on 2026-11-21. Press nothing
that saves except a ZZ test row's own setup and cleanup.

1. **Exit (v2.8241).** Watch: a press on Exit returns to the page left, the banner is gone, and no
   `sb-` key is left for the sample. The refused-swap path cannot be walked without breaking a live
   session, so it rests on `impersonationExit.test.ts` and the Exit render test. Not walked: it merged
   at 04:35 UTC on 2026-11-22, after the building session was moved to a model its brief said must
   build nothing.
2. **The seen marks (v2.8246).** Set up as the dev: mark a ZZ test bid for the Sample estimator with a
   note (a press that writes one `bid_mark_requests` row). Then View as the Sample estimator and open
   that bid. Watch: the strip under the title shows the note, no `bid_mark_requests_seen` call goes
   out, and the request row's `seen_at` stays null. Exit, then take the request back and leave no ZZ
   row behind. The other five marks (`job_note_tags_seen`, `task_note_tags_seen`,
   `legal_firm_intake_seen`, the first look stamp, the `user_bid_notes_read_state` upsert and the
   `bid_plan_questions` update) need a sample with something unseen of each kind; one is enough to
   prove the pattern on the live build. Not walked: merged at 05:03 UTC on 2026-11-22, same reason.
3. **The salary sync, both doors (v2.8176, v2.8246).** No sample account is salaried, so neither the
   clock button's sync nor the day editor's can be shown live. Both rest on their tests
   (`ClockInOutButton.viewAsHoldsSalarySync.render.test.tsx`, `MyTimeEditorHooks.render.test.tsx`).
   A live walk would need a salaried ZZ test person, which nobody has set up.
4. **The server refusal (#9324), after its push.** In View as on a sample, call the heartbeat by hand
   through the page's own Supabase client, since the client no longer sends it. Watch: the call
   answers, and the sample's `user_app_activity_daily.last_seen_at` does not move. Then Exit and
   check that the dev's own heartbeat still moves the dev's own row. The dev's pane sign-in is a
   magic link too, so this is the check that a session nobody imitated is never held. Not walked:
   not merged or pushed.

### Loose ends

- **#9324 and its push.** Queued 6th at 06:10 UTC on 2026-11-22. `check:calls-ahead` labels it *push
  right after the merge*: until `bash scripts/db-push.sh` runs from a checkout at `origin/main`, every
  Pages deploy waits. The old function body answers the client meanwhile, so nothing breaks, but
  other merges do not reach the site. The building session asked Taunya whether it may push and walk
  on the model it was moved to.
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
  `legal_firm_intake_seen`) could each take `session_opened_by_imitation()` in one line once #9324 is
  live. The table writes (`user_bid_notes_read_state`, `bid_plan_questions.seen_at`, the first look
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
