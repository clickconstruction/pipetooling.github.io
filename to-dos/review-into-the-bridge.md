# People → Review folds into the Bridge

Status: in progress · step 1 v2.3360 (#3091) · step 2 v2.3366 the deep-link door · step 3 gated (retire Team Summary once the tables agree for a few weeks)

## The ask, in the owner's words

"There is a tab called People Review. Do you think we should absorb that tab into this tab?" (2026-09-11, about the Bridge). And on the plan below: "I really like your recommendations … I want you to build it all."

## The decision

Yes in direction, not in one move. Three steps, in order:

1. **Pick one earned convention** — the Bridge's (contract ÷ expected hours, proven against net position by the Truth check). Review's Team Summary adopts it. **Shipped v2.3360**: a job with no % is half done (was 100%), a finished job is 100%, a person's share is their clock hours ÷ the job's lifetime clock hours (was wage-weighted cost, sub sheets included), sub sheets are a job cost with no revenue share.
2. **Make Vectors the door** — a person's row on the Bridge opens their Review panel for that pay week. Vectors is the scoreboard, Review's panel is the drilldown. No screen merges yet. (The mock-up's R1 "unfolds under the row" is the later merge; the first door is a deep link into People → Review with the person selected and the pay week as the custom range.)
3. **Retire Team Summary** once the two tables agree for a few weeks. The per-person panel (jobs worked, hours & pay, reports, tasks) survives as the drilldown behind Vectors; overhead-after-profit, Wheels and the tag segments move onto Vectors as optional columns or stay in the panel. Then the Review tab redirects to the Bridge.

Owner decision recorded the same day: no financial number reaches a teammate (`memory: finances-stay-owner-only`). The teammate side of this arc is the money-free Needs You items only (no % on your job · a clock left running · a missing report).

## The mock-up

`Step Three, Redrawn` — https://claude.ai/code/artifact/9c72e792-f8ea-43c9-8b92-6afca365c376 (T1/T2 teammate items, R1/R2 the door, the retirement map).

## Where it plugs in

- Kernel of record: `src/lib/bridge/earnedRevenue.ts` (`expectedHoursForJob`) → `src/lib/people/reviewEarned.ts` (Review's adapter) → `derivePersonTeamSummary.ts` (Team Summary) and `PeopleReviewTab.tsx` `loadReviewData` (the per-person panel).
- Vectors: `src/lib/bridge/vectors.ts` + `loadBridgeVectors.ts` + `BridgeVectorsPanel.tsx`; the row's `userId` is the door's key; Review keys people by pay-config `person_name` (resolve through `people.account_user_id` / `users.name`).
- Review's panel loader takes `(personName, start, end)` — the deep link needs `?person=<name>&from=<ymd>&to=<ymd>` handling in `PeopleReviewTab` (period → `custom`, select the person index).

## How to verify agreement (the gate for step 3)

Same pay week on both: People → Review → Custom range Sun–Sat, Table view, **Gross Revenue** per person vs Bridge → Vectors ‹ › that week, **Earned** per person (hover Contribution for the exact figure). Known, accepted differences: salaried people (Review assumes 8 h per weekday; Vectors uses clocked hours) and the 2-year lifetime lookback on Review vs all-time on the Bridge. Everything else should agree to the dollar. First check 2026-09-12 for Aug 30 – Sep 5: hourly people agree within rounding; salaried differ by the 8/0 assumption; totals $44,534 vs $44.0k.

## Residue

- The per-person panel's Net still excludes card charges from parts (the Team Summary includes them).
- Job Summary and Crew P&L keep their own conventions (the friend's surfaces).
