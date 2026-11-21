---
name: "Sub NDA builder: a job's secrecy settings make the paper its subs sign"
number: 389
group: waiting
status: asked 2026-11-17 · thought through, drawn and rendered the same day · the owner settled four calls, liked the idea and the sliders, and did not love how it was drawn · saved here at his word, to review and make calls on later, then build · 2026-11-19 a wider look at the builder, the gate and contracts on Documents, folded in below at his word as *The wider look* · 2026-11-19 his review of the look began: four levels, each beside a kind of place, in place of *Light* and *Strict*, and a step-by-step flow drawn at his ask, with the rest of the look still open · the same day the flow was built as a spike in the app, and he decided where the builder is parked for now: a Document builder tab on Documents, saved as #404 · 2026-11-20 steps 1 and 2 of this card's train built, the Book takes settings and prints a sample (v2.8014, v2.8019, v2.8020), and on #404 the flow, typing on it and Publish built in the tab, for a dev · the same day step 3 built, a job carries its settings and the sign path reads them (v2.8145, v2.8154) · 2026-11-21 its three functions deployed and a ZZ Test paper signed on prod, which found the signing link refused (fixed in v2.8156 and deployed the same day) · steps 4 to 8 are not started, nothing joins the tab's builder to the Book yet, and nothing has reached a real job, GC or signer
summary: >
  On a job where the company owes secrecy to a GC or an owner, the office sets a short page of secrecy
  settings, or the GC proposes them from the portal page they already open. The office confirms. The app
  then puts the job's secrecy paper together from fixed clause wordings an attorney approved, one per
  setting, and the gate requires it before anyone opens the job. Each signed copy keeps the settings and
  every clause's version. The GC sees the settings in plain words, how strict the job is, who has signed,
  and downloads a sample: the same paper with made-up names. A GC that requires its own form uses that
  form and the builder steps aside. Later the same engine makes the secrecy papers the company sends for
  itself. No model writes or changes a clause at any point. No attorney has read any wording yet.
next: The owner's calls on the look, which hold step 4, the office's settings page. Beside them, the last four steps of the Document builder tab, #404, where the flow is parked apart from any job, and the owner's read, box by box, of the grid in this card's mock-up: what each of the four levels means on each topic. Then the open calls below, with the wider calls still open in *The wider look*.
size: L as a train of eight (M · S · M · M · M · M · S · M)
blocker: The owner's calls on the look. An attorney's read of the clause wording before any real job.
opinion: your call — the engine is small and sits on what the Contract Book already does; what is open is how the settings are drawn and named, and that is yours to settle before a screen is built
---

# Sub NDA builder (#389)

The mock-up is [mockup.html](mockup.html). It works: one set of settings drives the Contract Book
screens, the office's page, the GC's page and the sample, so a change anywhere shows everywhere. It was
rendered with Playwright at desktop and phone width, in light and dark, before it was shown, and checked
at both widths and both themes in the Browser pane after each round of the 2026-11-19 review. It is **a
drawing under review, not the final look**. The owner likes the idea and the sliders and did not love how
they were first drawn. Every name on it is made up, and it shows no clause wording: sections are topic
names and grey bars.

The same mock-up as a private page: *Sub NDA builder* — https://claude.ai/artifact/QyTbYekg9q7y7zEsQSqaeA.
That page is the 2026-11-17 drawing and has not been republished since.
The approach, with the settings table, a picture of the flow and the points for an attorney, is a private
doc: *Sub NDA builder: the approach* — https://claude.ai/artifact/DqgiW7svWcdY7Y3xENVrhA.

## Not legal advice, and no legal text here

A paper the app puts together is only as sound as the clause wording an attorney approved. No attorney
has read the secrecy draft. This card, its mock-up, and every test, fixture, doc and release note the
build writes carry made-up clauses and topic names only. The draft's words live outside the repo and go
into the Contract Book through the app, by hand.

## The ask, in the owner's words

2026-11-17, after liking a twelve-question checklist for reading a GC's NDA:

> what if through the GC portal or set by us we have a Sub NDA builder where we can make these on a job
> by job basis and give the GC the ability to set these settings at the beginning of a job and generate
> an NDA on command through our portal for subs that may work through us. long term we can use this to
> create a template to create NDAs to make it easy for us to send people we work with NDAs. see these
> settings for our NDAs so the GC can see the level of strictness we created and the GC can download a
> sample.

Shown the approach and a first mock-up:

> what if we made the builder more friendly with sliders where the slider is off-light enforcment-strict
> enforcment?

Shown sliders whose stops were the terms themselves (*5 years, 7 years, 10 years*):

> I like the sliders. I just don't like how they're presented. For example, when this turns to custom I
> think the slider should change

> Although I think these sliders are cool. I Don't think they should be choices. I was hoping for other
> options as choices.

Shown every topic on one slider, *Off, Light, Strict*:

> I like the idea of all of this, but I don't love the execution. Can we save this all to a punchlist
> card for us to review and make calls on at a later time and then build?

2026-11-19, in the review of the look, with the four levels settled:

