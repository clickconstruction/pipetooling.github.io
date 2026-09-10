---
title: audit a robot bid and teach it what you know
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: audit, robot, twin, review, filter, backtests, shadows, asking you, feedback, counts, footage, pricing, scope, receipts, counttooling, takeoff, standing rulings, questions, not mine, dismiss, operator, bid link, which bid
---
When a robot estimator finishes a draft bid, it asks for your audit. Everything happens in one place — the **Audits** tab on the Bids page — and every note you leave teaches the robot for next time.

## Start with the standing rulings

At the top of the tab sits **📜 Standing rulings · N — fifteen minutes here unblocks every robot**: every question the robots have parked while working, from every bid, in one panel. Tap the header to open or collapse it (it starts open whenever questions are waiting).

1. When several robots hit the same issue on different bids — say, whether to carry travel past 200 miles — their questions collapse into **one card**: the issue as a chip (like {{chip:gray|Travel bands}}), the newest phrasing of the question, and a line like *asked 3 times across 2 bids*.
2. Most questions come with the answers already on them: two to four buttons, the robot's own pick first as {{button:blue|★ Residual · all 3}} and the rest outlined like {{button:outline|Higher per-fixture}}. One tap answers, and on a shared issue it lands on **every** open copy at once; every robot picks it up on its next run. {{button:gray|Something else…}} swaps the buttons for a box when none of them fits.
3. A question with no buttons is an older or free-form one: type your ruling and hit {{button:blue|Answer all 3}}.
4. Questions without a shared issue list individually below, each with its own {{button:blue|Answer}} box. The bid number inside a question is a link — open it in a new tab for context before you answer. When that number is the robot's own practice copy, a green **ours b214** link beside it opens the real bid, the one with your counts and your price.
5. **A robot asking for a different plan set is not a ruling.** "The file on the bid is the electrical set, attach the plumbing sheets?" is a fix on that one bid, so it does not sit here as a card. The panel shows one line instead, *One bid needs a different plan set*, with the bid number as a link. It opens that bid's robot needs sheet on the Bid Board, where {{button:gray|Edit bid}} and {{button:gray|Copy intake address}} sit beside the question and {{button:blue|★ Attached — rerun}} tells the robot to go again.
6. **Only questions about the job land here.** When a robot's problem is its own machine — a sandbox, a sign-in, a file it can't open, a table it can't write — that question goes to the person who runs the robots instead, on their console. If one slips through and reads like it's talking to someone else, hit {{button:gray|Not mine}} and it moves over; {{button:gray|Dismiss}} closes a question you don't intend to answer, and the robots stop asking.
7. The bid number inside a question — the **b474** in *[audit b474 / footage…]* — is a link, and a question that only says *this bid* gets a small **· b474** link after it. Either opens that bid on the Bid Board in a new tab, scrolled to and highlighted, so you can look before you answer; your answer box stays where it was.

:::example Why this panel first
An hour spent auditing one card yields a handful of verdicts; a few minutes answering standing questions yields doctrine that moves every future robot bid. Highest leverage on the page.
:::

## Find your pending audits

1. Your Dashboard tells you first: while robot bids are waiting, the **Needs you** card carries a {{chip:yellow|Robot training}} item with the count remaining — {{button:amber|Open Audits}} takes you straight to the tab. It stays until the queue is empty (locked shadow audits don't count — they aren't workable yet). The same card also shows a {{chip:blue|Robot bid}} line when the robot has sealed a number on one of our live bids — nothing to do there, it's just the head start; the score lands by itself the moment we send, and {{button:blue|Open Shadows}} shows the sealed envelopes.
2. Or go to **Bids** yourself. When a robot bid is waiting on you, an {{chip:yellow|Audits · 1}} tab appears near the Bid Board — the number is how many are waiting.
3. Open it. Audits show as one-line rows — bid, status, draft total, how far the robot landed from our number, question count, and age. A filter row above the list — {{chip:blue|All}} {{chip:gray|Backtests}} {{chip:gray|Shadows}} {{chip:gray|Asking you}}, each with its count — narrows the list to one kind or to the audits with a question waiting on you; the order inside stays the same. The waiting ones are **sorted by what your verdict unblocks**: cards with unanswered robot questions first, then the ones that landed furthest from our number, oldest as the tiebreak — so the top row is always the one that teaches the most. **One card is open at a time**; tap any row to open it (finishing an audit opens the next one for you).
4. The open card starts with the robot's own confession — 🤖 **Where I'm least sure** — so you can check its suspicions first, then a comparison strip (its draft, our number, the difference) and a **system scoreboard**: waste + vent, water, gas, med-gas, and fixtures, robot vs ours with a ratio, so you see *where* the money diverges before touching a row.
5. A shadow bid shows a {{chip:gray|🔒}} row instead of a card: the whole audit stays locked until our own bid goes out — even seeing the robot's takeoff early could sway your number. It opens by itself once we send.
6. A {{chip:gray|Robot still working}} row means the robot opened the audit before pasting its counts into the bid, so there is no draft to price yet. It doesn't count toward your pending number; you can still open it to answer its questions, and the verdict rows appear once the counts land.

