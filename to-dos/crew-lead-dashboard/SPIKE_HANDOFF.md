# Job Mode in bands: the hand-over (2026-11-21)

The owner, on 2026-11-21: *"I want another user on another computer to pick up where we left off, what is the
status of what we've built, what is left to build?"*

This file is for whoever picks it up. It says what is built, what the owner still has to decide, what is left to
build and how to work on it safely. Read it first. Then read `SPIKE.md` for what the page is, the nothing-lost map
and the head count, and `ASSESSMENT.md` for why. `mockup.html` is the page the owner picked from, with made-up names.

## Where it stands

- **The branch:** `spike/crew-lead-bands`, two commits on top of `09439c1de4` (v2.8084, 2026-11-20). Nothing is on
  `main`. Nothing is claimed, and there is no release note and no PR.
- **What the owner said, in order:**
  1. He asked for a look at one crew lead's Dashboard on his phone through three lenses: tools for the job he is
     on, the story of the work around him, and how he is asked to fill things in. This one is paraphrased, because
     his brief names the person.
  2. On the three shapes in the mock-up: *"I think that B has great potential. Help me take the data that's
     currently there and build a spike so that we can see what the before and after would really look like.
     Because I don't want to lose any information. I just wanna put it in a place where it's easier to find And
     still not very far away from him."*
  3. *"Can you show me the spike before I make a decision on the one job day"*
  4. *"I'm looking at this spike and it's not the worst thing in the world, Do we lose anything in this new view
     from his old dashboard? and how many users does this affect? just the Leader role?"* The answers are in
     `SPIKE.md`, under **Nothing lost** and **Who would get it**.
- **Built:** shape B as a working page on real data. It has the four bands, the three fixes the line check called
  for, and a switch to compare Before and After. `SPIKE.md` describes all of it.
- **Checked:**
  - `npm run typecheck` gave 0 errors on 2026-11-20. Since then only one colour string changed.
  - ESLint gives 0 errors on the touched files. The seven warnings in `Dashboard.tsx` are older than the spike.
  - The 47 existing tests of the touched components pass.
  - All 17 `check:*` scripts for `src` and docs pass against the merge base, and so does `theme-tokenize --check`.
    `check:css-tokens` caught the strip's undefined `--text` first, and the second commit fixes it.
- **Not done:** no new tests. The page was walked as one person only.

## Waiting on the owner

1. **The big pinned press on a day with one job.** Follow his day (Directions, then Photo, then Leave report), or
   keep On my way. `ASSESSMENT.md` has the question under **The one question**.
2. **Who gets the page.** The pick offered was the Leader role alone first, which is one phone today. The other
   choices are the by-the-day rule from the assessment (a day with one job gets this page), or everyone in Job Mode.
3. **The go-ahead to build it.** Until he gives it, this stays a spike.

## Main moved under the spike

By 2026-11-21, 116 commits had landed on `main` since the base. Three of them touch the spike's files. A dry merge
(`git merge-tree`) conflicts in all three: `Dashboard.tsx`, `DashboardJobModeCard.tsx` and `JobModeTopRow.tsx`.

- **v2.8124** gives Job Mode's Short view the row of named squares, and its This week square opens My Time. The
  spike's `onHours` prop on `JobModeTopRow` does the same kind of job for the bands page. Keep one way.
- **v2.8122** shows the Job pace card for the next stop when a superintendent is clocked in with no job. The
  spike's card head does the same for the Job Mode card, through `bandsAheadBlock` in `DashboardJobModeCard`. Use
  one rule for both.
- **v2.8103** adds a line under Job calendar and Materials on site for boxes due a count and stickers waiting. The
  bands page draws the card whole, so the line should carry over. Add it to the nothing-lost map after the rebase.

## Left to build, once the owner decides

1. Rebase onto `main` and settle the three overlaps above.
2. Build the rule for who gets the page, in place of the device switch. Then remove `bandsSpike.ts`, `?bands=` and
   the dashed Before/After strip.
3. Change the press bar to match the owner's answer on a day with one job.
4. **Values in place** (CLAUDE.md): `bands.ts` writes plain sentences. Mark each date, count and name with `val`,
   and draw the rows with `ValueSentence`.
5. Draw the empty states through `EmptyState` and `emptyWords`: the clear waiting list, Latest on this job and My
   week.
