---
title: audit a robot bid and teach it what you know
category: Bids
roles: dev, master_technician, assistant, controller, estimator
keywords: audit, robot, twin, review, feedback, counts, footage, pricing, scope, receipts, counttooling, takeoff
---
When a robot estimator finishes a draft bid, it asks for your audit. Everything happens in one place — the **Audits** tab on the Bids page — and every note you leave teaches the robot for next time.

## Find your pending audits

1. Your Dashboard tells you first: while robot bids are waiting, the **Needs you** card carries a {{chip:yellow|Robot training}} item with the count remaining — {{button:amber|Open Audits}} takes you straight to the tab. It stays until the queue is empty (locked shadow audits don't count — they aren't workable yet).
2. Or go to **Bids** yourself. When a robot bid is waiting on you, an {{chip:yellow|Audits · 1}} tab appears near the Bid Board — the number is how many are waiting.
3. Open it. Audits show as one-line rows — bid, status, draft total, how far the robot landed from our number, question count, and age. **One card is open at a time**; tap any row to open it (finishing an audit opens the next one for you).
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

1. **The differences, in three lists**: the card matches the robot's rows against ours by name and shows only where they differ — {{chip:red|ROBOT MISSED}} (rows we carry that it doesn't — the dangerous kind), {{chip:yellow|ROBOT ADDED}} (rows it carries that we don't), and {{chip:blue|QUANTITY GAPS}} (same row, different number) — biggest dollars first. Judge each one with one tap:
   - {{button:red|✗ Robot's wrong}} — drafts a teaching note for you; edit if you like and hit **Post**.
   - {{button:amber|📋 Our record's off}} — the robot found a hole in OUR bid; posting files a record-repair.
   - {{button:green|✓ Both fine}} — scope difference or judgment call; posts instantly.
   Rows that match within 15% aren't shown — there's nothing to judge there. (When there's no reference bid to compare against, the card falls back to listing the robot's biggest rows with 👍 / 🚩.)
2. The card lists **the robot's questions** (🤖), each anchored to the plan sheet it came from. Type in the box and hit {{button:blue|Answer}} — short is fine.
3. Anything else goes in the **one note box** at the bottom — pick a section chip (Counts / Footage / Pricing / Scope / General) if it fits, or leave it on General. Type each thing you'd tell a junior estimator — "we always carry travel past 200 miles."
4. When you're done, hit {{button:green|Finish audit}}. The card flips to {{chip:blue|Waiting on robot digest}}, the ledger records it, and the next waiting audit opens automatically.

## What happens to your notes

The robot reads every note, changes how it works (its playbook, its price and labor books, or just that one bid), and replies under your note with a receipt — 🤖 → "Learned: …" — so you can see your feedback landed. Once every note has its receipt the card moves to {{chip:green|Digested}}, kept under **Show digested audits** for reference.
