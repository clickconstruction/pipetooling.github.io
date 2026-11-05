---
name: "Robot audits backlog: 31 waiting, oldest 29 days"
number: 66
summary: >
  A robot's sealed number only teaches the robots once a person audits it against ours —
  scores the counts and the pricing and writes what the robot missed. With 31 audits waiting
  and the oldest a month old, no kind of job has earned first drafts, so loading plans in (the
  robot-intake train) makes more robot bids that nobody reads. The audits are the other half
  of the loop, and they are a person's time, not code. Making each audit faster — the Audits lens
  as a queue — is #63; this row is who audits and how often.
size: M (people time — about 31 audits, roughly 15 minutes each)
ver: —
mockup: not required — work in the existing Audits tab, no screen change
group: waiting
status: on 2026-09-29 the Robot Board read 31 audits waiting (oldest 29 d) · the owner's rule 2026-10-09: each estimator audits a standing half hour a week, oldest first · measured 2026-11-05 from the dev seat: 63 waiting, the oldest 65 days, 41 older than 14 days, one audit completed since the rule · the owner reset the cadence the same day
next: The cadence restarts from 2026-11-05 (the owner's reset): Wendi and Stephen each work Bids → 🤖 Robots → Audits from the oldest for half an hour a week. Measure on 2026-11-19 from the dev seat (`read_rows bid_audits`, status pending, by requested_at): audits waiting under 10 and none older than 14 days. If a single audit takes more than about fifteen minutes, write down which step is slow — that is the case for #63's queue.
blocker: Two weeks of the cadence, from 2026-11-05.
---

# Robot audits backlog: 31 waiting, oldest 29 days

Found during the owner's 2026-09-29 review of Bids → Robots (*do we make it easy for an estimator to load in what a robot needs?*). The intake half got fixed that day (v2.4162, v2.4165). This row is the half that intake cannot fix: the robots only earn first drafts when their sealed numbers are audited. The Robot Board's strip carries the live count (*audits waiting · oldest N d*) and *kinds of job earned first drafts*; the guide *audit a robot bid and teach it what you know* covers the how.

Flagged to the top by the owner the same evening.