> I would like to add to the NDA builder a flow where a user set's the basis for the level they want
> their NDA to express and then goes through a series of pages with the slider at the bottom and it shows
> them the core clause and what people will be in breach for so they can slide back and fourth and see
> the difference

> I want to first build the flow for these pages and then dig into the contents of the NDA

Shown the flow, the same day. The second note stops mid-sentence, as he wrote it:

> I would like to at the first page of the NDA builder give a disclaimer saying that this is not legal
> advice and requests made via this tool should be done so with legal council representing your interest
> present and use of this is for experimental purposes only.

> making NDAs should be tuned to the real conditions on the site, if you choose clauses or methods that
> your site is not setup to enforce such as badging or security gates that require an active perimeter
> enforcment staff

> I need to spell this out for a user who is about to fill it out, I think this can go after the basics
> and before the specific clauses

## The twelve questions the settings answer

The checklist for reading the upstream NDA. A setting or a fixed rule answers each one.

| # | Look for | Answered by |
|---|---|---|
| 1 | May you share with subs at all? | A question before any paper: yes, only with written consent, or no |
| 2 | On what condition? Their own form? | *Whose paper*: ours, built from settings, or theirs |
| 3 | Must each sub be named or approved? | What the GC sees of who signed |
| 4 | Are you answerable for your subs? | Fixed in every paper |
| 5 | What counts as secret? Is the job itself secret? | Fixed in every paper, and where the protected party is named |
| 6 | Photos, phones, badges, checks, site rules | The photo, phone and site topics |
| 7 | Publicity | Fixed in every paper: none |
| 8 | How long the duty lasts | *How long secrecy lasts* |
| 9 | Return or destruction, and the deadline | *Files at the end* |
| 10 | How fast a leak or a subpoena is reported | *Reporting a leak* |
| 11 | Must they have rights of their own against your subs? | A yes-or-no question: may the protected party enforce directly |
| 12 | The carve-outs | Fixed in every paper, and no setting can switch them off |

## Settled

The owner answered these four on 2026-11-17. Each was the recommended pick.

1. **Who sets it.** The GC proposes, the office confirms. Nothing a GC presses reaches a sub before the
   office's confirm. A GC may move a setting toward stricter only.
2. **The sample.** The real paper for the job's settings, with made-up names and SAMPLE across each page,
   from the same assembly as a signer's copy.
3. **Rules in someone's own words.** Approved rules are fixed choices. One *Other rules* box exists, only
   the office can publish it, it prints in a marked box, and it cannot switch off a protected right. A
   GC's wording arrives as a proposal.
4. **Who signed, as the GC sees it.** The count, and each sub business with its date. No worker names.
   A job can be set to the count only, or to every signer by name.

The owner settled these five on 2026-11-19, in the review of the look.

5. **Not *Light* and *Strict*. A level sits beside a kind of place.** In his words: "I don't think light
   and strict are the right words to use here. I think we should show alignment with something else."
   What it is for, in his words: "I wanna give a user the tools to be able to feel like they have chosen
   the level of escalation they want."
6. **Four levels above *Off*.** *Standard* is "for private or publicly traded businesses". Above it is a
   level "for government facilities", which he named *Elevated*. Above that is the level for military
   installations. The top level is for private research labs and keeps the name *Strict*.
7. **The place beside each level is the closer fit.** He asked whether his analogies were "consistent
   with the kind of NDA that would be given out", saw the session's version beside his own, and answered
   "The closer fit". *Standard*: a regular business. *Elevated*: a hospital, a bank or a government
   building. *Aggressive*: a military base or a defense plant. *Strict*: a private research lab, on
   top as he had it from the start. The satellite factory he first named sits on the third level as a
   defense plant. No real company or person is named.
8. **The third level is *Aggressive*.** The session's pick was *High*. Shown the two side by side, he
   answered "Keep Aggressive". The four levels read *Standard, Elevated, Aggressive, Strict*.
9. **A level says what it is *aligned with*.** The session's pick was *like*, because *aligned with* can
   read as a promise. Shown the two side by side, he answered "Aligned with". The lines read *Aligned
   with regular businesses*, *Aligned with hospitals, banks and government buildings*, *Aligned with
   military bases and defense plants* and *Aligned with private research labs*. Point 12 for an attorney
   asks what that line promises.

## Open: the look

This is what the review is for. The owner likes sliders. He has not seen a drawing he would build.

**What he said no to.** A slider whose stops are the terms (*5 years, 7 years, 10 years*). A top slider
whose handle stayed on *Strict* while the words under it said *Custom*.

**What the mock-up draws now.** The levels are settled above. The rest is one reading of his notes, not
yet accepted:

- One slider for the whole job: *Off* (no secrecy paper), then the four levels. On a mix its handle leaves
  the named stops, sits at the mix's average, turns grey and carries a *Custom mix* tag.
