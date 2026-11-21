# Job Mode in bands: the hand-over (2026-11-21)

The owner, on 2026-11-21: *"I want another user on another computer to pick up where we left off, what is the
status of what we've built, what is left to build?"*

This file is for whoever picks it up. It says what is built, what the owner decided, what is left to build and how
to work on it safely. Read it first. Then read `SPIKE.md` for what the page is, the nothing-lost map and the head
count, and `ASSESSMENT.md` for why. `mockup.html` is the page the owner picked from, with made-up names. The prompt
to paste into the next session is at the end.

## Where it stands

- **The branch:** `spike/crew-lead-bands`, three commits on top of `09439c1de4` (v2.8084, 2026-11-20). Nothing is
  on `main`. Nothing is claimed, and there is no release note and no PR.
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
  5. The two decisions: *"Leader role alone first, follow his day"*. See **Decided** below.
- **Built:** shape B as a working page on real data. It has the four bands, the three fixes the line check called
  for, and a switch to compare Before and After. `SPIKE.md` describes all of it. The two decisions are not built
  yet.
- **Checked:**
  - `npm run typecheck` gave 0 errors on 2026-11-20. Since then only one colour string changed.
  - ESLint gives 0 errors on the touched files. The seven warnings in `Dashboard.tsx` are older than the spike.
  - The 47 existing tests of the touched components pass.
  - All 17 `check:*` scripts for `src` and docs pass against the merge base, and so does `theme-tokenize --check`.
    `check:css-tokens` caught the strip's undefined `--text` first, and the second commit fixes it.
- **Not done:** no new tests. The page was walked as one person only.

## Decided (2026-11-21)

1. **Who gets the page: the Leader role (`master_technician`) alone, first.** His words: *"Leader role alone
   first"*. Every other role keeps today's Job Mode page. The choices offered beside it were the by-the-day rule
   from the assessment (a day with one job gets this page) and everyone in Job Mode.
2. **The big pinned press on a day with one job: follow his day.** His words: *"follow his day"*. It is the bar of
   shape B in the mock-up. One press follows his day: Directions before he is there, Photo on site, and Leave report
   from mid afternoon. On my way and Turnaway move behind More. A day with several stops keeps On my way. The
   choice offered beside it was to keep On my way on that day too.
3. **Scope, as read by the session that asked:** both decisions are about him, so the press bar changes for the
   Leader role only, with the page. If the build makes that unclear, ask the owner.

The press bar is the one piece the owner has not seen on a screen. His way is to look at a thing drawn before it
ships, so draw it on the spike branch and show him before its PR.

## Main moved under the spike

By 2026-11-21, 116 commits had landed on `main` since the base. Three of them touch the spike's files. A dry merge
(`git merge-tree`) conflicts in all three: `Dashboard.tsx`, `DashboardJobModeCard.tsx` and `JobModeTopRow.tsx`.

- **v2.8124** gives Job Mode's Short view the row of named squares, and its This week square opens My Time. The
  spike's `onHours` prop on `JobModeTopRow` does the same kind of job for the bands page. Keep one way.
- **v2.8122** shows the Job pace card for the next stop when a superintendent is clocked in with no job. The
  spike's card head does the same for the Job Mode card, through `bandsAheadBlock` in `DashboardJobModeCard`. Use
  one rule for both.
- **v2.8103** adds a line under Job calendar and Materials on site for boxes due a count and stickers waiting. The
  bands page draws the card whole, so the line should carry over. Add it to the nothing-lost map after the merge.

Merge `main` into the spike branch rather than rebasing it, because a force-push is refused in the app. Cut each PR
from fresh `main`.

## Left to build

1. Catch up with `main` and settle the three overlaps above.
2. Replace the device switch with the rule: the bands page for the Leader role in Job Mode. Then remove
   `bandsSpike.ts`, `?bands=` and the dashed Before/After strip.
3. **Values in place** (CLAUDE.md): `bands.ts` writes plain sentences. Mark each date, count and name with `val`,
   and draw the rows with `ValueSentence`.
4. Draw the empty states through `EmptyState` and `emptyWords`: the clear waiting list, Latest on this job and My
   week.
