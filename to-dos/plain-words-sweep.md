---
name: "Plain words: the last 77 help guides"
number: 75
group: ready
status: paused 2026-09-30 by the owner · 228 of 305 guides read in plain words on main (226 by the sweep, v2.4235 · 4258 · 4282 · 4283 · 4286, the last merged 2026-10-01; two new guides held from their first commit) · the legacy list is the queue
summary: >
  Plain words is the convention for every new or changed guide and walkthrough (v2.4233): one
  idea per sentence, none over 20 words, the control's exact name, a plain word beside a trade
  word the first time, nothing glued with dashes, semicolons, parentheses or dot lists. The owner
  also asked to go back through the guides written before the rules. Five batches went in one
  day, fifty guides each, a few rewriters in parallel. 77 guides are still on
  `LEGACY_PLAIN_WORDS_GUIDES`, from `see-how-often-we-go-back` through
  `write-up-a-change-order-from-the-field`. A PR that touches one of them must rewrite it anyway
  (`npm run check:plain-words`), so the list only shrinks.
next: >
  Two more batches, the same recipe (below): cut a branch from fresh main, take the next fifty
  rows of `src/lib/plainWordsLegacy.ts` in order, rewrite them (five rewriters, ten guides each),
  run the checker and the structure diff, drop the rows, release note + fragment, merge main
  before the PR and re-read any guide main changed meanwhile. Batch 6 is the first fifty rows
  (`see-how-often-we-go-back` … ), batch 7 the last 27 minus whatever other PRs have rewritten
  since; then the list is empty and `plainWordsLegacy.ts` is deleted. Separately, *Left for a person
  to read* below: the Workbench's ? card, and the words the rewriters had to guess.
size: M (two PRs, 50 and 27 guides; about 70,000 words of prose to rewrite)
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

## Where it stands

| Batch | Guides | Version | Range |
|---|---|---|---|
| 1 | 50 | v2.4235 | add-a-customer … create-an-assembly-while-doing-a-takeoff |
| 2 | 50 | v2.4258 | create-rename-and-share-a-roadmap … job-followups |
| 3 | 50 | v2.4282 | job-mode-clocking … price-a-bid-with-the-workbench |
| 4 | 50 | v2.4283 | price-a-takeoff-in-sticks … see-how-many-jobs-ran-each-day |
| 5 | 25 | v2.4286 | see-if-a-helper-worked-out … set-the-company-owner-account, merged 2026-10-01 (the batch was cut short by a usage limit; the other 25 of its fifty are back on the list) |

Other sessions removed a few rows on their own as their PRs touched guides — the convention
working. `grep -c "^  '" src/lib/plainWordsLegacy.ts` is the live count.

## Left for a person to read

None of these fail a test; each wants someone who knows the screens or the trade.

- **The Workbench's ? card** (`src/components/bids/WorkbenchHelpCard.tsx`, Bids → Pricing → ?).
  Its four lines (*Type a price*, *Solve*, *This bid* / *This GC*, *Labor & cost*) still read in
  the old voice, with dashes and a parenthesis. The walkthrough it opens was rewritten in v2.4228;
  the card was noted on #58 and lost when that row closed. Small: four strings and a test case.
- **Two counts that do not match their lists**, kept as written because the rules forbid changing
  a number: *see every contract side by side* says "four lines" above six bullets; *reconcile Cash
  App payments* says "four buttons" above five.
- **Three phrases kept word for word** because the rewriter could not tell what they mean:
  - *file a lien and never miss its deadlines*: "The first bill on a GC job is the last net."
  - *fill and sign a form on my phone*: "the lens skips it."
  - *estimate labor hours on a bid*: "the same lens A the Overhead tab shows."
- **"pretest"** is left without a plain word, twice, in *choose who gets the bill*.
- **Plain words the rewriters said they guessed at.** Each sits beside the trade word the first
  time it appears; a wrong one is a one-line fix.

| Guide | Guessed |
|---|---|
| choose who gets the bill | the portals, "the pages a customer or GC signs in to" |
| crew P&L | a sub sheet, "a subcontractor's labor sheet" |
| drill into the Dashboard money cards | burn, "the money the office spends" |
| find a job address from the field | the ledger, "the app's list of jobs" |
| find a supply house and its rep | a rep, a job account, aging |
| give a customer a lien release | the legal description, "the lot as the county records name it" |
| import a takeoff from CountTooling | a takeoff, "the count of fixtures and pipe runs from the drawings" |
| job address city line breaks | the AIA G702/G703, "the standard progress-billing form" |
| job charges timeline | overhead, "the office's running cost" |
| let the robots shadow a bid | first drafts, "the first pass at our bids"; a lens, "one of the group's views" |
| quickfill | Moneyfill, "the weekly money close page" |
| read a partner's balance from the office | rate-tier days, "the days already stamped with their pay rate" |
| read field reports on the Dashboard | a field report, "what a tech files from the job" |
| record sub labor on a job | the assembler, "the work order builder" |
| reports | a turnaway, "a visit where the work could not be done" |
| review a collections account before it goes to your attorney | writing it down, the contingency %, exhibits |
| run the robots from Claude Desktop | a shadow, a shell, a price matrix, a harness |
| run your GC statement round | retainage, certification |
| see a customer's full history and lifetime value | lien-ready, "the record a lien filing needs is complete" |
| see how close the robots are | a shadow run, "the robot pricing a live bid before our number exists" |

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

- **Cut each batch from the list on its own branch, after merging main.** Batch 5 was cut by
  row number from a branch where batch 3's rows were still listed; batch 3 had 49 rows there, not
  50, so `see-how-often-we-go-back` was stepped over and now leads the list.

- **Usage limits** cut rewriters off mid-guide twice in one day. Save per guide; check which
  pass before relaunching; never trust a guide that is shorter than its original.
- **A version claimed can be taken on main** while a batch is written (v2.4260, v2.4274, v2.4275
  and v2.4278 all were); re-claim before the PR and renumber the note and fragment, and check the
  number a PR merged under before citing it.
- **A `:::example` panel whose closing `:::` line carries prose** hides everything after it
  from every reader; batch 2 found and fixed one. Close panels on a bare `:::`.