- Seven topics under it, each on the same slider. The words under a slider say what that stop means.
- Three topics show *Off* greyed and read *In every paper*.
- At the top, **the flow** he asked for on 2026-11-19, as a first drawing he has not yet accepted. It has
  eleven steps in one frame of one height.
  - Step 1, *Before you start*, is his disclaimer in three plain lines: not legal advice, use it with
    your own attorney present, experimental and for trial purposes only. A box, *I have read this.*, must
    be ticked before any later step opens.
  - Step 2, *The basis*, is the level the job's paper should express.
  - Step 3, *Match the paper to the site*, is his note on real site conditions, with what the chosen
    basis asks of the site.
  - Steps 4 to 10 are one page a topic, in the order of the seven topics. Each has *The core clause* as
    grey bars, *What puts a person in breach* in plain lines with *New at* marks, *What the site must
    have* where the level asks something of the site, and the topic's slider at the bottom. The page
    changes while the handle is dragged. A page moved off the basis says so and offers *Back to* it.
  - Step 11 is *Review*, with *Change* on each topic and the office's confirm.
- Under the flow, **the grid**: seven topics by four levels on one page, each box with its rule, what
  puts a person in breach and what the site must have, all placeholders for him to correct. A list under
  it names what is the same in every paper today, with the session's suggestion of what could move with
  the level: what counts as secret, and what happens after a breach.
- Under the grid, the settled levels on the whole-job slider, with each level's place under it.
- On the office's page, *Set it step by step* opens the flow.

**Why the places are these.** A place is strict in two ways: how hard it is to get on site, and how much
its paper asks. A government building and a military base are strict the first way, by law and by the
gate, and much about a public job is public record. A private research lab is strict the second way,
because the paper is all it has. So the lab is on top for a secrecy paper, and the page should say why,
since many readers will guess the base. On a real base or lab the GC's own form is the likely paper, and
the builder steps aside for it.

**The calls to make at the review:**

| Call | The choices | The session's pick |
|---|---|---|
| How a custom mix shows on the top slider | The handle between stops with a tag; a sixth stop named *Custom*; the slider greyed with a *Custom* chip beside it | The handle between stops with a tag |
| Which topics get a slider | Photos and video, phones and devices, getting on site, talking on site, how long, files at the end, reporting a leak. More, fewer or other names. | These seven |
| Which topics can be *Off* | All of them, or only those a secrecy paper can do without | Only the first four. A paper with no term, no return of files and no duty to report is not one an attorney is likely to approve. |
| What each level means on each topic | The terms under each stop | The mock-up's are placeholders for him and counsel to set. Two neighbouring levels may share a wording. |
| The GC's page | The same sliders with looser stops greyed, or a plain list with a *Propose* press | The same sliders |
| Sliders as the choices | He said he hoped for "other options as choices". Not yet answered by any drawing. | Ask him, with two or three drawn side by side |
| The flow and the one-page list | The flow replaces the office's list of seven sliders, or both stay and the list is the quick way | Both. The flow for a first setting, the list for a change. |
| Who walks the flow | The office only, or the GC too from their page | The office first. A GC's walk ends in a proposal, never a setting. |
| What a breach line is | Plain words kept beside each wording in the Contract Book and approved with it, or written by hand for a job | Kept beside each wording, so a page never says more than its clause |
| The tick on the disclaimer | A box that must be ticked before the flow opens, as drawn, or the words alone | The box, and the build keeps who ticked it and when |
| Where else the disclaimer shows | The flow only, or also the GC's page before *Propose a stricter setting* | Both. He said *requests made via this tool*, and a GC's proposal is one. |
| How the site note ends | His sentence stops at the badging and gates. The mock-up finishes it: *A rule nobody enforces protects nothing. It also puts people in breach of a rule they cannot follow.* | His to confirm or reword |
| What the site must have | A line for each level of a topic, kept beside its wording like a breach line, or the one page alone | A line for each level, so the warning sits where the choice is made |
| A custom mix, once there is a basis | *Custom mix: 1 Aggressive, 6 Standard*, as drawn, or *Standard, 1 page off it* | The second. The basis is the level he picked, and it would answer the custom-mix call above. |

## Open: the picks the build stands on

Not yet answered. The build can start on them, and each can be flipped.

| Call | The session's pick | Why |
|---|---|---|
| How the GC gets in | The private link they already have, no login | No outsider has a login today |
| How strictness is named | A level name and no score | A number reads as a legal grade nobody can stand behind |
| Where the protected party is named | In the paper | A person should see who can enforce against them before they sign |
| A change after signing starts | Allowed, as a new revision, with the count who sign again | Upstream rules do change mid-job |
| The GC's confirm | Kept as a record, with name, time and settings | It turns *was the flow-down enough?* from a guess into a record |
| Who the builder serves | Only people who work through the company | Making papers for a GC's other subs makes the company a supplier of legal documents |
| Real jobs before an attorney's read | No. ZZ Test jobs and made-up clauses only | The paper is only as sound as its approved wording |

## What exists today

Read in the code on 2026-11-17, and again on 2026-11-19 with prod read through the dev seat.

