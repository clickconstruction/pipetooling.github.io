# 20261109063000_superintendent_scores_rate_window.sql (2026-11-09, v2.6783)

**What it does**: `superintendent_scores` (punch list #234) reads the roster's loaded rate over the 90 days ending `LEAST(p_to, CURRENT_DATE)` instead of `p_to`. `CREATE OR REPLACE` from the newest definition (`20261109040000_superintendent_scores_floor_rate.sql`), same signature, same JSON; nothing else moves.

**Why**: the Scoreboard reads the current month with `p_to` at the month's last day, so the rate's window began on the first of the month before and ran to a day not yet come, while Bids → Labor and Settings → Line budgets read today's last 90 days (`crewRateFromLedgerDays`): the dev-server walk of 2026-11-09 read two figures a little over a percent apart on the same minute. With the window ending today the current month prices at the number those cards show; a past month keeps its own end, so a closed month's figure does not drift as the roster changes.

**Tables**: none created, so no fence is owed. **RLS**: unchanged.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges; either order with the client deploy, since the client does not change.

**Check**: the Scoreboard's rule card and Bids → Labor's company rate read the same figure on the same day, within a session's rounding.

**Applied**: not yet.
