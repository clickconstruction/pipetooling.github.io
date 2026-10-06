---
name: "Plain words: every help guide reads by the rules"
number: 75
group: close
status: DONE 2026-10-05 · batches 6–8 (v2.4589 · v2.4597 · v2.4601, three helpers in parallel, one contiguous run of the list each) rewrote the last 67 · the checker fix v2.4607 (table pipes, a lone — cell) · v2.4613 deletes the list and `check:plain-words` — `helpGuidePlainWords.test.ts` holds all 305 · left for a person: the lists below, and two questions for the owner
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
  Nothing to rewrite. Three things for the owner: (1) a freshness pass per surface — 21 guides
  describe screens that moved (the list below; the lien guides are the worst and are underway);
  (2) the six long reference guides that do several jobs want a task-first opening and cuts
  (the openings and splits are in the PR bodies of #4575, #4586 and #4589); (3) whether numbered
  steps should read as plain commands ("Press…") rather than "You press…" — on main today 144
  steps start with a command and 51 with "You". Then delete this folder.
size: done
blocker: None.
ver: v2.4233 · 4235 · 4258 · 4282 · 4283 · 4286 · 4589 · 4597 · 4601 · 4607 · 4613
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
| 6 | 23 | v2.4597 | see-how-often-we-go-back … share-a-customer-their-portal (Helper 6, 2026-10-05) |
| 7 | 22 | v2.4601 | share-a-help-guide … tally-payroll-marking (Helper 7, 2026-10-05; the checker fix v2.4607 went first) |
| 8 | 22 | v2.4575 → v2.4589 | tell-if-a-customer-opened-an-estimate-and-record-a-no … write-up-a-change-order-from-the-field (Helper 8, 2026-10-05) |

Other sessions removed ten rows on their own as their PRs touched guides — the convention
working. The list emptied on 2026-10-05 and v2.4613 deleted it with `check:plain-words`; the
test holds every guide, and a guide failing it is rewritten, never exempted.

## Left for a person to read

None of these fail a test; each wants someone who knows the screens or the trade.

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

### From batches 6–8 (2026-10-05)

Each batch's PR body (#4586, #4589, #4575) carries the full lists: every phrase kept word for
word, every plain word added with where it was checked, and the near-misses a second reader
caught. The owner-facing residue:

- **Phrases kept word for word** because no rewriter could tell what they mean: "the same quiet
  electronic-signature line" (share a sub their portal); "the pile counsel named", "by the run or
  by hand" (the attorney guide); "whose exposure an unpaid balance is" (the supply-house quote
  link); "the previous step reopens for rework automatically" (start here as a superintendent);
  "raises lowering C" (overhead numbers); "statemented" (track a GC); "the fold candidates" (usage
  dashboard); "Since v2.2967" in user prose (write a change order).
- **Left without a plain word**: robot delta, gross (Balances computes net minus paid), exhibits,
  Sworn account, § 53.056 notice, day ledger, true margin, bond, warranty-shaped, alternate.
- **Guessed words to eye**: retainage, "the part of each payment held back until the job is done";
  draw, "what you bill for that stage"; mobilization, "the cost of moving crews and gear onto the
  job"; accrual, "work counts when it is earned, not when cash moves"; a joint check, "one check
  made out to both the GC and us"; a development, "a group of properties built as one project".
  Correction to an earlier row: "the portals" in *choose who gets the bill* is better glossed
  "the GC's own web page of open bills and payments" (the card's own words), not "pages a customer
  or GC signs in to".
- **Two counts that disagree with their lists**, kept as written: *track a general contractor on a
  job* says "Reply to is the third line" of a four-line list; the earlier two are above.

### Out of date, found by the sweep and not fixed (the freshness pass)

A rewrite keeps every fact, so these were listed, not fixed. One PR per surface; the lien guides
are underway (Helper 3, 2026-10-05).

- **Lien desk**: *understand how liens work and which lien tool to use* says the retainage notice
  is "not modeled in the app yet"; names "Lien instruments, the orange lien icon" (now the Lien
  window and the gavel); "Bill Customer → Lien releases"; the desk's three views (v2.4588).
- **Start-here guides**: the master's says to add an account in Settings (People → + Hire since
  v2.4348); the office one says Banking is shared with assistants (controller-and-above since
  v2.3305); the superintendent's says "Assigned Superintendents" (the strip reads "Superintendents:").