6. Read My crew's week once. Today the bands and the My crew line each read it.
7. Write the tests: the kernel (`bands.ts`), a render smoke of `JobModeBandsPage` with `renderWithProviders`, and
   the props added to five components.
8. Walk it as a helper, a subcontractor and a superintendent on Short.
9. Write a help guide in `src/content/help/`, the release note and the `docs/recent-features` fragment. Add the
   bands to `PROJECT_DOCUMENTATION.md` and `GLOSSARY.md`.
10. Ship it small: the kernel and its tests, then the props, then the page behind its rule, then the press bar.

`ASSESSMENT.md` also lists ten quick wins that do not wait on the shape.

## Two loose ends from the same day, outside the spike

- **View as saves as the person.** Imitating someone in a browser runs two background saves as them:
  - The activity heartbeat (`useAppActivityHeartbeat`, which calls `bump_user_app_activity`) stamps their last seen
    time and app minutes.
  - The salaried clock sync (`ClockInOutButton`, which calls `syncSalaryClockSessionsForUserDay`) runs every 90
    seconds.

  Other sends already stop while `isImpersonationSessionActive()` is true. These two are not fixed yet. The fix to
  weigh: skip both while an imitation is active, with a test for each.
- **A database stall on 2026-11-20.** The sampler has no sample from 20:05:02Z to 20:29:00Z, a gap of 1,438
  seconds. It also has two-minute gaps at 19:54, 19:59 and 20:33Z. The slowest sample took 3,749.7 ms, at 20:05:01Z.
  The pooler answered the CLI with ECIRCUITBREAKER, which is Mode B in `docs/DB_FREEZE_RUNBOOK.md`. The session that
  saw it restarted nothing, and the database answered again at 20:36Z. The runbook's cron and wait-event reads were
  not run, and no incident entry is written.

## How to see it and walk it safely

- **See it:** run the dev server with Job Mode on, at a phone width. `/dashboard?bands=1` switches the device to the
  bands page, and `?bands=0` switches it back. On the dev server a dashed strip on top switches Before and After.
- **See it as the crew lead:** he is the one real account in the Leader role (`master_technician`) that is not
  archived. Find him with the dev seat's `find_person`. Sign in with `/dev-login?as=1&to=/dashboard`, then call
  `loginAsUser({ email, role }, origin + '/dashboard')` from `src/lib/loginAsUser.ts`.
- **Walk with Playwright, not a plain browser.**
  - Use a route that refuses every non-GET on `/rest/v1/`.
  - Answer `rpc/bump_user_app_activity` and `rpc/sync_salary_clock_sessions_for_user_day` with `null`.
  - A plain browser has no such fence, so it saves as him: a live view on 2026-11-20 set his last seen time.
- **Day states:** rewrite the `job_schedule_blocks` and `clock_sessions` reads with `route.fetch()` and
  `fulfill({ json })`. On site, the trip question opens by itself. Close it with the button whose aria-label is
  `Close`. Shoot screen by screen, because a full-page shot stamps the fixed bars mid-page.
- **After a walk:** delete the Playwright storage state, because it holds his sign-in. Never end an imitation with
  `supabase.auth.signOut()`. Its default scope is global, so it signs him out on his phone. Clear the stored session
  instead.
- **Press nothing that saves as him:** no clock, report, task tick, percent, hours, rating or message.

## Not in the repo

The repo is public. The screenshots show real names. The private notes name his job, the person who works beside
him and what was waiting on him that day. Both stay on the owner's computer, and the owner can pass them on. The
walk above makes new screenshots.

## The prompt for the next session

> Pick up the Job Mode bands spike for a crew lead's phone. Run `git fetch origin spike/crew-lead-bands`, check it
> out in a new worktree, and read `to-dos/crew-lead-dashboard/SPIKE_HANDOFF.md`. Then read `SPIKE.md` and
> `ASSESSMENT.md` beside it. Start with `/design-spike`. Commit only to the spike branch, and claim nothing and open
> no PR until the owner says to build it. First ask the owner the questions under **Waiting on the owner**, and
> write his answers word for word into `SPIKE_HANDOFF.md`. Once he says to build it, rebase onto `main`, settle the
> overlaps under **Main moved under the spike**, and work down **Left to build** in small PRs, following CLAUDE.md.
> Walk only as **How to see it and walk it safely** says.
