---
name: "Robot offers on Submittals: one shape, only where a robot can act"
number: 59
group: gated
status: opened 2026-09-29 · v2.4134 took the first cut (the walkthrough mentions the robot only where its offer is on the page) · nothing else built
summary: >
  The three robot offers on Bids → Submittals (read the schedule off the plans at step 1, put a
  PDF's pages on rows at step 3, read a reviewer's redlines at step 6) are each worded their own
  way, offered before the reader knows what the robot is, and shown whether or not a robot can act
  — a bid with no plans link still offers "read it off the plans", and no robot seat has completed
  a task in prod as of 2026-09-29, so a queued ask sits at "queued" with nothing to say. One
  shape for every offer, from one kernel: what it does · what it needs (and whether this bid has
  it) · what you do after · whether a robot is awake.
next: >
  1. `robotOffer` kernel + `RobotOffer` component: the sentence, the needs line read from the bid
  (plans link → "Needs the plans on this bid ✓ / ✗ add the plans link on the bid") and from
  `twin_credentials.last_used_at` ("A robot was working 12 min ago" / "No robot has run in 3 days —
  your ask waits until one does" / "No robot has run yet"), the button, the same `?` to the guide's
  robot section; used at the three spots; the human door always first and primary.
  2. The owner's call: hide every offer when no unrevoked seat exists (recommended — an offer that
  can never answer is worse than none), or keep them with the awake line.
  3. The walkthrough's robot stop reads the same kernel's words.
size: S (one kernel, one component, three call sites; a test per state)
blocker: the owner's call on 2; the awake line needs `twin_credentials` readable by office roles (the Robots console already reads it).
ver: v2.4134 (the first cut)
opinion: soon — Wendi and Stephen are on the tab this week; a robot that is offered but never answers costs trust the first time it happens.
---

# Robot offers on Submittals: one shape, only where a robot can act

The owner, 2026-09-29, on the walkthrough's robot stop: "as a user reading this my first thought is 'why are you telling me I can have a robot read it when I'm not even sure where or how that works'". v2.4134 made the stop appear only where the offer is on the page. This row is the rest.

## What is wrong today

- Three offers, three voices: a *…or ask the robot* link under Type or paste (step 1), a button on the sheet strip (step 3), a button on a reviewer's redline file (step 6).
- None says what the robot needs. `read_schedule` reads the bid's plans through `get_plan_pages`; a bid with no `plans_link` is offered it anyway and the task blocks.
- None says whether a robot is awake. Tasks are picked up by a twin seat (`twin-mcp`, either seat since v2.3630); as of 2026-09-29 no seat has completed a submittal task in prod (punch list #17, gate 6b's robot half), so every ask has read *queued* with no end.
- The reader has not been told what "the robot" is before the first offer.

## The shape (every offer, the same three lines)

1. **What it does** — *The robot can read the fixture schedule off the plans.*
2. **What it needs, and whether this bid has it** — *Needs the plans on this bid ✓* / *✗ Add the plans link on the bid first.* Then *whether a robot is awake* — from `twin_credentials.last_used_at`.
3. **What you do after** — *Its tags land here in a few minutes. You tick the right ones. Nothing counts until you do.*

Then the button, always second to the human door (*Type or paste the schedule* / *Show the pages* / *Enter their calls*), and a `?` to the guide's *Let the robot read it first* section — the one place that explains the robot.

## The owner's call

Hide every robot offer while no unrevoked twin seat exists (the Robots console knows), or keep them with the awake line. Recommended: hide — the tab reads as one road that works by hand (v2.4090), and an offer that cannot answer is a broken promise on a first visit.