5. Read My crew's week once. Today the bands and the My crew line each read it.
6. Write the tests: the kernel (`bands.ts`), a render smoke of `JobModeBandsPage` with `renderWithProviders`, and
   the props added to five components.
7. Walk it as the leader on a day with one job and on a day with several stops. Walk it as a helper too, to see
   that nothing changed for other roles.
8. Write a help guide in `src/content/help/`, the release note and the `docs/recent-features` fragment. Add the
   bands to `PROJECT_DOCUMENTATION.md` and `GLOSSARY.md`.
9. Last, the press bar: follow his day, as decided above. Draw it on the spike branch, show the owner, then ship.
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

## What the other computer needs

- A clone of the repo with push access, and `npm ci`.
- `.env.local` from the owner. It holds the keys and `VITE_DEV_LOGIN_SECRET`, which `/dev-login` needs. Send it
  privately, and never commit it.
- No database change and no edge function: nothing to push with the Supabase CLI.

## How to see it and walk it safely

- **See it:** run the dev server with Job Mode on, at a phone width. `/dashboard?bands=1` switches the device to the
  bands page, and `?bands=0` switches it back. On the dev server a dashed strip on top switches Before and After.
- **See it as the crew lead:** he is the one real account in the Leader role (`master_technician`) that is not
  archived. Find him with the dev seat's `find_person`, or ask the owner. Sign in with
  `/dev-login?as=1&to=/dashboard`, then call `loginAsUser({ email, role }, origin + '/dashboard')` from
  `src/lib/loginAsUser.ts`.
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

Paste this into Claude Code in a clone of the repo:

```text
Pick up the Job Mode bands work for a crew lead's phone in the pipetooling repo (github.com/clickconstruction/pipetooling.github.io). It was a design spike. The owner has made his two decisions, so the next step is to build it for real.

1. Get the code. Fetch the branch spike/crew-lead-bands and work on it in a new worktree. On a fresh clone, run npm ci. Ask the owner for .env.local, which holds the keys and the dev sign-in secret. Never commit it.
2. Read to-dos/crew-lead-dashboard/SPIKE_HANDOFF.md on that branch first. Then read SPIKE.md and ASSESSMENT.md beside it, and CLAUDE.md.
3. The owner's decisions on 2026-11-21, in his words: "Leader role alone first, follow his day".
   - The bands page goes to the Leader role (master_technician) alone, first. Every other role keeps today's Job Mode page.
   - On a day with one job, the big pinned press follows his day: Directions before he is there, Photo on site, Leave report from mid afternoon. On my way and Turnaway move behind More. A day with several stops keeps On my way.
4. Build in this order, following CLAUDE.md. Claim each version with npm run claim, give every PR its release note and docs/recent-features fragment, and arm each small PR with gh pr merge --auto.
   a. Catch up with main. Three changes on main (v2.8103, v2.8122 and v2.8124) overlap the spike in Dashboard.tsx, DashboardJobModeCard.tsx and JobModeTopRow.tsx, and SPIKE_HANDOFF.md says how. Merge main into the spike branch instead of force-pushing, and cut each PR from fresh main.
   b. Replace the spike's device switch (?bands=1, bandsSpike.ts and the dashed Before/After strip) with the Leader-role rule.
   c. Work down "Left to build" in SPIKE_HANDOFF.md: values in place, empty states, one read for My crew's week, tests, walks, the help guide and the docs.
   d. Do the press bar last. Draw it on the spike branch and show the owner before its PR, because he decides on what he sees.
5. Walk safely. The crew lead is the one real Leader-role account that is not archived. Walk as him only in Playwright, with every non-GET on /rest/v1/ refused, and answer rpc/bump_user_app_activity and rpc/sync_salary_clock_sessions_for_user_day with null. A plain browser View as saves as him. Never call supabase.auth.signOut() on his session, because its global scope signs him out on his phone. Press nothing that saves as him.
6. The repo is public. Keep real names, job numbers and amounts out of commits, docs and screenshots.

After each step, tell the owner in plain words what changed and what is next.
```