## Look the bid over (two quick links)

1. {{button:blue|Open takeoff (CountTooling) ↗}} opens the robot's plan markups in a new tab — no sign-in needed. Its notes are numbered pins on the plans.
2. {{button:blue|Open bid (ClickTooling) ↗}} opens the bid's Counts in a new tab, so you can see every row and price it drafted.
3. Flip between those tabs and the audit card as you go — nothing you type is lost.

:::example Referring to the plans
Mention pin numbers in your notes — "pin 3: those are by others" — and the robot knows exactly which spot on the plans you mean.
:::

## Answer its questions and leave your notes

1. **The differences, in four lists**: the card matches the robot's rows against ours by name and shows only where they differ — {{chip:red|ROBOT MISSED}} (rows we carry that it doesn't — the dangerous kind), {{chip:yellow|ROBOT ADDED}} (rows it carries that we don't), {{chip:blue|QUANTITY GAPS}} (same row, different number), and {{chip:purple|PRICED DIFFERENTLY}} (same row, same count — different money: its rate per foot or per fixture vs ours) — biggest dollars first. A **Where the delta lives** strip above them splits the headline difference into those same dollars — missed, added, counts, rates, and everything else (like the sent letter's markup over raw rows) — so you can see at a glance whether the robot miscounted or mispriced. Judge each row with one tap:
   - {{button:red|✗ Robot's wrong}} — drafts a teaching note for you; edit if you like and hit **Post**.
   - {{button:amber|📋 Our record's off}} — the robot found a hole in OUR bid; posting files a record-repair.
   - {{button:green|✓ Both fine}} — scope difference or judgment call; posts instantly.
   Rows that match within 15% on both count and price aren't shown — there's nothing to judge there. (When there's no reference bid to compare against, the card falls back to listing the robot's biggest rows with 👍 / 🚩.)
2. The card lists **the robot's questions** (🤖), each anchored to the plan sheet it came from. Type in the box and hit {{button:blue|Answer}} — short is fine.
3. Anything else goes in the **one note box** at the bottom — pick a section chip (Counts / Footage / Pricing / Scope / General) if it fits, or leave it on General. Type each thing you'd tell a junior estimator — "we always carry travel past 200 miles."
4. When you're done, hit {{button:green|Finish audit}}. The card flips to {{chip:blue|Waiting on robot digest}}, the ledger records it, and the next waiting audit opens automatically.

## What happens to your notes

The robot reads every note, changes how it works (its playbook, its price and labor books, or just that one bid), and replies under your note with a receipt — 🤖 → "Learned: …" — so you can see your feedback landed. Once every note has its receipt the card moves to {{chip:green|Digested}}, kept under **Show digested audits** for reference.

## Who the robots calibrate to

A robot's shadow score is measured against whoever sent the real bid. Only a **calibration standard** estimator's numbers count toward the robot's readiness gate; anyone else's score shows as {{chip:gray|PRACTICE}} on the Scoreboard. The company owner picks the standard under **Settings → Digital twins → ★ Calibration standard**: each estimating user shows {{chip:green|STANDARD}} or {{chip:gray|PRACTICE}} with a {{button:blue|Make standard}} switch beside it. Leave at least one standard set, or no robot score can ever count.
