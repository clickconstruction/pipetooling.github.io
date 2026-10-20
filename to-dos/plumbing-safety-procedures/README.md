---
name: "The employer's plumbing safety procedures: the paper and where it lives"
number: 121
group: gated
status: DRAFTED 2026-10-18 — the paper is written from the OSHA 30 refresher and Intro to plumbing and sits beside this file for the owner's read; the owner's three calls were asked and the defaults taken (a placeholder for the company name and the safety lead, read-only reference first with the signing flow as a later PR, English only); nothing in the app changes until the owner has read it
summary: >
  The courses teach the worker. The OSHA 30 refresher says the employer owes a written program,
  a hazard assessment, the permits and the training, and nothing of that was written down. This
  paper is the employer's plumbing safety procedures, seventeen numbered procedures from the
  stop-work right to the training required. Every procedure has who, when, what, the stop-work
  line, where the rule comes from and what the owner must confirm. The owner, a master plumber,
  reads it for correctness. The plan puts it in the app as a help guide and a line on the
  Training card first, a private phone list beside it, and a signing flow through Contract Forms
  when the owner wants every crew member to sign. The electrical procedures are their own set,
  #122, with their own reader.
next: The owner reads the paper, corrects it in place, closes every Confirm line and names the safety lead and the competent persons. Then PR 1 puts it in the app.
size: S for PR 1 (one guide and one line on the card); M for the signing flow; S for the Spanish copy
blocker: The owner's read. Nothing else, because plumbing is the company's trade and the owner is the reader.
opinion: build PR 1 as soon as the owner has read the paper; the guide is a mechanism that exists, the card line is one row, and the crew should be able to open the rule a lesson cites the day the lesson goes On
mockup: not required — the paper beside this file is the thing to read; PR 1 draws it on the real help page as a dev preview
---

# The employer's plumbing safety procedures (#121)

