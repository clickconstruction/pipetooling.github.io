---
name: "Plain words on the other first-timer surfaces"
number: 58
group: residual
status: opened 2026-09-29 after the Submittals plain-words train (v2.4123–v2.4126) · item 1 shipped v2.4228 (the Workbench walkthrough) · item 2 shipped v2.4229 (the guide) · the convention call left
summary: >
  The Submittals train wrote the rules for words a first-timer can follow — one idea per
  sentence, under 20 words, *you* + a verb and the button's exact name, a trade word explained
  beside itself the first time, no dashes, semicolons, parentheses or dot lists inside a
  sentence, the same shape every stop — and a test that holds them. The same SpotlightTour
  drives the Pricing Workbench walkthrough (five stops in `lib/bids/workbenchHelp.ts`, still in
  the old voice), and the help guides, the strip's Next lines on other pages and the toasts were
  never held to the rules.
next: >
  1. Done, v2.4228: the Pricing Workbench walkthrough's five stops by the rules, with
  `submittalTour.test.ts`'s cases copied over `WORKBENCH_TOUR_STEPS`.
  2. Done, v2.4229: the guide *build a submittal package* section by section, examples kept,
  held by `helpGuidePlainWords.test.ts` (its `PLAIN_WORDS_GUIDES` list names the guides held).
  3. Decide whether the rules become a repo convention for every first-timer surface (a line in
  `CLAUDE.md` under help guides, and a shared `plainWords.test.ts` helper the tour tests import)
  — an owner call, since it binds every future walkthrough.
size: XS (the convention is a sentence and a slug list)
blocker: 3 is an owner call.
ver: v2.4228 · 4229
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

- ~~**Pricing Workbench walkthrough**~~ — done v2.4228: the five stops in `src/lib/bids/workbenchHelp.ts` read by the rules and `workbenchHelp.test.ts` holds them. The `?` card's four lines still read in the old voice (dashes, a parenthesis); they are the card's, not the tour's, and small.
- ~~**The help guide**~~ — done v2.4229: `build-a-submittal-package.md` reads by the rules, examples kept; `src/lib/helpGuidePlainWords.test.ts` holds it.
- **The convention**: whether every future walkthrough, Next line and guide is written by these rules. If yes, the rules move to `CLAUDE.md` (one clause), `PLAIN_WORDS_GUIDES` in `helpGuidePlainWords.test.ts` becomes every guide (the 294 others will need their own rewrites first, or the list grows as each is done), and this section becomes a link.
