# Mail backfill: the mail we already have, onto its jobs

---
file: MAIL_BACKFILL.md
type: Runbook
purpose: How to run the script that files old mail from the office's mailboxes onto Pipeline jobs, for the record
audience: Devs + AI agents
last_updated: 2026-11-13
---

The runbook for `scripts/mail-backfill.ts` (punch list #332). The plan, the measurements and the calls are on the card, `to-dos/mail-backfill-onto-jobs.md`. The rule is `src/lib/myMail/backfillMatch.ts`. The customer's contact step is `src/lib/myMail/backfillContact.ts`.

## What it is

A script that walks the office's mailboxes through the dev seat's own verbs and files old conversations onto Pipeline jobs, for the record. It matches each conversation to a job by rule and files only what the rule is sure of. Every filing carries `for_record`, so the mail lands at its own date and asks nobody for a reply. The rest goes on a sheet for a person.

It adds no server code. `search_mail` finds, `plan_mail_tag` says what a tag would do, `read_mail` reads one mail whole for who it lands on, `apply_mail_tag` files, and `plan_mail_untag` with `apply_mail_untag` takes a filing back.

`src/lib/mailBackfillRehearsal.test.ts` runs every command against a made-up seat. Until the pilot, that is the only place `plan`, `apply` and `undo` have run.

## Before a run

- **A dev key** in `PT_DEV_MCP_TOKEN` (Settings → Your account → Dev MCP keys).
- **A folder outside the repo.** The default is `~/.pipetooling/mail-backfill`; `--dir` names another. It holds the never-tag list, the sheets and the ledger. All three carry real names. The repo is public: none of it is ever committed.
- **The never-tag list**, named by the office. See below.
- **Outside office hours** for `apply`. It writes lines and files while the crew uses the app, so it refuses from 6 am to 7 pm Central, Monday to Saturday (`inOfficeHours`). There is no flag past it. `undo` runs at any hour.

## The commands

```bash
npm run mail:backfill -- seed
```

Writes the never-tag list's first lines from the law firm's people the app knows. It refuses when the file is there already.

```bash
npm run mail:backfill -- count
```

Read-only. Every open job: how many conversations are sure, held for a person or left out, by rule and by year. Then the contact step over the sure ones: how many have every sender named, how many are held for a contact and why, and how many customers' threads one press each would open. It writes two sheets and files nothing: `count-<date>.csv`, a conversation a row, and `count-jobs-<date>.csv`, a job a row, for picking the pilot. It is the only command that runs with an empty never-tag list, and it says so. It takes about 40 minutes.

```bash
npm run mail:backfill -- plan --job JP1077
```

Read-only. For one job, the seat's own dry run of each sure conversation, then the contact step over every mail that dry run would write. A conversation whose every sender is named gets a `plan` line in the ledger. One that is not gets a `held` line, which `apply` never reads. It writes the job's sheet. A person who knows the job reads it. See *The plan sheet* below.

```bash
npm run mail:backfill -- apply --job JP1077 --approved
```

Files the planned conversations of one job. It refuses without `--approved`, in office hours, and while the never-tag list is empty. It files at most `--max` a run (25), pauses between calls, and stops at the first refusal it does not expect. A plan that no longer holds is skipped: plan the job again and read the new sheet. It also stops when the seat says a filing made an unnamed sender. The contact step should have held that conversation, so the run goes no further until someone has looked.

```bash
npm run mail:backfill -- undo --job JP1077
```

Takes back what this run filed on one job, through the seat's untag. The seat takes off only a tag the seat made. A line the office has since written a promise or a highlight on is held back, as any untag holds it.

## The customer's contact step

A tag lands each mail's line on the contact that holds its sender's address. When no contact holds it, the tag makes an unnamed sender, a *Who is this?* row. A backfill must not do that for someone the office knows, so the run names every sender first and holds what it cannot name.

The sender of a mail is the tag's own reading. A mail in lands on whoever sent it. A mail of ours lands on the first person outside it was written to. A mail between teammates lands on its sender's own thread. The run reads the team and Settings' boxes as the tag does. An address at our own domain that is neither is unclear, and every reading of it has to be named.

The run makes no contact. `contact_for_customer` and `contact_for_job` both write, and the seat's read door refuses a write. `contact_for_job` is a tech's door in any case. So a held conversation waits for a person's press in the app, and the next `plan` reads what that press made.

| The sheet says | What it means | The press |
|---|---|---|
| ready | Every sender has a named contact. The sheet lists who. | None. |
| held: the customer has no contact yet | The sender is the address on the customer's record, and nobody has opened their thread. | Open the customer's thread with the speech bubble beside their name. Then plan again. |
| held: on the record, on no contact | The address is the billing address or a person at the customer. Opening the thread does not add it. | None adds it. Save the conversation from My email and name the sender in *Who is this?*, or leave it out. |
| held: on *Who is this?* already | An unnamed sender already holds the address. | Name them in Messages, *Who is this?* Then plan again. |
| held: an address of ours with no contact | A teammate nobody has a thread with, an alias, or a box the run cannot see. | Leave it out, and say on the card which it was. |
| held: nobody the app knows | A stranger to the app. Often someone at the customer's company who is not on its record. | Leave it out, or save it from My email and name the sender. |

## The plan sheet

`sheets/plan-<job>-<date>.csv` in the run's folder, a conversation a row, for someone who knows the job:

- **job**: its number, its name and its address.
- **first mail** and **newest mail**: the conversation's dates.
- **mailbox**: whose mail it is.
- **why it is sure**: the rule, in words.
- **contact step**, **filed under**, **not named**, **what to press**: ready or held, each sender with how they stand to the job, and the press for a held one.
- **mails**, **lines to write**, **lines to tie**, **files**, **file names**: what the seat's dry run would do, and the files by name.
- **moves off**, **subject**, **thread**, **refused**.

Approving the sheet means the ready rows read right to that person. Only they are filed.

## The never-tag list

`never-tag.txt` in the run's folder. One address or `@domain` a line. A `#` starts a comment.

A conversation with any of them on it is never filed, whatever it says. The office names the list: the company's attorneys, the accountant, payroll, the bank, insurers, and anyone whose mail is private. `plan` and `apply` do not start while it is empty.

## What a run may never do

- **File without `for_record`.** A backfill is a record. It must never ask the office to answer anything. `mailBackfillRun.test.ts` reads the script and fails if a tag is built without it.
- **Guess.** A customer with several jobs is held for a person. The rule's tests pin each case.
- **File from a mailbox its owner switched off.** The seat would allow it. The run does not.
- **Write in `count` or `plan`.** The same test pins the only seat verbs the script calls.
- **Make a contact, or an unnamed sender.** The test pins that a conversation is planned only when the contact step names every sender, and that the script calls no door that makes or names a contact.
- **File in office hours.**
- **Leave its sheets in the repo.**

## When something goes wrong

- **A wrong job.** `undo --job`, then fix the rule or leave the conversation for a person. Say what happened on the card.
- **A refusal in `apply`.** The ledger's last `refused` line holds the seat's words. *Plan again* means the conversation changed since the plan: run `plan` again.
- **A run that was stopped.** Run the same command again. The ledger says what was done, and a conversation already filed is tied, never written twice.
- **A run that stopped at an unnamed sender.** The ledger's last `applied` line carries `unnamed`. Name the sender in Messages, *Who is this?*, or `undo --job`. Then find why the contact step read that mail differently from the tag, and say so on the card before the next run.
- **Most of a job is held for a contact.** That is the step working. Do the presses the sheet names, then `plan` again.
