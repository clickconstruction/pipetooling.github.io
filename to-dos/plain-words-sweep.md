---
name: "Plain words: the last 77 help guides"
number: 75
group: ready
status: paused 2026-09-30 by the owner after 226 of 303 guides shipped (v2.4235 · 4258 · 4282 · 4283 · 4286) · the legacy list is the queue
summary: >
  Plain words is the convention for every new or changed guide and walkthrough (v2.4233): one
  idea per sentence, none over 20 words, the control's exact name, a plain word beside a trade
  word the first time, nothing glued with dashes, semicolons, parentheses or dot lists. The owner
  also asked to go back through the guides written before the rules. Five batches went in one
  day, fifty guides each, a few rewriters in parallel. 77 guides are still on
  `LEGACY_PLAIN_WORDS_GUIDES`, from `send-lien-notices-from-the-lien-desk` through
  `write-up-a-change-order-from-the-field`. A PR that touches one of them must rewrite it anyway
  (`npm run check:plain-words`), so the list only shrinks.
next: >
  Two more batches, the same recipe (below): cut a branch from fresh main, take the next fifty
  rows of `src/lib/plainWordsLegacy.ts` in order, rewrite them (five rewriters, ten guides each),
  run the checker and the structure diff, drop the rows, release note + fragment, merge main
  before the PR and re-read any guide main changed meanwhile. The first batch left is the 51
  guides `send-lien-notices-from-the-lien-desk` … `write-up-a-change-order-from-the-field`
  minus whatever other PRs have rewritten since; then the list is empty and
  `plainWordsLegacy.ts` is deleted.
size: M (two PRs of ~50 guides; about 70,000 words of prose to rewrite)
blocker: None. The owner paused it; say go.
ver: v2.4233 · 4235 · 4258 · 4282 · 4283 · 4286
opinion: build on when there is a quiet evening — every guide left is one a first-timer may open, and the rules already hold every new one
mockup: not required — words only; the test and the checker are the proof
---

# Plain words: the last 77 help guides

## The ask

The owner, 2026-09-29, on the Submittals walkthrough: it "needs to use simpler sentences to
communicate ideas. They are hard to follow for someone who is not very smart." On 2026-09-30:
"yes, make it the convention, new and changed only", and "I do want to go back through the old"
guides. Then, the same evening: "Let's pause on this for now and add it to the punch list."

## The decision

- **The rules** have one home, `src/lib/plainWords.ts` (its header lists all six;
  `CLAUDE.md` → *Help guides ship with features* carries the clause). Rules 1 and 3 are
  mechanical; `helpGuidePlainWords.test.ts` holds every guide not on
  `LEGACY_PLAIN_WORDS_GUIDES`, and `scripts/check-plain-words.ts` (`npm run check:plain-words`,
  in CI) fails a PR that touches a guide still on the list.
- **The sweep goes alphabetically in blocks of fifty**, each batch removing one contiguous run
  of rows, so batches in flight never conflict on the list. Cut each batch from fresh main.
- **What a rewrite keeps**: the frontmatter, the headings (an em dash may become a colon), every
  `:::example` panel word for word, every mock-UI token and link, every fact. The first paragraph
  is two plain sentences (the share card's line). Screen text the app prints with a dash, a dot
  or parentheses is quoted in italics, the rule's exemption; a bold label becomes bold-italic.
- **Two stale counts were kept as written**, since the rules forbid changing a number: *see
  every contract side by side* says "four lines" above six bullets; *reconcile Cash App
  payments* says "four buttons" above five. Worth a glance by someone who knows the screens.

## Where it stands

| Batch | Guides | Version | Range |
|---|---|---|---|
| 1 | 50 | v2.4235 | add-a-customer … create-an-assembly-while-doing-a-takeoff |
| 2 | 50 | v2.4258 | create-rename-and-share-a-roadmap … job-followups |
| 3 | 50 | v2.4282 | job-mode-clocking … price-a-bid-with-the-workbench |
| 4 | 50 | v2.4283 | price-a-takeoff-in-sticks … see-how-many-jobs-ran-each-day |
| 5 | 25 | v2.4286 | see-if-a-helper-worked-out … set-the-company-owner-account (the batch was cut short by a usage limit; the other 25 of its fifty are back on the list) |

Other sessions removed a few rows on their own as their PRs touched guides — the convention
working. `grep -c "^  '" src/lib/plainWordsLegacy.ts` is the live count.

## The recipe (what worked)

1. `git switch -c claude/plain-words-guides-N origin/main`; `npm run claim`.
2. The next fifty slugs: `sed -n "s/^  '\(.*\)',$/\1/p" src/lib/plainWordsLegacy.ts | head -50`,
   split into five lists of ten.
3. Five rewriters in parallel, one list each, with the rules, the keep-list above and a checker
   that prints each guide's failing lines (`helpGuidePlainWordsFailures` from `plainWords.ts`
   over the files). Each saves guide by guide, so a cut-off loses little; a cut-off rewriter's
   half-written guide is put back from HEAD and done again.
4. Before the commit: every guide prints OK; a structure diff against HEAD (token kinds,
   headings, example panels, frontmatter) shows nothing changed; `npx vitest run
   src/lib/helpGuidePlainWords src/lib/helpShareCard.guides src/lib/helpGuideContent`.
5. Drop the rows from `plainWordsLegacy.ts`, release note + fragment, commit, then `git merge
   origin/main`: a guide main changed meanwhile takes main's text and is re-read by the rules
   (two or three per batch so far). `npm run check:plain-words`; push; `gh pr merge --auto`.

## Watch for

- **Usage limits** cut rewriters off mid-guide twice in one day. Save per guide; check which
  pass before relaunching; never trust a guide that is shorter than its original.
- **A version claimed can be taken on main** while a batch is written (v2.4260 was); re-claim
  before the PR and renumber the note and fragment.
- **A `:::example` panel whose closing `:::` line carries prose** hides everything after it
  from every reader; batch 2 found and fixed one. Close panels on a bare `:::`.
