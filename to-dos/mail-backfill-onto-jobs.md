---
name: "Messages: file the mail we already have onto its jobs, for the record"
number: 332
group: gated
status: approved 2026-11-13 ("Yes, build and count") · the rule, the runner and the runbook built · the read-only count run · nothing filed
summary: >
  The office's mail about a job sits in thirteen separate mailboxes. Punch list #324 made it safe to
  file old mail onto a job: it lands at its own date and asks nobody for a reply. This card is the
  run that does it for the jobs we have. A script walks the mailboxes through the dev seat's own
  verbs, matches each conversation to a job by rule, and files only the ones a rule is sure of.
  The rest go on a sheet for a person to place or leave. Measured 2026-11-13: 120 open jobs, of
  which about a quarter match by the customer's address alone, and a single-job customer holds 4
  to 13 conversations. The hard part is not the cost. It is picking the right job for a customer
  who has several, and keeping private mail out.
next: Grace's calls, three of them new from the count (11 to 13). The office names the never-tag list. Then the customer's contact first, and the pilot on one job.
size: M; left: the contact step and the held sheet's workflow (S · S), then the runs
blocker: The never-tag list, which only the office can name, and call 11: a rule alone files 93 of 5,451.
ver: v2.7084
opinion: build, but the count changed the shape — a rule is sure of 1 conversation in 60, so the held mail is the real work and needs its own answer before a wide run
mockup: not required — a data run through the dev seat; no screen changes
---

# Messages: file the mail we already have onto its jobs, for the record

## The ask, in Grace's words (2026-11-13)

> Now that this is live, do you think it would be a good idea even though it's expensive to search through all our users' mailboxes and pull in the mail related to jobs that we currently have open or are passed to create a record? I don't think this is unreasonable.

And after the answer: *I wanna do it, let's come up with a clear plan to do it.*

## The plan, short

1. **Count first, file nothing.** One read-only pass says how many conversations each open job would take, from which mailboxes, and how sure the match is.
2. **File only what a rule is sure of.** Every mail is filed for the record (`for_record`), so nothing opens on Follow up.
3. **A person places the rest.** A customer with several jobs goes on a sheet. Nobody guesses.
4. **Keep private mail out by rule,** and report what was held back.
5. **Go in stages:** one job, then the open jobs, then past jobs with money or a lien at stake. Decide on the rest after that.
6. **Every filing can be taken back.** The run keeps a ledger, and the seat can untag what the seat tagged.

## What was measured (2026-11-13, read-only, counts only)

Read through the dev seat. No name, address or subject was kept.

| | |
|---|---|
| Mailboxes the seat can search | 13, of which 2 refused the read on the day |
| Open jobs (waiting, working, ready to bill, billed) | **120** |
| Paid jobs | over 200 (the read caps at 200) |
| Open jobs with a name and a street address | 120 |
| Open jobs with a number the app shows | 75 |
| Open jobs with a customer | 105. 15 have none. |
| Customers who hold those jobs | 55 |
| Customers with exactly one open job | 40, and 31 of them have an email address on file |
| Customers with several open jobs | 15, holding **65** of the open jobs |
| Open jobs with an outside address tied to them in Messages | **8** |
| One search of every mailbox | 2 to 4 seconds |

Three customers with one job each were searched by their address:

| Customer | Conversations | Mailboxes | Mails naming the job's street | Subjects naming its number |
|---|---|---|---|---|
| A | 4 | 3 | 0 of 4 | 0 |
| B | 4 | 3 | 0 of 5 | 0 |
| C | 13 | 4 | 28 of 50 | 3 |

What this says:

- **The run is small.** A job holds a handful to a dozen conversations. The open jobs are hundreds of conversations, not tens of thousands. It is hours of machine time.
- **The app does not know who is on a job.** Only 8 of 120 open jobs have an outside address tied to them in Messages. The match has to come from the customer's record and from the mail's own words.
- **A number in the subject is rare.** The street is the better sign when a customer writes about a property. Gmail's search reads the body, so a street can be searched for.
- **More than half the open jobs cannot be matched by address alone.** 65 jobs belong to customers with several. The address finds the customer. It does not find the job.

## What the code already gives us (read on main, 2026-11-13)

- **The seat's verbs.** `search_mail` reads every mailbox, read-only. `plan_mail_tag` says what a tag would do, mail by mail, and writes nothing. `apply_mail_tag` runs it once, only when the conversation still reads as the plan saw it. `plan_mail_untag` and `apply_mail_untag` take back a tag the seat made.
- **`for_record: true`** (v2.7032) files every mail of a tag whatever its age. Nothing opens on Follow up, nothing reaches New or the badge.
- **No double lines.** A mail a company inbox or another person's tag already holds is tied to the job, never written twice. Two teammates on one conversation make one set of lines.
- **The mailbox's owner is told** (v2.7068). One in-app notice a batch says who saved how many conversations to which job. Nothing is pushed or emailed.
- **A person's left-out labels are honoured.** Drafts, Spam, Trash and chats are never written.
- **Later mail follows by itself** for people whose My email switch is on.