The Training system holds three courses: the OSHA 30 refresher (#111, #116), Intro to plumbing
(#119) and Intro to electrical (#120). The courses teach the worker. The refresher's lessons 1,
3 and 28 say the employer owes a written program, a hazard assessment and the training. Lesson 2
says the permits are the employer's. Lesson 20 says the rescue plan is the employer's. None of
that was written down anywhere. The owner, a master plumber, asked: "could you help me make the
employer's plumbing safety procedures and electrical safety procedures?" The owner then said the
two are separate sets with separate readers, so this folder is the plumbing set and
`to-dos/electrical-safety-procedures/` (#122) is the electrical set. They share the house voice
and the three owner questions, asked once, and nothing else.

This folder holds the paper and the plan for where it lives.

- [`PLUMBING_SAFETY_PROCEDURES.md`](./PLUMBING_SAFETY_PROCEDURES.md): seventeen procedures.

## The owner's three calls (asked 2026-10-18, the defaults taken)

1. **The company name and the safety role.** Placeholders. The paper reads *[Company name]* and
   *[Safety lead]* until the owner fills them in. The competent person for trenching and the
   person who signs are both *the safety lead* in the draft, and procedure 2 says one person may
   hold both roles.
2. **Signed or read-only.** Read-only reference first. PR 1 makes the paper a help guide and adds
   a line to the Training card. The signing flow through Contract Forms is PR 2, built only if the
   owner says every crew member signs.
3. **Spanish.** English only now. The Spanish copy is PR 3 and follows the courses' own Spanish
   switch, which #119 deferred.

## Who reads it for correctness

The owner. Plumbing is the company's trade and the owner holds the licence, so the owner's read
is the gate and nobody else's name goes on the paper. Every Confirm line in the paper is the
owner's. A number the owner changes is changed in the paper first and in the lesson second, in
the same week.

## What the paper is

The paper is the employer's side of what the OSHA 30 refresher and Intro to plumbing teach.
Every procedure has the same six parts, so a crew member can find the one line they need:

- **Who** does it.
- **When** it is done.
- **What** the numbered steps are.
- **Stop work when**, the one line that ends the work.
- **Where it comes from**, the OSHA rule and the lesson behind it, cited the way the courses cite
  them.
- **Confirm**, what the owner must check before the paper is handed out.

Every number came from a lesson, and the lesson's `from:` line says where the lesson got it.
Nothing in the paper is a number the courses do not hold, so the owner's read checks facts the
course already holds.

The paper is written in the house voice (`src/lib/plainWords.ts`: one idea per sentence, none
over 20 words, no dashes, semicolons or parentheses inside a sentence). A scratch check ran the
guide test's own functions over the file and found nothing, so it will pass
`helpGuidePlainWords.test.ts` unchanged when PR 1 turns it into a guide. The OSHA citations drop
the paragraph letters for that reason: `1926.404(b)(1)` reads `1926.404`, and the lesson named
beside it carries the rest.

## Where each employer's duty in a lesson is written down

| The lesson says | The procedure |
|---|---|
| OSHA 1, 3: the employer owes a workplace free of hazards, training and PPE at no cost, and any worker can stop work | 1 and 2 |
| OSHA 2, 5: the daily JHA, the permits, inspect before use, report at once | 3, 5, 7, 15 |
| OSHA 19, 20, 30: the 5 ft and 20 ft rules, the way out within 25 ft, the daily inspection, 811, the rescue plan | 4 |
| OSHA 13, 26: the attendant, the air test, the rescue order, never enter to rescue | 5 |
| OSHA 7, 8, 17, 18: 6 ft, the ladder angle, three points of contact | 6 |
| OSHA 25: the permit, the fire watch for 30 minutes, 35 ft | 7 |
| OSHA 16: wet methods, Table 1, presume asbestos before 1980 | 8 |
| OSHA 9, 23 and Intro to electrical 22: every cord on a job runs through a GFCI | 9 |
| OSHA 21, 27: 50 lb, the lifting zone, a break every hour | 10 |
| OSHA 24: inspect the truck, the spotter, nobody drives an injured worker | 11 |
| OSHA 15: the heat stages, acclimatization, hypothermia | 12 |
| OSHA 14 and Intro to plumbing 8: the SDS for every chemical, the label, never mix drain chemicals, primer and cement | 13 |
| OSHA 12, 13: the employer picks and pays for PPE | 14 |
| OSHA 1, 3, 29: the 8 and 24 hour calls, the 300 log, no retaliation | 15 |
| The policy in Settings → Training | 16 |

When a lesson gains a new employer's duty, it gets a row here and a step in the procedure, in
the same PR. When a procedure changes, the lessons in its row change with it. That is the whole
mechanism for keeping the paper in step with its two courses, and the Amend, don't add rule in
`CLAUDE.md` is what enforces it. Procedure 9 cites one Intro to electrical lesson for the GFCI
on a cord; the rule itself is the electrical set's procedure 4, and the two say the same thing.

## Where the paper lives in the app

The default taken: read-only reference first.

**The help guide.** The paper becomes one guide under `src/content/help/`, category Field Work,
`roles: all`, with a title that completes "How do I…": `follow the company's plumbing safety
procedures`. The guide's body is the paper as it stands, the `##` headings its procedures, so a
lesson can one day link `/help/<slug>#4-trenching-and-excavation` to the one procedure it cites.
The guide is held by `helpGuideContent.test.ts`, `helpGuidePlainWords.test.ts`,
`helpGuideLinks.guides.test.ts` and `helpShareCard.guides.test.ts` from its first commit, and the
build draws a share card at `/g/<slug>/`.

**What the guide must not hold.** The repo and the `/g/` pages are public. So the guide carries
the company name and the roles, and never a person's name or a phone number. The *Who to call*
list at the top of the paper and the safety lead's name go in a **private company document**
instead: Documents → Company, the list the guide *find the current company documents* describes,
where a dev adds *Safety roles and phone list* as one link to a one-page PDF the owner keeps. The
guide's *Who to call* section says *the numbers are on Documents → Company* and names 911, 811,
988 and poison control, which are public.

**The Training card.** `DashboardTrainingSection.tsx` gains one line under the courses: *The
company's safety procedures*, with this guide as a link, and the electrical guide beside it when
#122 lands. A worker who reads a lesson that cites a duty can open the rule from the same card.
In Job Mode the card sits under My Schedule, so the line reaches the truck.

**The courses.** Nothing in a lesson changes in PR 1. The lesson files do not carry links today,
and adding a link to a lesson is a change to the parser and its test that this plan does not
need. If the owner wants the rule one tap from the lesson, that is a later PR on the course page.

**Not drawn, on purpose.** A page of its own at `/safety`. The help page already exists, is
searchable, prints and shares, and `docs/twins/APP_DIRECTORY.md` would gain a route for nothing.

## The PR train

0. **This PR.** The plan and the paper. No version claimed, nothing in the app changes.
1. **Read-only reference (S).** After the owner's read: the guide from the corrected paper, the
   one line on the Training card, the release note and the `docs/recent-features/` fragment,
   `GLOSSARY.md`'s Training entry gains a clause naming the procedures, the guide *take a training
   course* gains one sentence pointing at them. A dev adds the private *Safety roles and phone
   list* document through the Documents → Company manager, with no code. Shot on the real help
   page at phone width in both themes, as the courses were. If #122's PR 1 is built the same
   week, the card line ships once and names both guides.
2. **Signing (M), only if the owner says every crew member signs.** The Contract Forms path, the
   way the W-9, the I-9 and the Direct Deposit Authorization went (`docs/CONTRACT_FORMS.md`,
   `docs/CONTRACT_FORMS_PLAN.md`). `npm run forms:author` draws the paper as a PDF with a name, a
   signature and a date box on the last page, the way `scripts/forms/author/directDeposit.ts`
   draws its form. The Form Studio publishes it into the **All Teammates** packet, the I-9's
   packet, as a Book entry with a paperwork type of its own, so the compliance pill, the dashboard
   prompt, *Sign now* and the staff record all work with nothing new. The owner picks which roles
   must sign. A new revision goes in through Replace PDF… and the owner says whether everyone
   signs again. The signed copy is the flattened PDF in the private bucket, opened through the
   gated door. This PR also updates `ACCESS_CONTROL.md` if a role is added to the packet.
3. **Spanish (S).** The Spanish copy of the guide when the courses get their Spanish switch, and
   `labelEs` on the form boxes if PR 2 was built. Not before the English paper has been through a
   crew.

## How to verify

- **This PR.** `npm run check:todos` passes and assigns #121. The scratch plain-words check over
  the paper reads zero failures. The paper is read on GitHub in this folder, or in the app once
  PR 1 lands.
- **PR 1.** The four guide tests pass. On a dev login at phone width, the Training card shows the
  line, the guide opens from it, every `##` anchor resolves, and the share card at `/g/<slug>/`
  reads the title and the first paragraph. The *Who to call* section names no person and no
  phone number.
- **PR 2.** The test sub's path for the W-9: the paper appears in the test teammate's packet, is
  signed from the phone, the flattened PDF opens from the staff record through the gated door, and
  the compliance pill reads it present.

## Open with the owner (the Confirm lines, gathered)

The paper's Confirm lines are the list. The ones that change what a crew does, in one place:

- **Names.** The company name on the paper. The safety lead. The competent persons for trenching
  and where their training record lives. The safety lead's phone and the office line.
- **Crawl spaces.** The draft treats every crawl space as permit-required until the air is tested.
- **The water heater lift.** The draft makes it a two-person lift or a dolly, every time.
- **Phones while driving.** The draft says no phone use at all, hands-free included.
- **Pay for stopped hours.** The draft says a stop-work is paid.
- **The 300 log.** Whether the company is over ten employees.
- **Where the daily review and the incident report are written.** The draft says the job's report
  in the app for both.
- **The respirator and silica programs.** The draft says the safety lead keeps both and names who
  is fit tested.
- **The PPE table.** A draft of what a plumbing truck carries, for the owner who knows the trucks.
