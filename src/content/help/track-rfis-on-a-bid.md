---
title: track RFIs on a bid
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: rfi, request for information, question, gc question, plans question, ambiguity, addendum, answer, countooling flags, rfi queue
order: 92
---
An RFI is a request for information: a question for the GC when the plans genuinely don't say. The bid's **RFI tab** now keeps a queue of them.

The GC is the general contractor running the site. The plans may show a fixture that isn't in the schedule, the table of fixtures on the drawings. A riser, an upright pipe between floors, may disagree. A line may be unlabeled. The queue keeps every question you asked, or meant to ask. Nothing gets lost between the takeoff and the letter. The takeoff is the count from the drawings. The letter is the cover letter that goes out with your price.

## Drafting a question

You open the bid on the **RFI** tab. The queue sits above the letter composer:

1. You type where it lives, like *P201 near 3/B*, and the question. Then you click {{button:gray|Draft RFI}}.
2. Or you click {{button:gray|Paste RFI flags}}. You paste what CountTooling's **Copy RFI Flags** button put on your clipboard. CountTooling is the app where you count the plans. Every `RFI:` note you dropped while drawing becomes a draft here, with its sheet.

Drafts are just drafts. Nothing reaches the GC until a person approves it.

:::example Flag it where you found it
While counting in CountTooling, drop a note reading `RFI: cleanout shown twice — which governs?` right on the spot. Back in the bid, one paste turns it (and every other flag) into queued questions with their sheet references attached.
:::

## Approving and sending

1. You click {{button:gray|Approve}} on a draft. You pick which GCs it goes to. Every bidding GC is checked by default. You pick how it's going out: *email*, *PlanHub Q&A* or *phone*.
2. You send it however that channel works. The message travels outside the app. The record here is the official one. Then you click {{button:blue|Mark sent}}.

Every step also writes a note on the bid. The bid's ledger, its running record, then tells the whole story later.

## Recording the answer

When the GC answers, you type it on the sent RFI. If the answer came as a reference, like *Addendum 1*, you add that too. An addendum is a change issued to the plans during bidding. Then you click {{button:gray|Record answer}}.

## The rule that keeps you safe

An RFI never stops the estimate. You count what you can and carry the question. But **an unanswered RFI must show up in the letter** as an assumption or an exclusion. So the proposal says out loud what it's assuming. An exclusion is something your price leaves out. The chip {{chip:yellow|open RFIs}} on the queue header is your reminder at letter time.