- **Clause papers.** A Contract Book entry can be built from clauses
  (`supabase/migrations/20261012150000_contract_clauses.sql`, `src/lib/contracts/assemble.ts`,
  `supabase/functions/_shared/clausePaper.ts`). `contract_clauses` holds each clause with its own version.
  Every change goes through `edit_clause` and bumps the entry's `revision`.
  `contract_paper_clauses(p_paper_id, p_trades, p_lang)` is the database's assembly, and `assemblePaper`
  is its TypeScript twin, used only by the Book's preview (`ClausePreviewWindow.tsx`). Clauses are
  edited in Settings (`src/components/settings/SettingsClausesTab.tsx` and `src/components/contracts/`).
- **No clause paper has run on prod.** On 2026-11-19 `contract_clauses` held no row, all 18 Book entries
  read `revision = 0`, and no signed copy carried a `paper_revision`. Step 1 is the engine's first real use.
- **A clause was kept or dropped by trade only.** There was no slot, no condition and no blank in clause
  text, and nothing picked one wording out of several. Step 1 added all three (v2.8014): a clause has a
  place (`slot`), an *Only when* (`when_opts`) and a `{key}` blank.
- **Signing.** `accept-contract` re-reads the paper, refuses with `paper_changed` when the revision
  moved, and writes `paper_revision` and `clause_versions` (the whole paper as JSON) on the copy. A
  trigger blocks any later change. No hash is kept, and a clause paper makes no PDF.
- **A trap.** `clausePaperFor` answers null for a paper that is not built from clauses, and the accept
  then signs the body. A settings paper asked for with no settings must never fall through that door.
  Step 1 shut it: such a paper is refused with `SETTINGS_PAPER_BARE` (`_shared/clausePaper.ts`).
- **The gate, papers before a job opens.** All seven of its steps are on `main` and live (v2.7641 to
  v2.7726): the ground (`job_required_papers`, `job_papers_require`, `job_paper_start`), the office's
  section (`src/components/jobs/JobDocumentsRequiredPapers.tsx`), the prompt, the lock in the database,
  the lists, the page of a sub with no login, and the lines on Documents → Agreements.
  `job_papers_require` refused an entry with no body, form or link, so a clause-built entry was refused
  on that day. Since step 3 (v2.8145) it takes a paper built from settings with its picks. No job on
  prod required a paper on 2026-11-19.
- **The GC's door is the customer portal** (`supabase/functions/customer-portal/index.ts`, a link whose
  audience is `gc` or `all`, jobs by `jobs_ledger.gc_customer_id`). A GC sees bills, waivers, test
  reports, contracts and the stage plan. A GC's presses go through `submit-portal-request` as kinds. No
  outsider has a login, and no outsider sets anything.
- **A naming trap.** GC mode, `gc_companies` and a GC company paper are about the company's trade
  partners when it is the GC. A GC who hires the company is a `customers` row.
- **A sub's business is not a record.** `people` has no business column. Listing each sub business
  needs one line on the signature, *Signing for*. Card #403 has since put that line on a paper
  (`person_contract_documents.signing_for`, v2.7977 and v2.7986), kept at the send. Filling it from
  a sub's own company is #403's step 5, not built.
- **PDFs.** Edge functions already draw PDFs with pdf-lib (`accept-contract`, `sign-job-contract`). The
  client prints through `src/lib/printRoot.ts`.

## The design under any look

The look is open. The engine is the same whichever look wins, because every drawing so far is a control
over one ordered list of choices.

1. **The settings list is data on the Book entry**: `contract_template_documents.settings_def jsonb`,
   null on every ordinary paper. It names each setting, its choices from loosest to strictest, the plain
   words each choice says in the summary, the fields a clause may use as blanks, and the named levels.
   A second kind of paper is then a new entry, not new code.
2. **A clause gains two things**: `slot` and `when_opts`, the choice that puts it in the paper. A clause
   is kept when `when_opts IS NULL OR when_opts <@ settings`. A clause's text can hold a `{key}` blank
   from the entry's fields, so a number is one clause with a blank and not three clauses.
3. **Loosest first.** A choice's place in its list is its strictness. That one order drives the level,
   the greyed stops on the GC's page and the rule that a GC only tightens.
4. **What stops a paper going**, in words for the office: a choice with no live clause, two live clauses
   for one choice, a blank with no value, and a settings paper asked for with no settings. The check is
   on use, not on publish, because wordings go in one clause at a time.
5. **One assembly, two twins.** `assemblePaper` and `contract_paper_clauses` both take the settings and
   the fields. A new parameter is a new function, so the old signatures are dropped in the same
   migration. An SQL bed runs the kernel's cases through the SQL so the preview and the sign page cannot
   drift.
6. **An attorney's read belongs to a revision.** A dev or the controller marks a revision as read, with
   the attorney's name and the date. A clause edit moves the revision on. A job that is not a ZZ Test job
   can only require the read revision.
7. **The job's settings ride on the gate's row**: columns on `job_required_papers`, read by
   `clausePaperFor`, and frozen into `clause_versions` with a SHA-256 of the words. The existing trigger
   guards them.