And four things the code does not do, which the plan has to cover:

1. **The seat does not check a person's My email switch.** A person's own press does (`my_mail_on`). The seat's door only asks for a current login.
2. **An archived login's mailbox cannot be filed onto a job.** The seat refuses it. Mail that only a departed teammate holds stays out.
3. **A customer's address with no contact becomes an unnamed sender.** `email_place_address` looks for a contact holding the address and makes an `unknown` one when there is none. It does not look at the customer's record. Filed mail keeps such a sender out of New, but they would still pile up in *Everyone we have talked with*.
4. **A tag needs a job.** There is no way to file a conversation on a customer with no job named.

## The matching rule

Each conversation gets one of three answers, with the reason kept beside it.

**Sure. The run files it.**

- The subject or the words name the job's number as the app shows it.
- The words name the job's street, number and street name together, and the other party is the job's customer, its GC or a person at either.
- The other party is the job's customer or a person at it, the customer has exactly one job whose dates cover the mail, and nothing in the mail names another job's street.

**Held. A person places it.**

- The other party is a customer with several jobs and the mail names none of them.
- The mail names two jobs.
- The street matches and the other party is nobody the job knows.

**Left out. Counted and never filed.**

- Nobody outside the company is on the conversation.
- An address or a domain on the never-tag list is on it.
- The conversation is already on a job, or on a person's HR file.
- It sits under a label its owner leaves out, or in Gmail's promotions, social or forums.
- The mail is older than the job by more than the date fence.

A conversation one mailbox files and another mailbox also holds is planned once for each. The second plan shows ties, not new lines.

## The guards

- **Always for the record.** Every tag carries `for_record: true`, even for mail from last week. A backfill is a record. It must never ask the office to answer anything.
- **A never-tag list.** Addresses and domains that are never filed whatever they say: the company's attorneys, its accountant, payroll, the bank, insurers, and anything the office adds. The office names it. The run refuses to start without one.
- **People only by their own switch.** The run skips a mailbox whose owner has turned My email off, though the seat would allow it.
- **The customer's contact first.** Before a job's mail is filed, its customer and the people at it get their named contact, the way the app makes one when their thread is opened. Then the mail lands on a named thread and no unnamed sender is made for someone we know. How this is called is the first thing PR 2 settles.
- **Caps and pauses.** A run files at most a set number of conversations, pauses between calls, and stops at the first refusal it does not expect. It runs outside office hours.
- **A ledger.** Every plan and every filing is written to a file outside the repo, with the mailbox, the conversation, the job, the rule that matched and the counts. The seat's own call log holds the same on the server.
- **Undo.** The run's `undo` takes back any job's filings, or all of them, through the seat's untag. A line the office has since written a promise or a highlight on is held back by the untag, as it always is.
- **No real name in the repo.** The sheets and the ledger live outside it. The repo is public.

## The engine

**A script over the seat's verbs, not a session reading mail one by one.** It searches, applies the rule, plans, and writes a sheet. A person approves a job's sheet. It applies only approved plans. It costs no tokens, gives the same answer twice, picks up where it stopped, and adds no server code. A Claude session doing each conversation by hand would cost far more and could not be re-run to check itself.

The rule is a pure kernel with tests, as the house way has it. The runner is a script in `scripts/`. Neither changes the app.

## The stages

Each stage ends with a number a person reads before the next begins.

0. **Count.** Every open job, read-only. Out comes a sheet: for each job, conversations that are sure, held and left out, by mailbox and by year, and how many files they carry. Nothing is planned or filed.
1. **One job.** A job the office picks, with a customer who has only that job. Plan it, read the sheet, file it. Someone who knows the job opens its Activity and says whether it reads right. Check New and the badge did not move.
2. **The open jobs, sure matches only.** In batches of a few jobs, each sheet approved before it is filed.
3. **The held conversations.** A person works the sheet customer by customer and names the job, or leaves the conversation out. The run files what was named.
4. **Past jobs that matter.** Paid or closed jobs with money still owed, a lien, or a dispute. The same stages in small.
5. **The rest.** Decide after stage 4, from how accurate the earlier stages proved and what the storage cost was.

## The calls

| # | Call | My pick |
|---|---|---|
| 1 | Where to start | **The 120 open jobs.** Past jobs with money or a lien at stake next. |
| 2 | Whose mailboxes | **Current office logins whose My email switch is on.** Skip a switched-off one. |
| 3 | The never-tag list | **The office names it.** I seed it with the attorneys and the accountant, and the run will not start without it. |
| 4 | A customer with several jobs | **Hold it for a person.** Never guess, never file on the newest job. |
| 5 | The date fence | **A mail more than 90 days older than its job is not that job's.** |
| 6 | Tell the team first | **Yes, one note before stage 1.** Each person also gets the app's own notice. |
| 7 | Files | **Copy them, as every tag does.** The count stage says how much storage that is before anything is filed. |
| 8 | Mail only a departed teammate holds | **Leave it out for now** and count it. Filing it needs a change to the seat's rule. |
| 9 | Who approves a sheet | **Grace, or whoever she names for a job.** One approval a job. |
| 10 | Paid jobs with nothing at stake | **Decide after stage 4.** |

