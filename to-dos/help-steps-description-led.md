---
name: "Help guides: four steps that open with a description, then say \"you + verb\""
number: 90
group: gated
status: the 63 command sentences shipped v2.4699 (the sweep, from fresh main) · four borderline lines wait for a person's yes or no · nothing else left
summary: >
  v2.4656 made every numbered step that opened with "You + verb" read as commands. Its rescan
  found 50 more numbered steps in 30 guides that open by saying what the screen shows, then give
  a "you + verb" sentence. v2.4699 turned the 63 of those sentences that are commands into
  commands and widened rule 2 to every numbered step. Six sentences describe and stay as written.
  Four are borderline: each could be a command or a description, and only a person can say.
next: >
  A person says yes or no on each of the four lines below. A yes is one sentence changed by hand
  in that guide, all four in one small PR. A no on all four deletes this card.
size: XS (four sentences)
blocker: The four lines want a person's call. A command tells the reader to do something; a description only says where it is or what the tab holds.
ver: v2.4656 · v2.4699
opinion: your call — the openings read either way; a no leaves the guides as they are
mockup: not required — words only; each guide renders as it does today
---

# Help guides: four steps that open with a description, then say "you + verb"

## Why

The owner chose plain commands for numbered steps (#75's third question). v2.4656 converted the
83 steps that opened with "You + verb". v2.4699 converted the 63 later sentences that are commands
in steps that open with a description, and rule 2 in `src/lib/plainWords.ts` now holds every
numbered step. A sentence that describes keeps *you* + a verb, because turning it into a command
tells the reader to do something the guide only described. The six below describe. The four under
them could go either way, and that is a person's call, not a script's.

## Must stay as written (6)

- *complete-a-forms-office-section* step 5: "You attest under penalty of perjury that you examined the documents and entered them truthfully." (legal wording: what the signature means)
- *price-a-bid-with-the-workbench* step 5: "You let go and the sweep saves in one batch." (an outcome)
- *see-a-customers-full-history-and-lifetime-value* step 2: "You stay on the list." (a result)
- *see-the-email-a-customer-gets-with-an-estimate* step 3: "You close the tab and you resend again." (a warning: close the tab and you must resend)
- *start-here-as-a-superintendent* step 5: "You read the job here." (a role; *The office edits it.* follows)
- *track-a-general-contractor-on-a-job* step 2: "You dig in and close it, and your checkmarks are still there." (a result)

## For a person to decide (4)

- *answer-an-owner-who-calls-about-a-lien-letter* step 1: "You reach it from Jobs → Pipeline → the Collections header {{button:outline|Lien desk}}." (where it is; a command would read *Open it from …*)
- *start-here-as-an-estimator* step 2: "Then you give each fixture its parts." (a map of the tab)
- *start-here-as-an-estimator* step 4: "You send the link from your own email." (a map of the tab)
- *track-a-general-contractor-on-a-job* step 3: "You set the phone there once." (a one-time setting)
