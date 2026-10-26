# First-timer review — the four desk prototypes

Lens: Taunya at the front desk, half the time on her phone. Driven with Playwright at 390×844 (`ft-drive.mjs`, `ft-vp.mjs`; screenshots beside this file). Rules read from `src/lib/plainWords.ts`.

**Cross-desk (fix once, the same way on all four):** the desks disagree on what happens after Recorded ✓ — Sales locks its moves and says why on a press, Market locks silently, Build and Bill do not lock at all. One behavior everywhere: Sales'. Door toasts speak three voices ("Would open…", "In the app this opens…", "→ /route"); pick "In the app this opens…". On Bill and Build a planned move cannot be taken back off the sheet before recording; Market and Sales toggle. Toggle everywhere.

## Build

1. **must** · `record()` — Recording an empty plan stamps *"Recorded Mon, Oct 26 · No moves on the sheet yet. Press a row and plan its move."* A recorded nothing, saying both things at once (verified). Refuse like Market: toast *"The sheet is empty. Plan a move first."*
2. **must** · plan doors after record — a move planned after Recorded ✓ silently rewrites the stamped line to *"Recorded … 1 move on $47k"* (verified). Disable the plan, waits and % doors once recorded, with Sales' toast: *"The plan is recorded. Friday asks how it went."*
3. **should** · touch — the legend and decide doors are 25px tall and the Record button 32px at 390px. Give `.door` and `.record` min-height 40px under 560px.
4. **should** · tile B words — *"Past a third the page calls the reading thin, and Build keeps the link only by a clear margin."* Insider shorthand. Replace: *"More than a third of this pile is a guess. The app then trusts the red less. Set the %s and the number firms up either way."*
5. **should** · one thing, two names — the verdict and tile C say *"the 5 invisible jobs"*, the legend says *"5 jobs in no number"*. Say *"the 5 jobs with no price"* in all three places.
6. **could** · the pile bar clips its $40k and $122k labels at 390px. Hide in-bar labels under 560px; the legend already carries them.

Takeaway (right): *The crews are fine, the number is dirty. Set the %s, price the five, approve the hours.*

## Bill

1. **must** · phone sheets open off-screen — at ≤480px `.sheet` is `position:fixed`, but `openSheet` writes document-coordinate `top`/`left` inline, so Set the % / Record a bill lands ~1,400px below the viewport and the press looks dead (verified: nothing visible, focus goes somewhere unseeable). At ≤480 skip the inline coordinates and let the CSS center it.
2. **must** · after Recorded ✓, Bill it still works and rewrites the stamp — *"1 bill, $9.6k"* became *"2 bills, $15k"* under "Recorded ✓" (verified). Lock the moves once recorded, with the why-toast.
3. **should** · the Billable-today card hardcodes *"The oldest has sat 6 days."* — bill 1081 away and the sentence stays. Compute it from the ready rows that remain, or drop it when none.
4. **should** · the toast has no `role="status"`/`aria-live` (the other three desks have it). A screen reader misses every confirmation.
5. **could** · chip *"hand % · 80"* — say *"% set by hand · 80"*.
6. **could** · the footnote's first sentence runs 34 words with two em dashes. Split its first two sentences; the rest can stay dense.

Takeaway (right): *Send the $18.6k the office already called done, today.*

## Market

1. **should** · tile 1 — *"The win share is the window's own: won and started over sent, bids and estimates together."* "X over Y" is arithmetic-speak. Replace: *"Won and started work, divided by everything sent, these 8 weeks. Bids and estimates count together."*
2. **should** · *"Open the bids ›"* and row doors are 19px-tall text links on phone. Border them and give ≥36px height under 640px, like the Add button.
3. **should** · after Recorded ✓ the Add buttons dim with no reason given (the only silent desk). A press on a dimmed Add should toast *"The plan is recorded. Friday counts what arrives."*
4. **should** · decide strip — *"It rides the plan as plan words only — nothing in the app tracks the courting."* Glued and insider. Replace: *"It goes on the plan as words. The app cannot track the courting."*
5. **could** · tile 3 — *"Two levers; this desk works the first."* Semicolon glue. Replace: *"That is one of two levers. This desk works the asks."*
6. **could** · the court input's Add button is 31px tall; lifts with finding 2.

Takeaway (right): *We ask for about half of what the field needs. Call the quiet GCs.*

## Sales

1. **must** · the dark button is labeled with the move (*"Call Burd about Take 5 Georgetown"*) but pressing it takes the call OFF the sheet — verified, the footer dropped to 3 calls. A first-timer presses the instruction and undoes it. Keep the title as text; make the toggle its own words: *On the sheet ✓* / *Put it back on the sheet*, `aria-pressed` kept.
2. **should** · *"After the call: record the answer ›"* — the desk's most important write — is an 18px-tall text link. Make it a bordered ≥36px button; same for Open the bid / Bid Board links on phone.
3. **should** · the header verdict and two notes use em dashes in first-read lines (*"$1.56M has gone quiet — four calls this week decide it"*). Split into two sentences each.
4. **should** · the *owner · day* pill gives no example, so nobody knows what to type. Placeholder: *"who calls · which day, e.g. Sam · Thu"*.
5. **could** · all four calls start on the sheet, so Record works with zero review. Say it in the section note: *"the desk proposes these four; take one off if it is not this week's."*
6. **could** · outcome line *"No answer — the last contact is noted; it stays on the sheet."* Glued; split it.

Takeaway (right): *Only about $460k of the $3.3M is real. Four calls decide the quiet $1.56M.*
