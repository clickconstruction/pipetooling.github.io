# Mail backfill: the mail we already have, onto its jobs

---
file: MAIL_BACKFILL.md
type: Runbook
purpose: How to run the script that files old mail from the office's mailboxes onto Pipeline jobs, for the record
audience: Devs + AI agents
last_updated: 2026-11-13
---

The runbook for `scripts/mail-backfill.ts` (punch list #332). The plan, the measurements and the calls are on the card, `to-dos/mail-backfill-onto-jobs.md`. The rule is `src/lib/myMail/backfillMatch.ts`.

## What it is

A script that walks the office's mailboxes through the dev seat's own verbs and files old conversations onto Pipeline jobs, for the record. It matches each conversation to a job by rule and files only what the rule is sure of. Every filing carries `for_record`, so the mail lands at its own date and asks nobody for a reply. The rest goes on a sheet for a person.

It adds no server code. `search_mail` finds, `plan_mail_tag` says what a tag would do, `apply_mail_tag` files, and `plan_mail_untag` with `apply_mail_untag` takes a filing back.

## Before a run

- **A dev key** in `PT_DEV_MCP_TOKEN` (Settings → Your account → Dev MCP keys).
- **A folder outside the repo.** The default is `~/.pipetooling/mail-backfill`; `--dir` names another. It holds the never-tag list, the sheets and the ledger. All three carry real names. The repo is public: none of it is ever committed.
- **The never-tag list**, named by the office. See below.
- **Outside office hours** for `apply`. It writes lines, contacts and files while the crew uses the app.

## The commands

```bash
npm run mail:backfill -- seed
```

Writes the never-tag list's first lines from the law firm's people the app knows. It refuses when the file is there already.

```bash
npm run mail:backfill -- count
```

Read-only. Every open job: how many conversations are sure, held for a person or left out, by rule, by year, and how many senders have no contact yet. It writes a sheet and files nothing. It is the only command that runs with an empty never-tag list, and it says so.

```bash
npm run mail:backfill -- plan --job JP1077
```

Read-only. For one job, the seat's own dry run of each sure conversation. It writes the job's sheet and a `plan` line in the ledger for each. A person reads the sheet.

```bash
npm run mail:backfill -- apply --job JP1077 --approved
```

Files the planned conversations of one job. It refuses without `--approved`. It files at most `--max` a run (25), pauses between calls, and stops at the first refusal it does not expect. A plan that no longer holds is skipped: plan the job again and read the new sheet.

```bash
npm run mail:backfill -- undo --job JP1077
```

Takes back what this run filed on one job, through the seat's untag. The seat takes off only a tag the seat made. A line the office has since written a promise or a highlight on is held back, as any untag holds it.

## The never-tag list

`never-tag.txt` in the run's folder. One address or `@domain` a line. A `#` starts a comment.

A conversation with any of them on it is never filed, whatever it says. The office names the list: the company's attorneys, the accountant, payroll, the bank, insurers, and anyone whose mail is private. `plan` and `apply` do not start while it is empty.

## What a run may never do

- **File without `for_record`.** A backfill is a record. It must never ask the office to answer anything. `mailBackfillRun.test.ts` reads the script and fails if a tag is built without it.
- **Guess.** A customer with several jobs is held for a person. The rule's tests pin each case.
- **File from a mailbox its owner switched off.** The seat would allow it. The run does not.
- **Write in `count` or `plan`.** The same test pins the only seat verbs the script calls.
- **Leave its sheets in the repo.**

## When something goes wrong

- **A wrong job.** `undo --job`, then fix the rule or leave the conversation for a person. Say what happened on the card.
- **A refusal in `apply`.** The ledger's last `refused` line holds the seat's words. *Plan again* means the conversation changed since the plan: run `plan` again.
- **A run that was stopped.** Run the same command again. The ledger says what was done, and a conversation already filed is tied, never written twice.
- **Unnamed senders.** `count` says how many outside addresses on sure conversations have no contact yet. Each would become an unnamed sender. Make the customer's contact first (`contact_for_job`, the app's own way when a job's thread is opened), then file.
