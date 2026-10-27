# Owner at 6 a.m. — findings across the four desk prototypes

Reviewed by driving each prototype (expand, plan, sheet, record, phone) with Playwright; screenshots in this folder (`<desk>-0…7-*.png`). Do not regress what already works: Bill's Record stays disabled until something is planned and its armed scorecard shows dashes, never sample numbers; Market refuses an empty plan with a toast and its empty plan card says what to press; Sales' After-the-call sheet names the real writes; Build's Set-the-% recomputes headline, bar and tiles coherently.

## Cross-desk rulings (rules all four follow; Collect sets several)

- **R1 · One verdict shape.** The headline is the pile fact ("$261k sold, not yet built"). Directly under it, ONE bold sentence that names this week's move. Nothing else bold competes in the header. Build drops its separate blue bar into that sentence; Market adds the missing sentence; Sales keeps one bold phrase, not two.
- **R2 · The desk proposes the sheet.** Collect and Sales open with the week's moves already on the sheet and the owner prunes; Build, Bill and Market open empty and make him assemble. Propose-prune-record everywhere: the named rows open planned, buttons read "Take it off the sheet" / "Put it back on the sheet". Five minutes at 6 a.m. is pruning time, not assembly time.
- **R3 · An empty plan never records.** Build and Sales both recorded a no-move plan ("Recorded · No moves on the sheet yet") — Friday would score nothing and the streak would still count. One pattern: the Record button sits disabled until a move is on the sheet, with the why in its title (Bill's behavior, Market's words).
- **R4 · Tile grammar.** Tile 1 = the real part, verb-headed ("Billable today"). Tile 2 = the cut ("5 GCs hold $2.8M · 86%"). Tile 3 = the what-if, always "If … → …" with both numbers. A to-do list is not a what-if (Build), and a someday-arithmetic is not a this-week lever (Market).
- **R5 · "How this reads" sits at the foot** on every desk. Sales carries a second copy mid-page between the bar and the rows — move it down; the legend already explains the buckets.
- **R6 · Friday is named at record time.** The recorded stamp ends with the one sentence Friday will ask, counting only what the app can read (all four have a version; keep it when rewording).
- **R7 · Every desk carries the Only-you strip.** Bill has none; its brief's own calls belong there.

## Build (6)

1. **must** · plan footer, "Record this as the week's plan" · It records an empty plan ("Recorded Mon, Oct 26 · No moves on the sheet yet"). Disable until ≥1 move is planned (R3).
2. **must** · verdict bar + tile 3 + Only-you strip · "Set the 9 %s, price the 5, approve the 232h" appears three times; the owner reads it once and the page feels padded. Keep it in the verdict sentence and the Only-you doors; rebuild tile 3 as the what-if (R4): "If the 9 %s get set → the pile reads true either way. Left alone it shrinks $2.5k a week."
3. **should** · rows · Open the four named rows planned and let him prune (R2); "Plan: finish it this week" becomes "Take it off the sheet".
4. **should** · legend card "$40k waiting to start" · The only legend card with no door. Add "Open the Schedule ›" ("they join the pile the day a crew lands" is the reason to go there).
5. **could** · header "32 open jobs, 18 read clean" · "read clean" is new vocabulary; say "18 have a % and a price".
6. **could** · the prototype's corner pill overlaps tile A at some scrolls · pin it bottom-left (prototype-only).

## Bill (5)

1. **should** · missing Only-you strip (R7) · Add it with the desk's two real owner calls: "Bill the 80% job's finished share now, or wait for ready?" and "Does a GC pay-application window hold a row off the sheet?" — both already live implicitly in rows.
2. **should** · row 1081 · "in the plan ✓" chip AND "Planned ✓" button say the same thing twice; keep the button state, drop the chip.
3. **should** · rows · The 3 ready jobs open planned (R2) — "the office already said done" IS the proposal; he prunes.
4. **could** · tile 3 "0.7 → 0 weeks" · Numbers are right but the tail is limp; end with what it feeds: "$18.6k lands on Collect's pile and the forecast moves up."
5. **could** · collapsed rows still show Bill it / Set the % while the caption says "press a row for the detail" · one button on the collapsed row (the move), doors inside the detail.

## Market (5)

1. **must** · header (R1) · "$27.7k a week short of the field" states the gap but not the move; add the verdict sentence: "Call the two quiet GCs and put a value on Summit's 3 bids — that is this week's lever."
2. **should** · tile 3 "To feed the field · $378k a week asked" · Not a lever he can pull this week (R4). Make the what-if pullable: "If Knight and MK come back at their old pace → about +$XXk a week asked," and keep the $378k arithmetic as its small print.
3. **should** · "The asks, week by week" strip · A reading with no move. Fold it ("The weeks ▾ — lumpy is normal; empty weeks are the tell").
4. **should** · rows · The five moves open planned (R2); "Add to the plan" becomes "Take it off the sheet".
5. **could** · live rows' green "Oct 22 / Oct 19 / Oct 24" · green with no label reads as good news; say "last ask Oct 22" muted, green only when inside 7 days.

## Sales (5)

1. **must** · footer "Record this as the week's plan" · With every call pruned off it still records (observed: removed Burd, recorded 3; removed all, recorded empty). Disable at zero (R3).
2. **should** · mid-page "How this reads" paragraph (R5) · Move to the foot; it splits the bar from the rows it explains.
3. **should** · header · Two bold claims compete ("About $460k … lands" and "$1.56M has gone quiet"). One verdict: "Four calls decide $1.56M this week." The $460k expectation lives in tile 1 alone.
4. **could** · footer buttons · "Close" duplicates the ×; cut it, three buttons read cleaner.
5. **could** · "Put it back on the sheet" wears the same dark style as the live call button · off-sheet state should look off (outline style), so the sheet reads at a glance.