8. **The GC's part** is a Secrecy block in the customer portal's payload. A proposal is a new
   `submit-portal-request` kind that writes nothing to the paper. It lands as a Needs you row and as asks
   on the office's page. The sample is a PDF drawn by an edge function from the same assembly.

## The train

Each step is one PR with its release note and fragment, and is usable by itself. Nothing changes for any
paper until an entry has a settings list, and the first one is a test entry.

0. **The clause table, no code.** The secrecy draft cut into its sections, each marked fixed, picked by
   a setting, or filled with a blank. It lives beside the draft, outside the repo. It is the brief to the
   attorney and the script for entering test clauses.
1. **The Book takes settings (M). Built, v2.8014 and v2.8019.** The migration (the settings list, the read mark, `slot` and
   `when_opts`, the two functions with their new parameters). The kernel `paperSettings.ts` with tests.
   `assemble.ts` and `clausePaper.ts`, with the refusal for a settings paper asked for bare. The clause
   window's *Only when* line, the clauses listed by what puts them in the paper, a *Settings list*
   window, the preview with its settings, and a clause's own line breaks kept (`ClausePaper.tsx` had no
   `white-space: pre-line` before it). It waited on nothing.
2. **The summary, the level and the sample (S). Built, v2.8020.** The kernel `paperSummary.ts`. *Summary* beside *Paper*
   in the preview, and *Print the sample* through `printRoot.ts`.
3. **Settings on the job, the ground (M). Built, v2.8145, v2.8154 and v2.8156.** The columns on
   `job_required_papers`, `job_papers_require` accepting a clause-built entry with settings, a function
   that sets them and locks at the first signature (`job_paper_set_settings`), the read-revision rule,
   the freeze with the hash, and the signature's *Signing for* line. Card #403 built that line's column
   and keeps it at the send (v2.7977, v2.7986), so it needed nothing here. Its step 5, not built, fills
   it from a sub's own company. One pick was taken from *Open: the picks the build stands on*: a change
   after signing starts makes a new revision that everyone signs again, and it may only tighten. A
   looser paper is taken off the job and required again. No screen sets a job's settings yet: the
   job's **Add a paper** list shows such a paper and holds it.