- **Track a GC**: the Share menu lacks *Find a check…* (v2.4046); the billing section predates
  *Bills go to* (v2.3345); rows now group by account man; it overlaps *run your GC statement round*.
- **Submittals**: *turn a won bid into a job*'s submittals section predates this week's parts
  and GC-sees changes.
- **Bills**: *turn a bill into a Stripe bill* and *sub labor outstanding* describe the old Bill
  tab and old settings paths; *sort the bank feed* puts the cost timeline on the Bill tab (Costs
  tab since v2.3361); *sort the Pipeline by time added* says three orders (four since v2.3788).
- **Emails and settings**: *see what the team sees* says 25 emails (26) and a count breakdown
  that is gone; *see your email schedule*'s Digests / Every report tabs are gone (v2.3595);
  *settings basics* names a Notifications tab (Activity logs) and says View as… is for leaders
  (dev only); *share a customer their portal* says "Settings → Email streams" (Emails & reports).
- **Others**: *see when a customer will pay* (the hygiene link v2.2288, receipt chips now rows,
  "average" is the median); *see where you win and lose with a builder* (Builder Review is
  Followup → By builder); *send a supply house a quote link* (the Kind chips, v2.3172); *send a
  bid for signature* ("Jobs → Stages" is the Pipeline; the third decline reason); *see what to do
  next on a roadmap* (the Needs You row reads *Open Plan*); the attorney guide has two "## 6."
  headings; *try the new cover letter layout*'s slug and title disagree.

### Guides that do several jobs (the reshape question)

Readable by the line after the sweep and still too long for a first-timer; each wants a
"do this first" opening and cuts, which is the owner's call. The openings and splits are in the
PR bodies: *see when a customer will pay* (2,814 words, four guides in one), *share a customer
their portal* (2,673), *track a general contractor on a job* (2,509; mostly duplicates *run your
GC statement round*), *share a sub their portal* (1,983; share it / what a sub sees), *the Bridge*
(1,707), *understand overhead numbers* (1,520; the how-to sits at the bottom), *see what the
office got done* (1,213), *stage a takeoff*, *sub labor outstanding*, *turn a won bid into a
job*, *write a change order*, the two start-here maps.

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

What batches 6–8 added to the recipe (2026-10-05), for any future rewrite of a guide:

6. **A stale-facts pass before the rewrite**: read the screen or the code the guide describes
   first. Four of 22, nine of 23 and eight of 22 guides described something that had moved;
   polishing a wrong sentence costs as much as a right one, and the sweep's rule forbids fixing it.
7. **A gloss is a claim**: verify a plain word in code or in another guide, or leave the trade
   word bare and list it. Two of one batch's glosses were wrong and two misleading, caught only by
   reading the code ("retainage is money held back until the work is done" — it stays held after).
8. **An independent old-against-new read**, sentence by sentence, after the rewrite, and another
   over the diff after any later pass. The structure diff guards tokens, numbers and bold, not
   meaning: reviewers found about 25, 21 and 3 slips per batch that every check passed ("the four
   template emails" → "four template emails"; "a browser without a share sheet" → "a browser has
   no share sheet"; a pronoun pass itself re-pointed "the card").
9. **Repeat the noun across a full stop**: splitting sentences leaves chains of "It… That… So…",
   and a weak reader carries the "it" back. Where the sentence before offers more than one noun
   the pronoun could mean, name it; at most one sentence per paragraph opening on "So". Not a test
   yet: a finder (Helper 8's, in #4575's body) flags about 3,400 sentences across the 250 earlier
   guides at 99% precision, but only about 40% are ambiguous, so it is a warning at best.
10. **Captions are prose**: the checker counts a gif caption, so "keep every token" cannot hold
    for captions; they get rewritten like any sentence. Table rows: pipes are not words and a lone
    "—" cell is not glue (v2.4607).

## Watch for

- **Another session's merge shepherd can push to the batch's branch.** On 2026-10-05 a
  merge-conflict session rewrote a table row to pass the checker's pipe miscount, dropping a fact
  ("green"). The row was restored; the checker was fixed instead. A rewrite that satisfies a
  miscount is the one thing the sweep must never do.

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
