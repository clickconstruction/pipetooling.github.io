---
name: "The Bridge: a desk behind every stage card"
number: 192
group: gated
status: proposed 2026-10-26 from the four-desk design run; the Collect desk is live (v2.5848–v2.5858) and its card door shipped (v2.5890); the other four desks are designed, reviewed and approved as content, nothing built
summary: >
  The owner asked for a desk behind every stage card, one press from the card, the way the
  Collect desk opens. The first drafts cloned the Collect desk's call-sheet anatomy onto all
  four stages; the owner's verdict was "I like that they exist, but I don't love this," and he
  chose rethinking the content over any polish. The rethink produced two concepts per desk and
  the owner approved the four hybrids: Build is an hours-in, work-out ledger per job; Bill is
  a leak finder with the billed-the-day-it-finished scorecard folded in; Market is the
  26-week intake over a relationship book; Sales reads the whole pile in expected dollars.
  Every figure traces to columns that exist today; no desk needs a migration. The folder
  carries the four approved prototypes, the eight concept wireframes and the three review
  files.
next: The owner answers the calls below (the thresholds, the two new writes, the boundary rules), then picks the build order.
size: M per desk — a kernel, a loader widening and the desk component each; no migration except the optional bridge_calls kind marker
blocker: The owner calls below; none of the four should be built before its thresholds are his numbers.
opinion: Build's desk first while Build is the link — its divergence ledger explains the pace gap the page shows today, and every read it needs already exists; one desk per PR train, the way Collect's shipped.
---

# The Bridge: a desk behind every stage card (#192)

## The ask

The owner, 2026-10-26, on the Bridge: the Collect desk was hard to find behind two presses, so
the card itself got a **Break it down ›** door (v2.5890), and he asked for desks like it behind
all five cards. The design run went three rounds in one day: first drafts that cloned the Collect
desk's call-sheet anatomy onto Build, Bill, Market and Sales, then a three-perspective review
(the owner's five-second read, the skeptic engineer's traceability, the office first-timer's
words and thumbs), then — on his verdict, *"I like that they exist, but I don't love this,"
rethink the content* — two genuinely different content concepts per desk. He approved the four
recommended hybrids. This folder is the record; nothing beyond the Collect desk and the card
door is built.

## The four desks, as approved

**Build — "Hours in, work out."** The one question: *the field worked all week — did the money
move, and where do I point the crews tomorrow?* A 14-day per-job divergence ledger: clock hours
in (sessions by job) against % movement out (`job_pct_events` and report answers, × contract),
worst divergence first, with three tiles (moved / ate hours, moved nothing / stalled) and the
"biggest unbuilt money has nobody scheduled" chip from `job_schedule_blocks` on stalled rows.
It explains the page's by-hours vs by-percents pace gap row by row. Carries v1's inline
Set-the-% slider. New: a `buildDesk.ts` kernel and loader (per-job rows from the reads
`buildPace.ts` already aggregates). Mockup: [mockups/build-desk.html](mockups/build-desk.html).

**Bill — "Where billing leaks."** The one question: *when the work finishes, does the bill go
out that day — and what is the sitting costing?* The leak rows are findable only by crossing
reads no surface crosses: finished-never-billed, a remainder aging behind a part-bill, no-price
jobs whose number never rings, marked-billed-by-hand with no send on record; then the fast lane
(the ready jobs) and the cost-of-a-week meter, with the billed-the-day-it-finished scorecard as
a fold — `job_status_events` keeps every `ready_to_bill` transition, so the ready day is a real
read, and `billedDay.ts` knows the billed day. New: a `billDesk.ts` kernel and a sitting-days
loader. Mockup: [mockups/bill-desk.html](mockups/bill-desk.html).

**Market — the intake over the relationship book.** The one question: *is enough work being
asked of us to keep the field fed — and who actually feeds us?* A 26-week asks-by-value strip
(the same bids and estimates reads the Bridge makes, window widened) over one row per GC by what
the relationship pays — feeding / fading / new name / dead weight — with the narrowing verdict
(three GCs carry 70%, up from 54%), the pricing-spend verdict (a GC with six priced bids and no
answer, ever), and an honest panel naming what the desk cannot see (courting, reputation). No
record ceremony. New: a `marketDesk.ts` kernel; the loader gains `gc_builder_id` and names.
Mockup: [mockups/market-desk.html](mockups/market-desk.html).

**Sales — the chase, in expected dollars.** The one question: *of everything asked, what will
actually become work — and which call this week protects the most of it?* Every number is the
ask × that GC's own decided win rate, aged to zero past twice their answer pace
(`outcome_at − bid_date_sent` makes the pace a real read), so the $3.3M pile reads as its honest
~$485k; the chase ranks by expected dollars a call protects, with a sort flip to open dollars so
the inversion is visible, and the decided-asks funnel by `loss_category` with the unreasoned
losses named as the blind spot. No After-the-call ceremony — answers land where the app keeps
them. New: a `salesDesk.ts` kernel; the loader widens to decided bids for the per-GC rates.
Mockup: [mockups/sales-desk.html](mockups/sales-desk.html).

## What the design run settled

- **A desk earns existence only by answering what the Bridge page cannot.** The first drafts
  died by restating This week and Fix the reading; the approved desks each show a crossing of
  reads no page makes today.
- **The call-sheet ceremony belongs to the lit link alone.** `bridge_calls` holds one held link,
  so a plan recorded from a non-link desk would steal the link and corrupt Friday's verdict.
  Desks record nothing unless their stage is the link; letting a desk plan ride without holding
  the link is a migration (a kind marker on `bridge_calls`) and an owner call.
- **Every figure names its read.** The skeptic's pass verified the columns: `bid_value`,
  `outcome_at`, `loss_category` and its six values, `next_followup_on`, `gc_builder_id`,
  `job_status_events.ready_to_bill`, `job_pct_events`, sessions by job, `job_schedule_blocks`
  with assignees. Nothing in the approved desks needs schema.

## The owner calls

**Thresholds (his numbers, defaults drawn):** Build's quiet-job days (drawn at 14); Bill's
day-it-finishes tolerance before a row reads late (drawn at same-day); Sales' aging rule (expected
dollars fade to zero past twice the asker's answer pace; the no-pace fallback 45 days); Market's
fading rule (asks this quarter under half the quarterly norm) and new-name span.

**New writes to decide:** whether a Build job can be marked *waits, with a reason* so the ledger
stops counting it (no such write exists); whether desk plans ride `bridge_calls` with a kind
marker (a migration) or recording stays with the lit link only.

**Boundary rules:** a ~100%-done unbilled job — Build's row or Bill's; the crewing door —
Schedule or the job window; whether per-GC win-rate and answer-pace words are fair to print on
Market and Sales rows (both desks read them from decided bids).

## What is in this folder

[mockups/](mockups/) — the four approved desks (`<stage>-desk.html`, interactive prototypes:
press rows, the % slider, the sort flip; nothing saves) and the eight content concepts behind
them (`<stage>-concept-a/b.html`, wireframes). [findings/](findings/) — the three review files
(owner, skeptic, first-timer) whose rulings bound the rebuilds. The Collect desk needs nothing
from this to-do; its door on the card is v2.5890.