4. **The office's settings page (M).** The step-by-step flow lands here, reused from the Document
   builder tab ([#404](../document-builder/README.md)), where it is parked first. Inside
   `JobDocumentsRequiredPapers`. This is the first screen the open look decides.
5. **The GC's page, read-only (M).** The Secrecy block, the sample PDF function, the sub businesses.
6. **The GC proposes (M).** The proposal kind, stricter-only checked on the server, the office's take
   and confirm, the record of who and when.
7. **Their own form (S).** *Theirs* points at a Form Studio form the gate already accepts.
8. **A second kind of paper (M).** The company's own secrecy paper to a vendor, partner or customer. It
   is one-way or mutual, tied to a relationship and not a job, and needs its own approved clause set.

Steps 1 and 2 touched only the Contract Book and are built. Step 3 is the ground under a job and is
built too, since it could start before the look was settled. Step 4 cannot.

## Points for an attorney

These are the builder's own questions, apart from the draft's wording.

1. The company hands a GC a paper its app assembled, and a summary. May the GC rely on either, and what
   must the page say?
2. A setting names the party who may enforce against the signer. Is that plain enough in each signed
   copy, and does it hold when the party is named only after signing?
3. A signer is bound to settings someone else chose. Is it enough that every setting is in the words
   they read? Is the fence around the typed box sound?
4. Wordings are approved one at a time and signed in combination. Which pairs must be barred?
5. A GC's press on a private link is kept as acceptance. Can it bind the GC or serve as evidence?
6. The company tells the GC who has signed. What is the exposure if that is wrong, and may workers'
   names go to a GC?
7. Settings change mid-job and people sign again. What supports the new promise, and which revision
   governs in between?
8. Is the frozen record the right evidence, and should a signer get a PDF copy?
9. Must each wording's Spanish twin be approved, and which language governs?
10. The plain-words summary is not the contract. Is one line saying so enough?
11. A topic set to *Off* leaves a clause out. Which topics may ever be left out?
12. Each level says the kind of place it is aligned with. Does *aligned with military bases and defense
    plants* promise a GC or a signer that the paper meets those places' own rules, and must the page say
    the site's own rules still govern?
13. The flow opens on a disclaimer: not legal advice, use it with your own attorney present, experimental.
    What must it say, and does a tick make it hold?
14. A job's paper can ask for more than the site enforces, such as badges with nobody to check them. What
    does a rule nobody enforces do to the rest of the paper?

## What to know before building

- Start every replaced function from its newest definition, and check again on the day.
- The migration is safe under the old edge functions: they pass three names and get the defaults.
- `check:calls-ahead` will label step 1 *push right after the merge*.
- The frozen JSON grows. The readers must still read copies signed before this.
- Anyone can send a Book entry to a person from the Contract library today. Step 1's refusal is what
  stops a settings paper signing bare.
- A choice's plain words and a fact's label each have a Spanish field. An empty one shows the English.

## How to verify

- **Step 1.** The kernel's tests and the SQL bed. On prod as a dev: a ZZ test entry with four made-up
  clauses, two tied to the two choices of one setting and one with a blank. The preview swaps the
  wording as the setting changes, fills the blank, and names a missing wording in words. A copy sent to
  a sample person with no settings is refused.
- **Step 2.** The summary follows the settings. The print is a clean page set with SAMPLE across it,
  measured at 96 dpi.
- **Step 3.** The bed, as each role. A ZZ Test job requires the entry with settings, a sample helper
  signs, the signed record shows the settings, and a later clause edit leaves the signed words as they
  were.
- **Steps 5 and 6.** A `gc` link for the ZZ Test customer shows the block. The server refuses a looser
  proposal. A stricter one lands as an ask and changes nothing until the office takes it.

## The wider look: the builder, the gate and contracts on Documents

Asked 2026-11-19, in the owner's words:

> can you look at the NDA builder and how we handle contracts and let me know what things look like. We
> were building in the direction of an NDA builder where a GC could participate and having some jobs
> require NDAs be signed before the user can have access, and the ability to manage contracts from the
> documents page not just the people page (we were doing this part so eventually we could have outside
> vendors and subcontractors sign documents, and the management of that was better served through
> documents).

A read of the code and of prod through the dev seat, the same day. Nothing was built. Each line says
where it comes from: **code**, **live** or **card**. It is the picture of 2026-11-19. Where a release
since then changed a line, the line says so, as of 2026-11-20.

### The short answer

| Direction | State |
|---|---|
| An NDA builder a GC takes part in | **Drawn only** on that day. Since then the flow, typing on it and **Publish** are built in the Document builder tab, for a dev, apart from any job (#404, v2.7980 to v2.8024), and the Book takes settings (v2.8014 to v2.8020). No GC sees any of it, and the only settings paper is a ZZ test entry. |
| A job requires a paper before a person gets in | **Built and live, not yet used.** All seven steps are merged and deployed (code). No job on prod requires a paper (live). |
| Managing contracts from Documents | **The list is built and live, and the managing has begun** (#376). A waiting line has **Send again** and **Copy the signing link** (v2.7932). **Send a paper** (v2.7937) and **Contract library** (v2.7938) are on the tab. On that day it could only find and open a paper (code). |
| Outside vendors and subs signing | **Half there.** Anyone with a link signs with no login (code). On that day a vendor or a GC had no record to hold the paper (code). Since then a paper names a contact as its party and goes to a customer, a supply house or a typed name (#403, v2.7977 to v2.7998). The signer still gets no copy and no reminder. |

### How the pieces fit

| Kind of paper | Made | Sent | Signed | Kept | Listed | On prod, 2026-11-19 |
|---|---|---|---|---|---|---|
| Staff or sub paper | Contract library and Form Studio, opened from People → Contracts | People → Contracts by email, or the sub's own page. The link lasts 14 days. | `/contract/accept`, no login | On the person's row. A form keeps a PDF. A plain paper keeps its words and the signature. | People → Contracts, Documents → Agreements | 59 papers, 30 signed |
| A paper a job requires | Picked from the Contract Book on the job's Documents tab | The prompt, **Needs you**, the sub's page, or **Copy the signing link** | The same page | As a person's paper, with its job | The job's roster, Agreements | None |
| The customer's job contract or warranty | The job's Contract window | Email, link, text, in person or on paper. The link lasts 90 days. Three reminders go out by themselves. | `/contract/sign`, two signers on their side | A PDF, emailed to them and filed in the job's Drive folder (#377) | The job, the customer's portal, Agreements | 19 records, 7 signed, most filed by hand |
| A GC's own paper (#173) | Recorded on the job, not made | Not sent | Not signed in the app | A link or an upload | Agreements, the Legal desk | None |
| A sub's work order | Work Orders | The sub's page | The sub's page | On the order | Agreements | None in the list |
| GC mode's papers, when the company is the GC | GC mode, dev only | Their portal | Their portal | On the send | Agreements | None |

Agreements held 45 lines: 16 job contracts and 29 staff and sub papers (live).

### What the gate holds closed, and for whom

Read in the code (`20261118010000_job_papers_lock.sql`, `_shared/subPortalJobPapers.ts`).

- **Helpers, subs with a login, superintendents and estimators.** The database refuses the job: its row,
  notes, photos, plans, files and texts. A list shows the number and a lock. No push goes out.
- **The office and a primary.** The prompt at the job is the only lock, and nobody clocks in before
  signing. That is the owner's call 8 of 2026-11-17.
- **A sub with no login.** Their page holds back the address, the scope, the plans link and the notes.
  Money stays. The page is the lock, and it stays shut when the check fails.
- **A GC.** Not gated. No paper is asked of a GC, and a GC cannot see who has signed.
- **An outside vendor.** Has no door to a job, so there is nothing to gate.

A required paper is a Contract Book paper with words, a Form Studio form, or a Book entry with a link. A
GC's own form goes in as a Form Studio form. It cannot be a file uploaded straight onto the job. The
gate does not close a Drive folder already shared with the person, and its own notes name six list
functions that were not checked (`docs/recent-features/v2.7665.md`).

**Usable now, with no builder:** a secrecy paper with fixed words can be required on a job today. It
waits only on an attorney's read of the words. A test entry is in the Book for it.

### What Documents can and cannot do

Read in the code (`src/lib/documents/agreementsLedger.ts`, `DocumentsAgreementsTab.tsx`).

- **On Documents → Agreements:** find, filter by kind and by state, and open. Since v2.7932 to
  v2.7938 also **Send again** and **Copy the signing link** on a waiting line, **Send a paper** and
  the **Contract library**. A signed job contract opens
  its Contract window, with Share, Download, Print and its Drive line. A signed staff or sub paper opens
  its record. A work order opens its window. A GC mode line opens the GC page, not its project.
- **Only on People → Contracts:** entering a paper form, and the office's half of a two-party form.
  On that day the Contract library, Form Studio, sending and sending again were here alone too.
- **Only on the job's Contract window:** writing, sending, reminding, **Void & redo** and filing a signed
  copy.
- **Only in GC mode:** its three papers, dev only.

### Who can sign today

| Who | Can sign? | What is missing |
|---|---|---|
| Staff with a login | Yes | Nothing |
| A sub, with or without a login | Yes | No reminder by email |
| A sub's signer, a different person | Yes, the email is typed by hand | The paper is filed under the roster name, not the business or the signer |
| A customer | Yes, with a co-signer | The company never countersigns |
| A GC | Only an estimate or a bid, on that day | Since v2.7995 **Send a paper** finds a customer and the people on file there, and a GC who hires the company is a customer |
| A supply house or a vendor | Yes, since v2.7995 | On that day there was no record to send it to |

Three gaps apply to every outsider (code, `accept-contract`): the signer gets no copy by email, a plain
paper makes no PDF, and the only reminder is a Dashboard prompt an outsider never sees.

### Two faults found on the way

Both were handed to a session of their own on 2026-11-19, and both are fixed in v2.7924.

- A waiting staff or sub paper's line on Agreements opens *This document is not in signed status.*
  #376 says it opens People → Contracts on that paper. Two lines did this on prod.
- The consent record's allowed kinds lost the GC owner contract's kind
  (`20261030030000_hours_statements.sql` restated the list without it). No owner contract has been sent,
  so nothing is lost yet.

Two more lines of #376's README are behind the code: it says nothing goes to Google Drive, which #377
changed, and it says a GC line opens its project.

### What is left to build, in order

Sizes for this card's own steps are the train's above.

| # | What | Size | Waits on |
|---|---|---|---|
| 1 | The two faults above | S | **Done**, v2.7924 |
| 2 | The owner's look at #376, #377 and #173, to retire them | XS | The owner |
| 3 | A fixed secrecy paper's words read, then the gate's first real job | no code | Counsel |
| 4 | Agreements lines get presses: **Send again**, **Copy link**, **Remind**, **Void** | M | **Send again** and **Copy the signing link** are done, v2.7932. The other two are #376's to say. |
| 5 | Send a paper and open the Contract library from Documents | S to M | **Done**, v2.7937 and v2.7938 |
| 6 | Step 1 here, the Book takes settings | M | **Done**, v2.8014 and v2.8019 |
| 7 | Step 2 here, the summary and the sample | S | **Done**, v2.8020 |
| 8 | An outside party as a record, with the *Signing for* line of step 3 | Card #403's train | Its first four PRs are done, v2.7977 to v2.7998. Its steps 4 to 6 are left, and step 5 fills *signing for* from a sub's company. |
| 9 | The signer's copy by email, and a PDF of a plain paper | S to M | Nothing |
| 10 | Reminders by email for staff, sub and outside papers | S | Nothing |
| 11 | Steps 3 to 7 here | M · M · M · M · S | Step 3 is **done**, v2.8145, v2.8154 and v2.8156. The look for step 4. Counsel before a real job. |
| 12 | The company's own signature on a paper | M | Wider call 4 |
| 13 | Step 8 here, the company's own secrecy paper to a vendor or partner | M | Rows 8 and 12, and its own clause set from counsel |
| 14 | The gate's leftovers: the six unchecked list functions, the Spanish read of the sub's card | S | Nothing |

### The wider calls, the owner's to make

1. **The builder's look.** The calls in *Open: the look* above, then *Open: the picks the build stands on*.
2. **Counsel.** Who reads the wording, and whether a fixed secrecy paper goes first so the gate is used
   before the builder exists.
3. **Where an outside signer lives.** A vendor, a sub's business or a GC's contact has no record that
   holds a paper today. Card #403 lays out the options, a pick and a mock-up
   (`to-dos/outside-signer-record/README.md`). Settled there on 2026-11-19: the paper names a contact
   the app already keeps.
4. **Whether the company signs in the app.** A mutual paper needs the company's signature. Today it signs
   nowhere, save the office's half of a two-party form.
5. **Documents or both.** Settled 2026-11-19 on card #403, its call 5: both. People sends to a person on
   the roster, and Documents sends to anyone.
6. **The GC and the gate.** Whether a GC ever signs a job's paper, and what *one signature per GC* should
   mean. `docs/recent-features/v2.7726.md` names it as the owner's call 4 and its wording is not in the
   repo.
7. **Staff and sub papers in Drive.** Only job contracts are filed there. Estimators can read the jobs
   drive.

## Where it stands

**Steps 1, 2 and 3 are built.** Step 3 (v2.8145, the migration; v2.8154, the kernel, the sign path and
the signed record) put a job's settings on its required paper's row. `job_papers_require` takes a paper
built from settings with its picks and refuses it without. `job_paper_set_settings` changes them: in
place until someone signs, and after the first signature only stricter, as a new row that everyone
signs again. A job that is not a ZZ Test job takes such a paper only at the revision an attorney read.
A copy is signed only with the paper frozen on it exactly as the database reads it at that moment, and
it keeps the settings, their plain words and a SHA-256 seal of the words. The signed record draws
**The job's settings when this was signed** and says whether the seal still holds. A job with no
settings behaves as before, and the bed proves it (`supabase/tests/job_paper_settings`).

Step 3 has no screen that sets a job's settings: that is step 4, which waits on the look. Until then
a job takes such a paper only through the database's function.
The sign path's functions, `accept-contract` and `get-contract-for-signer`, were deployed on
2026-11-21 on Taunya's go, with `gc-trade-portal`. A ZZ Test paper was then signed on prod, on a ZZ
Test job: read in both languages, signed only at the seal the page showed, frozen with its settings,
locked after the signature, and drawn on the signed record.
That walk found one gap: the two functions that hand out a signing link refused a paper with no body
of its own. v2.8156 fixed it, and `send-contract-for-signature` and
`get-contract-signing-link-for-self` were deployed the same day on Taunya's go. The office's link was
then made on prod for a ZZ Test paper with no text of its own, and a plain paper with nothing to sign
was still refused. A person's own **Read and sign** was not walked on prod as its signer: no ZZ login
was signed in. Step 3 waits on no deploy.

Step 2 (v2.8020) put **Summary** beside **Paper** in the Book's preview, with
the level in words and **Print the sample**. The *Signing for*
line step 3 names is on a paper since card #403's first two PRs (v2.7977, v2.7986), and #403's step 5,
not built, fills it from a sub's own company. Step 1 (v2.8014, the migration and the kernel; v2.8019, the screens): A Book entry takes a
settings list, a clause takes an *Only when* and a place, the preview puts the paper together for any
mix, a revision can be marked as read by an attorney, and a paper built from settings was refused
everywhere a copy could be made or signed until a job carried its settings. The clause screens are
`SettingsClausesTab.tsx` and `src/components/contracts/`, not `SettingsContractsTab.tsx` as *What exists
today* says. No clause wording was written, and the only settings paper is a ZZ test entry.

Nothing of the builder had shipped when the look was reviewed. The owner settled four calls on
2026-11-17 and liked the idea. He
liked sliders and did not love either drawing of them, so the look was the first thing to review. That
review began on 2026-11-19 and settled the four levels, their names, their places and how a place is
said. He then asked for the step-by-step flow, saw it drawn, and said "I think this is coming together
to the point we can build it as a spike and then refine from there". A spike of the flow in the app
was built the same day in its own session: real code on made-up data, dev-only, shipped nowhere. It
is on the branch `spike/document-builder`.

The same day he decided where the builder lives for now: a **Document builder** tab on Documents, for
a dev only, apart from any job. That is its own card, [#404](../document-builder/README.md), with the
flow as he shaped it in the spike, a second builder for a job's insurance requirements, and a train of
ten steps. **#404 is built first**, and six of its ten steps are on `main` since 2026-11-20: the tab,
the flow in it, typing on the flow and **Publish**, for a dev. Its link, its send to a GC and a GC's
picks are not built. This card's own train, which ends with a job requiring the paper
its settings make, comes after it and is untouched by it. **Nothing joins the two yet.** The tab's
builder keeps its levels and topics in `document_builders`. The Book keeps a settings list on its
entry (`settings_def`). No file of either names the other, and step 4 is where they meet. Where this card's mock-up and the spike differ
on the flow, the spike is newer.

The grid of seven topics by four levels is drawn in this card's mock-up. Every line in it is one
session's placeholder, and the owner has not yet read it box by box. That read comes before any wording
goes to an attorney. Where the grid and the spike's own contents differ, the spike is newer.

He also asked whether this should become a contract builder long term. The session's answer: yes as a
direction, since a paper's settings are data, and a call to make once a second paper works. #404's
second builder has since shown one limit: a job's insurance requirements did not fit levels and topics,
so that tab holds two kinds of builder.

The calls in *Open: the look* are what is left of the review. After that come the picks the build stands
on, then step 4. The gate under it is live and unused, and *The wider look* orders what is left around
it.
