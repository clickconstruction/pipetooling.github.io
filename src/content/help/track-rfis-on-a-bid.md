---
title: track RFIs on a bid
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: rfi, request for information, question, gc question, plans question, ambiguity, addendum, answer, countooling flags, rfi queue
order: 92
---
When the plans genuinely don't say — a fixture on the plan that isn't in the schedule, a riser that disagrees, an unlabeled line — that's an RFI: a question for the GC. The bid's **RFI tab** now keeps a queue of them, so nothing you asked (or meant to ask) gets lost between the takeoff and the letter.

## Drafting a question

Open the bid on the **RFI** tab. The queue sits above the letter composer:

1. Type where it lives (*P201 near 3/B*) and the question, then click {{button:gray|Draft RFI}}.
2. Or click {{button:gray|Paste RFI flags}} and paste what CountTooling's **Copy RFI Flags** button put on your clipboard — every `RFI:` note you dropped while drawing becomes a draft here, with its sheet.

Drafts are just drafts — nothing reaches the GC until a person approves it.

:::example Flag it where you found it
While counting in CountTooling, drop a note reading `RFI: cleanout shown twice — which governs?` right on the spot. Back in the bid, one paste turns it (and every other flag) into queued questions with their sheet references attached.
:::

## Approving and sending

1. Click {{button:gray|Approve}} on a draft. Pick which GCs it goes to — every bidding GC is checked by default — and how it's going out (*email*, *PlanHub Q&A*, *phone*).
2. Send it however that channel works (the record here is the system of record; the message travels outside the app), then click {{button:blue|Mark sent}}.

Every step also writes a note on the bid, so the bid's ledger tells the whole story later.

## Recording the answer

When the GC answers, type it on the sent RFI — with a reference if it came as one (*Addendum 1*) — and click {{button:gray|Record answer}}.

## The rule that keeps you safe

An RFI never stops the estimate — count what you can and carry the question. But **an unanswered RFI must show up in the letter** as an assumption or an exclusion, so the proposal says out loud what it's assuming. The chip {{chip:yellow|open RFIs}} on the queue header is your reminder at letter time.