## What I would not build

- **A guess for a customer with several jobs.** A mail on the wrong job is worse than no record, because people will trust it.
- **A filing with no job.** The record would have no home anyone opens.
- **A sweep that files and asks later.** The sheet comes first, every time.
- **A new server function.** The seat's verbs already do each step, with a log.
- **A run in office hours.** It writes lines, contacts and files while the crew uses the app.

## Is this the best we can do?

For a first pass, yes. Three honest limits:

1. **A rule is sure about less than half the open jobs' mail.** The rest needs a person. The count stage will say how much that is before anyone commits to it.
2. **The match reads what the search returns:** the people, the subject and the first words. A street named only deep in a long mail is found by Gmail's search, not by the rule's own reading. PR 1's tests pin what counts.
3. **This files conversations, not single mails.** One conversation that wanders across two jobs lands on one or is held.

## Where it plugs in

| What | Exists | New |
|---|---|---|
| Search, plan, apply, untag | `search_mail`, `plan_mail_tag`, `apply_mail_tag`, `plan_mail_untag`, `apply_mail_untag` (`supabase/functions/dev-mcp`, `_shared/devMcpMailTag.ts`) | nothing |
| File for the record | `for_record` → `MyMailKnown.forRecord` → `messages.history` | nothing |
| The match | `mailGuess.ts`, `jobInSubject.ts` (the tab's own guess, one mail at a time) | `src/lib/myMail/backfillMatch.ts`: sure, held or left out, with the reason |
| The run | none | `scripts/mail-backfill.mjs`: `count`, `plan`, `apply`, `undo` |
| The runbook | none | `docs/MAIL_BACKFILL.md` |
| A customer's contact | made when their thread is opened | the runner calls the same path first |

## The plan

1. **PR 1 (S): the rule.** `backfillMatch.ts` and its tests: each case in *The matching rule* above, the never-tag list, the date fence. Pure. No run.
2. **PR 2 (S): the runner and the runbook.** `count`, `plan`, `apply` and `undo`, the ledger, the caps, the customer's contact first. Tested against a fake seat.
3. **Runs**, in the order of *The stages*, each reported on this card with its counts.

## How to verify

- **Stage 0** writes nothing: confirm by the seat's call log holding only searches.
- **Stage 1**: the job's Activity shows the mail at its own dates with the *filed* chip. New's count and the badge are the same before and after. *N done with no reply this week* gains the job's people. The owner's notice names the job.
- **Every stage**: the ledger's filed count equals the seat's ok applies. No unnamed sender was made for an address a customer's record holds.
- **Undo, once, on the pilot job**, then file it again, before stage 2.

## What the count found (2026-11-13)

`docs/recent-features/v2.7084.md` has the whole story. The count ran read-only over every open job: 162 searches, 13 mailboxes, 5,451 conversations. It is a floor: in 7 searches one mailbox had more hits than the run could read.

| | Conversations |
|---|---|
| Sure, the run would file | **93**, on 20 of the 120 open jobs, at most 15 on one |
| Held for a person | **2,659** |
| Left out | 2,699 |

Held, by why: a customer with several jobs 757 · a street several jobs share 612 · two jobs named 490 · a customer who also has a bid or a project 447 · the street named and a stranger on the mail 319 · only someone else at the customer's company 34.

Four things this changes in the plan above:

1. **The one-job rule is far narrower than section *The matching rule* says.** The first count let it file 529 conversations, 257 of them on one job. It now needs an address on the customer's own record and a customer with no bid or project, and a job that would still take more than 40 is held whole. It files 8.
2. **The street is the rule that works:** 65 of the 93, once the search's own finding of a street in a mail's body counted.
3. **Many jobs share one street.** 612 held conversations name a street that two to twenty jobs share, in 44 groups. One house with a job a phase is the likely reason; nobody has checked.
4. **The held mail is the work.** 2,659 is too many for a person to place a line at a time. Stage 3 as written does not scale.

Three calls the count adds:

| # | Call | My pick |
|---|---|---|
| 11 | What to do about the 2,659 held | **Do not place them by hand.** File the 93, then decide from what the pilot shows. The two cheap wins are calls 12 and 13. |
| 12 | A street several jobs share: file on the job under way when the mail was written | **Yes, if the office confirms those are phases of one house.** It would place most of the 612 by rule. |
| 13 | A customer with several jobs and nothing named (757), or who also bids (447) | **Leave them out of this run.** They need a person or a reader of the mail's words, and that is a different, costlier project. |

## Where it stands

2026-11-13: the rule, the runner and the runbook are built (v2.7084). `seed` and `count` have run against prod, read-only. **`plan`, `apply` and `undo` have never run, and nothing was filed.** The never-tag list is empty: the app holds no law-firm addresses to seed it. Filing the 93 today would make 59 unnamed senders, so the customer's contact step comes first. Nobody who knows the jobs has read one of the 93.
