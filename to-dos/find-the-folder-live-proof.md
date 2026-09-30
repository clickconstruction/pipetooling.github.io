---
name: "Find the folder: prove it finds a real bid folder"
number: 65
group: close
status: plan-fetch find_folder deployed 2026-09-29 and answering from prod; every lookup so far returned found false, because no bid folder yet carries a bid's exact name
summary: >
  Find the folder (v2.4162) looks up the child of a division bid folder by the name the app
  gave the estimator to copy, and fills the plans link in. It is deployed and answers, and the
  owner shared the plumbing, electrical and HVAC bid folders with the robots' Drive account
  the same day (all three probe readable). What has not happened is a positive: a folder an
  estimator made by the cards, found by name, its link filled, the robot picking the bid up on
  the next batch.
next: >
  On one live plumbing bid with no plans (the Bid Board's waiting line lists them — b367
  Marcos Pizza Boerne was one): Copy name, make the folder in the plumbing bid folder, drop the
  plans PDF in, tap Find the folder on the bid (or on the robot's needs sheet). Check the line
  reads Found the folder · N PDFs, the plans link is filled, the readiness line turns green,
  and the robot icon moves from amber to queued; the next weekday batch claims it. If Find says
  not there yet, compare the folder's name to the copied one character for character (a
  trailing space, a curly quote) before touching code.
size: XS (one live pass, about ten minutes plus a batch)
blocker: An estimator (or the owner) making one real bid folder by the cards.
ver: v2.4162 · v2.4165
mockup: not required — a live test of shipped screens
flagged: true
---

# Find the folder: prove it finds a real bid folder

Left on purpose by the robot-intake train, 2026-09-29, and flagged to the top the same evening.

At ship time the mode was proven only in the negative: four live bid names looked up in the plumbing bid folder all answered *found: false* — correctly, since no folder with those names existed. The first folder made by the cards is the test that matters. When it passes, delete this file (retire the row).
