---
name: "The employer's electrical safety procedures: the paper, its licensed reader and where it lives"
number: 122
group: gated
status: DRAFTED 2026-10-18 — the paper is written from Intro to electrical and the OSHA 30 refresher's two electrical lessons and sits beside this file for the owner's read and the licensed reader's check; the owner's three calls were asked once for both sets and the defaults taken (placeholders for the names, read-only reference first with the signing flow as a later PR, English only); nothing in the app changes until the reader has corrected it
summary: >
  Intro to electrical's lessons say "the company's rule" at the water heater, the bonding
  jumper, the lock and the reset, and point at an employer's written procedure that did not
  exist. This paper is that procedure, the employer's electrical safety procedures for the
  plumber as an unqualified person under NFPA 70E, fourteen numbered procedures from live until
  tested to who the electrician is. Every procedure has who, when, what, the stop-work line,
  the NEC article or OSHA rule it comes from and what the owner or the licensed reader must
  confirm. Electrical is not the company's trade, so the licensed reader is the gate, the way
  the course's own reader is. The plan puts it in the app as a help guide and a line on the
  Training card first, the electrician's number in a private company document, and a signing
  flow through Contract Forms when the owner wants every crew member to sign. The plumbing
  procedures are their own set, #121, read by the owner.
next: The owner names the licensed reader, the same reader #120 waits on. The reader corrects the paper in place and closes every Confirm line marked for the reader; the owner closes the rest and names the electrician. Then PR 1 puts it in the app.
size: S for PR 1 (one guide and one line on the card); M for the signing flow; S for the Spanish copy
blocker: The licensed reader the owner has not yet named for Intro to electrical (#120). The company cannot vouch for electrical numbers itself, so the paper is not handed out until the reader's name is on its Read by line.
opinion: build PR 1 the week the reader signs off, in the same PR train as #120's read-through, because the reader checks the lesson and the procedure against the same code cycle in one sitting
mockup: not required — the paper beside this file is the thing to read; PR 1 draws it on the real help page as a dev preview
---

# The employer's electrical safety procedures (#122)

Intro to electrical (#120) is thirty lessons on how a house's electrical system works, for the
plumbers who work beside it. Understanding, not doing. Several of its lessons say *the company's
rule* and point at the employer's written procedure. Lessons 15 and 24 cite the water heater
rule, lesson 8 and the Part 3 strips cite the bonding jumper rule, lesson 27 says the owner names
who locks, and lessons 19, 20 and 24 cite the once rule for a reset. The OSHA 30 refresher's
lesson 28 says the employer's electrical safety program is written and site-specific. None of
that was written down anywhere. The owner, a master plumber, asked: "could you help me make the
employer's plumbing safety procedures and electrical safety procedures?" The owner then said the
two are separate sets with separate readers, so this folder is the electrical set and
`to-dos/plumbing-safety-procedures/` (#121) is the plumbing set. They share the house voice and
the three owner questions, asked once, and nothing else.

This folder holds the paper and the plan for where it lives.

- [`ELECTRICAL_SAFETY_PROCEDURES.md`](./ELECTRICAL_SAFETY_PROCEDURES.md): fourteen procedures.

## The owner's three calls (asked 2026-10-18, the defaults taken)

1. **The company name and the safety role.** Placeholders. The paper reads *[Company name]*,
   *[Safety lead]*, *[Electrical reader]* and *[Licensed electrician]* until the owner fills them
   in.
2. **Signed or read-only.** Read-only reference first. PR 1 makes the paper a help guide and adds
   a line to the Training card. The signing flow through Contract Forms is PR 2, built only if the
   owner says every crew member signs.
3. **Spanish.** English only now. The Spanish copy is PR 3 and follows the course's own Spanish
   switch, which #120 deferred.

## Who reads it for correctness

**The licensed reader is the gate.** Electrical is not the company's trade. A procedure that
says what a breaker does or where the plumber's side of a water heater ends is a claim the
company cannot vouch for itself, and a crew member who reads it will treat it as true. So the
paper carries a *Read by* line for a licensed electrician and the code cycle the company's cities
inspect under, the way `course.md`'s `line` does for #120, and the paper is not handed out until
that line is filled. The reader is the same one #120 waits on: the course's owner's call 1 named
the electrical sub the company works with, with a published source behind every number.

Every Confirm line in the paper says which of the two readers checks it. **The reader** confirms
every number and every article against the code cycle, and that nothing in the paper reads as a
qualified person's work. **The owner** confirms every company rule: the water heater's scope, the
once rule, who locks and unlocks, whose electrician is called first on a GC job.

A number the reader changes is changed in the paper first and in the lesson second, in the same
week, with the reader named on the lesson's `from:` line as #120's plan requires.

## What the paper is

The paper opens by saying what the plumber is under NFPA 70E, the electrical safety standard
OSHA cites: an unqualified person, who learns to see the hazard, stay outside the boundaries and
know when to call, and who never tests, troubleshoots or works on anything live. Every procedure
after that ends where the course's lessons end, at what not to touch and who to call. Every
procedure has the same six parts:

- **Who** does it.
- **When** it is done.
- **What** the numbered steps are.
- **Stop work when**, the one line that ends the work.
- **Where it comes from**, the NEC article, the OSHA rule and the lesson behind it, cited the way
  the course cites them.
- **Confirm**, what the owner or the reader must check before the paper is handed out.

Every number came from a lesson, and the lesson's `from:` line says which article the lesson
got it from. Nothing in the paper is a number the course does not hold, so the reader's read of
the paper and the reader's read of the course check the same facts against the same cycle.

The paper is written in the house voice (`src/lib/plainWords.ts`: one idea per sentence, none
over 20 words, no dashes, semicolons or parentheses inside a sentence). A scratch check ran the
guide test's own functions over the file and found nothing, so it will pass
`helpGuidePlainWords.test.ts` unchanged when PR 1 turns it into a guide. The citations drop the
paragraph letters for that reason: `250.53(D)(1)` reads `250.53`, NFPA 70E is cited by article
(110, 120, 130), and the lesson named beside each carries the rest for the reader to sharpen.

## Where each "the company's rule" in a lesson is written down

| The lesson says | The procedure |
|---|---|
| Intro to electrical 15, 24, 26, 28: the water heater's scope, breaker off and tested dead before any cover, the plumber's side ends at the disconnect | 6 |
| Intro to electrical 19, 20, 24: one reset of a breaker, a GFCI or the high-limit, a second trip is a call | 11 |
| Intro to electrical 8, 23, 30: never remove a jumper, tell the electrician before a metal to plastic change | 5 |
| Intro to electrical 27: on the company's own jobs the owner says who locks and who unlocks | 3 |
| Intro to electrical 13, 14, 17: the GFCI and AFCI rooms differ by cycle, the lessons give the company's rule | 4 and 8, a GFCI wherever a plumber plugs in near water |
| Intro to electrical 26: every wire is live until tested, test the tester | 1 and 2 |
| Intro to electrical 21, 25: water on a panel, a backfeed | 7 and 10 |
| Intro to electrical 16, 17: the disposal, the dishwasher, the sump and the well start by themselves | 8 |
| Intro to electrical 28, 30: the 1-1/4 in setback, the nail plate, the drilled cable | 9 |
| Intro to electrical 22, OSHA 9: every cord on a job runs through a GFCI | 4 |
| OSHA 28: the ESP is written and site-specific, the unqualified person, the boundaries | the opening and 12 |
| OSHA 9: the 10 ft from an overhead line | 12 |
| The electrician the company works with | 13 |

When a lesson gains a new *the company's rule* line, it gets a row here and a step in the
procedure, in the same PR. When a procedure changes, the lessons in its row change with it,
with the reader's name on the `from:` line. That is the whole mechanism for keeping the paper in
step with its course, and the Amend, don't add rule in `CLAUDE.md` is what enforces it. The
plumbing set's procedure 9 says the same GFCI rule as this set's procedure 4, and a change to one
is made to both.

## Where the paper lives in the app

The default taken: read-only reference first.

**The help guide.** The paper becomes one guide under `src/content/help/`, category Field Work,
`roles: all`, with a title that completes "How do I…": `follow the company's electrical safety
procedures`. The guide's body is the paper as it stands, the `##` headings its procedures, so a
lesson can one day link `/help/<slug>#6-the-water-heater-rule` to the one procedure it cites. The
guide is held by `helpGuideContent.test.ts`, `helpGuidePlainWords.test.ts`,
`helpGuideLinks.guides.test.ts` and `helpShareCard.guides.test.ts` from its first commit, and the
build draws a share card at `/g/<slug>/`.

**What the guide must not hold.** The repo and the `/g/` pages are public. So the guide carries
the company name and the roles, and never a person's name, a licence number or a phone number.
The *Who to call* list, the reader's name and licence number and the electrician's name and
number go in the **private company document** the plumbing set also uses: Documents → Company,
*Safety roles and phone list*, one link to a one-page PDF the owner keeps. The guide's *Read by*
line reads *a licensed electrician, named on Documents → Company*, and its *Who to call* section
names only 911 and the utility's public line.

**The Training card.** `DashboardTrainingSection.tsx` gains one line under the courses: *The
company's safety procedures*, with this guide as a link beside the plumbing guide. If #121's PR 1
lands first, the line exists and this PR adds the second link.

**The course.** Nothing in a lesson changes in PR 1. The lesson files do not carry links today.
When the reader's read-through of #120 lands, the lessons that say *the company's rule* could
name the procedure by number in their `from:` line, which is a one-word change and needs no
parser.

**Not drawn, on purpose.** A page of its own, and a copy of the paper inside the course. The
help page exists and the course's content rule, that no lesson instructs, would be broken by a
procedure that says what to do.

## The PR train

0. **This PR.** The plan and the paper. No version claimed, nothing in the app changes.
1. **Read-only reference (S).** After the reader's sign-off: the guide from the corrected paper,
   the link on the Training card's line, the release note and the `docs/recent-features/`
   fragment, `GLOSSARY.md`'s Training entry gains a clause, the guide *take a training course*
   gains one sentence. The reader's name goes on the private company document, never in the
   repo. Shot on the real help page at phone width in both themes.
2. **Signing (M), only if the owner says every crew member signs.** The Contract Forms path, as
   the plumbing set's PR 2 describes it, into the same **All Teammates** packet as its own Book
   entry with its own paperwork type. The reader's sign-off date is a constant box on the last
   page, so a signer sees that a licensed person read the paper. A new code cycle is a new
   revision through Replace PDF… and everyone signs again.
3. **Spanish (S).** The Spanish copy of the guide when the course gets its Spanish switch, read
   by the same reader, and `labelEs` on the form boxes if PR 2 was built.

## How to verify

- **This PR.** `npm run check:todos` passes and assigns #122. The scratch plain-words check over
  the paper reads zero failures. The paper is read on GitHub in this folder, or in the app once
  PR 1 lands.
- **PR 1.** The four guide tests pass. On a dev login at phone width, the Training card's line
  shows the guide, it opens, every `##` anchor resolves, and the share card at `/g/<slug>/` reads
  the title and the first paragraph. The guide names no person, no licence number and no phone
  number. The *Read by* line on the private document carries the reader's name and the cycle.
- **PR 2.** The test teammate's path: the paper appears in the packet, is signed from the phone,
  the flattened PDF opens from the staff record through the gated door, and the pill reads it
  present.

## Open with the owner and the reader (the Confirm lines, gathered)

The paper's Confirm lines are the list. Each says whose it is.

- **The owner: names.** The company name. The safety lead. The licensed reader and their licence
  number. The electrician and the second electrician. The utility's emergency line per city.
- **The owner: the lock owner.** On the company's own jobs, who locks and unlocks. The draft says
  the crew lead locks a water heater's breaker and the electrician locks everything else.
- **The owner: the once rule.** One reset of a breaker, a GFCI and the high-limit, as the lessons
  say. The draft holds all three at once.
- **The owner: the water heater's scope.** As given on 2026-10-18. The draft adds that an element
  swap is licensed work in some cities and the office knows which.
- **The owner: whose electrician first on a GC job.** The draft says the GC's, through the
  superintendent.
- **The owner: how the electrician is called on a customer's job.** The draft says through the
  office, with the customer's say so.
- **The reader: every article.** NEC 210.8, 250.53, 250.104, 300.4, 110.26, 240.4, 240.24,
  422.13, 422.31, 702 and 705, against the cycle the company's cities inspect under.
- **The reader: the numbers.** 5 mA, 1-1/4 in, 30 A and 10 AWG, 10 ft from an overhead line.
- **The reader: the tester.** That a non-contact tester is enough for the touch points in the
  paper, and where a meter is needed instead.
- **The reader: the boundaries.** That procedure 12 reads the limited approach and arc flash
  boundaries correctly for an unqualified person.
- **The reader: licensed work.** Which of the company's cities call an element swap licensed
  work, and any local rule on solar disconnects.
