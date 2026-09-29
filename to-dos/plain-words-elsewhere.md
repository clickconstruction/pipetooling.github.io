---
name: "Plain words on the other first-timer surfaces"
number: 58
group: residual
status: opened 2026-09-29 after the Submittals plain-words train (v2.4123–v2.4126) · nothing built elsewhere yet
summary: >
  The Submittals train wrote the rules for words a first-timer can follow — one idea per
  sentence, under 20 words, *you* + a verb and the button's exact name, a trade word explained
  beside itself the first time, no dashes, semicolons, parentheses or dot lists inside a
  sentence, the same shape every stop — and a test that holds them. The same SpotlightTour
  drives the Pricing Workbench walkthrough (five stops in `lib/bids/workbenchHelp.ts`, still in
  the old voice), and the help guides, the strip's Next lines on other pages and the toasts were
  never held to the rules.
next: >
  1. The Pricing Workbench walkthrough: rewrite its five stops by the rules and copy
  `submittalTour.test.ts`'s cases over `WORKBENCH_TOUR_STEPS` (one PR).
  2. Guide *build a submittal package*: the guide still reads in the old voice while the page
  and the tour read plain; rewrite it section by section, examples kept (one PR).
  3. Decide whether the rules become a repo convention for every first-timer surface (a line in
  `CLAUDE.md` under help guides, and a shared `plainWords.test.ts` helper the tour tests import)
  — an owner call, since it binds every future walkthrough.
size: S (two PRs; the convention is a sentence)
blocker: none; 3 is an owner call.
ver: —
opinion: soon — Wendi and Stephen are on the Submittals tab this week and will hit Pricing's walkthrough next; the rules exist, so each PR is a rewrite and a copied test.
---

# Plain words on the other first-timer surfaces

The owner, 2026-09-29, on the Submittals walkthrough: it "needs to use simpler sentences to communicate ideas. They are hard to follow for someone who is not very smart." The fix became a four-PR train on Submittals (v2.4123 the walkthrough, v2.4124 the page's own sentences, v2.4125 a sentence and a `?` under every step, v2.4126 four words over the pills) and a set of rules with a test behind them (`src/lib/submittals/submittalTour.test.ts`). This row is what the train did not reach.

## The rules (the one home; other docs link here)

1. One idea per sentence. No sentence over 20 words.
2. Start with what the person does: *you* + a verb, and the button's exact name.
3. No dashes, semicolons, parentheses or `·` lists inside a sentence.
4. A trade word gets a plain word beside it the first time: *a cut sheet, the maker's page for the product*.
5. Every stop has the same shape: what this is → what you do → what happens after.
6. A test holds the rules; words that fail it are rewritten, never exempted.

## What is left

- **Pricing Workbench walkthrough** (`src/lib/bids/workbenchHelp.ts`, `WORKBENCH_TOUR_STEPS`, five stops; the `?` card's facts beside them). Same `SpotlightTour`, so the scroll fix (v2.4121) already applies; the words do not.
- **The help guide** `src/content/help/build-a-submittal-package.md`: its "Where you are" and "Without the robot" sections were amended by the train, the rest is the 2026-09-1x voice.
- **The convention**: whether every future walkthrough and Next line is written by these rules. If yes, the rules move to `CLAUDE.md` (one clause) and this section becomes a link.
