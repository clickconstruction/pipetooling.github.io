---
name: "Bids: keep a mail's files as a set of plans on the bid, from the mail itself"
number: 368
group: close
status: built 2026-11-16 as a train of four, the owner having said build it the same day · PR 1 the server leg (v2.7531), PR 2 the press (v2.7534), PR 3 the bid's and the site's doors (v2.7538), PR 4 the job's paper press on the mail's window (v2.7540)
summary: >
  An addendum or a revised spec reaches a bid by mail. The mail can be tied to the bid, and since
  v2.7479 it reads on the site's History, but its files stay on the line in Messages while the
  estimators and the robot read the bid's plans in Drive. The job's press, Keep this mail as a paper,
  takes a job only, and it shows only in My email on a mail in your own box. The answer is one press
  on the mail itself, wherever the office reads it: it files the mail's files in the bid's own Drive
  folder under Plans and adds a set to the bid, which says it came from that mail.
next: A person's look in the live app on a ZZ test bid with a mail that carries two files, by the five steps under How to verify. Then retire this card.
size: L as a train of four (M · M · M · S); left: the live look (S)
blocker: None.
ver: v2.7531 · v2.7534 · v2.7538 · v2.7540
---

# Keep a mail's files as a set on a bid (#368)

Mock-up: [`mockup.html`](./mockup.html), served at `/to-dos/bid-mail-files-as-a-plan-set/mockup.html` on the dev
server. Made-up bids, names and files only.

## The ask

The owner, 2026-11-16, after v2.7479 put tied mail on a development's History: "Help me explore the idea of keep
this mail as a paper for a bid", then "I do want to build it", and, on the plan: "let me know how to access it
from the GUI. I never thought about that. But that's pretty important."

## What is true today

- **A bid keeps its plans in its own register.** `bid_plan_sets` holds one row per set: a name, a memo, a date and
  a Drive link, which is required. Edit Bid → Plans → Plan sets adds, checks and removes them, and the Bid Board's
  plans icon lists them. `bids.plans_link` is the one set the robot reads.
- **A job keeps papers, a bid does not.** A job's papers are `plan_sets` rows on a `plan_parts` part, and a part is
  owned by a development or a job, never a bid (`plan_parts_one_owner`).
- **The job's press is hard to reach.** `MailPaperDoor` draws in one place, the My email reader, on a mail tagged to
  a Pipeline job. My email shows your own mailbox, so a mail another person tagged, or one the dev seat tagged,
  offers the press to nobody else.
- **A bid has a Drive folder of its own.** `bids.drive_link` is the bid's project folder, found or made under the
  jobs root by the office's bid pattern (`_shared/bidFolder.ts`). The bid's photos already file inside it, under
  Team only › Photos.
- **The mail's files are ours.** A tagged mail's attachments are rows of `message_attachments` with our copy in the
  `message-attachments` bucket, or a word on why the file stayed in Gmail.

## The decision

**Use the bid's own sets. Do not give a bid the job's paper model.** The press files the mail's files into
*the bid's project folder › Plans › the set's name* and adds one `bid_plan_sets` row that points at that folder.
A bid outside any development works the same as one inside. The fuller model (a kind, a source, a *goes with*
link on a bid's set, or a part owned by a bid) waits until someone needs a spec told apart from a drawing on a bid.

One column is added, and it sits on the file, not on the set: `message_attachments.bid_plan_set_id`, the set a
mail's file was filed into. The function writes it as the service role once the file is in the folder. It is what
lets a set say *from a mail* with a door back, and what lets the mail say *kept as Addendum 2* in place of
offering the press twice. The first plan put the mark on the set (`bid_plan_sets.source_message_id`). That could
not say that two of a mail's three files are kept, nor that a later mail added a sheet to a set an earlier mail
made, so the mark moved to the file in PR 1.

## Is this the best we can do?

The first draft was a press in My email with today's job form. Asked that question, six things changed:

1. **Reach.** A press in My email serves only the person whose mailbox holds the mail. The press moves onto the
   mail itself in Messages, where the whole office reads it, and three more doors lead to the same press: the
   mail's line on the Development page's History, a list under the bid's Plan sets, and My email.
2. **One mail, one set.** Without a mark, a second press makes *Addendum 2 · 2*. The column above stops that, and
   the mail reads *kept* everywhere it is drawn.
3. **Do what is ready.** A mail can carry three files and we may hold a copy of two. Each file has a tick, the
   button counts what it will file, a file that stayed in Gmail is named and held, and a file that fails is tried
   again on the same set.
4. **Not always a new set.** A second mail may carry one more sheet of an addendum already kept. *Put them in*
   offers a new set or one of the bid's sets whose folder the app can write to.
5. **The record follows.** A set added to a bid draws a line on the site's History under the Plans chip, however it
   was added, so the mail line and the set line read together.
6. **The job's press has the same gap.** It moves onto the mail's window in Messages too.

What stays out, on purpose: the press never switches which set the robot reads (that stays **Robot reads this
set** on the bid), a mail with no file gets no press (it is already on the history), and nothing carries a bid's
sets to the job when the bid is won beyond what **Priced on** does today.

## How you reach it

| Door | Where | Who sees it |
|---|---|---|
| 1 | Messages → a person's thread → press the mail → **Keep its files on the bid…** beside *Open the bid* | the office team |
| 2 | Development page → History → the mail's line → **Keep its file…** | the roles that open Messages |
| 3 | Edit Bid → Plans → Plan sets → **+ From a mail on this bid** | the roles that write a bid's sets |
| 4 | Messages → My email → a mail tagged to a bid | the mailbox's owner |

## Where it plugs in

Exists:

- `bid_plan_sets` and its policies: read with the bid, written by dev, the leaders, the assistants, the controller
  and the estimator on a bid they can see.
- `src/lib/bids/bidPlanSets.ts`, `BidPlanSetsField.tsx`, `useBidPlanSetsByBid.ts`.
- `_shared/bidFolder.ts`: the bid's project folder, made as needed, with the words for a folder the app cannot use.
- `plan-set-files` and `_shared/planSetFilesRun.ts`: the job's rules, the model for the new leg (a second try finds
  the file again, two sets of one name keep two folders, nothing is made before everything is checked).
- `src/lib/plans/planSetFiles.ts`: `splitMailFiles`, `mailFilesWords`, `fileAgainLabel`.
- `emailViewerActions.ts`, `useEmailViewerThreadSlots.tsx`, `EmailViewerActions.tsx`: the mail window's action row.
- `MyMailReader.tsx`, `MailPaperDoor.tsx`.
- `history.ts` (`mailLines`), `DevelopmentFeed.tsx`, `fetchDevelopmentPage.ts` (`readTiedMail`).

New:

- Migration: `message_attachments.bid_plan_set_id uuid REFERENCES bid_plan_sets(id) ON DELETE SET NULL`, with an index.
- Edge function `bid-plan-set-files` over `_shared/bidPlanSetFilesRun.ts`:
  - `keep { bid_id, message_id, name, memo, plan_date }` checks the caller, the bid and the mail's tie, makes the
    folder, and inserts the row through the caller's own client, so the table's policies decide.
  - `save_attachment { set_id, attachment_id }` files our copy of one file into the set's folder and marks the
    file's row. The mail must be tied to the set's bid. It refuses in words a set whose folder cannot take files,
    so no third ask was needed.
- `src/lib/bids/bidMailSet.ts`: the draft from the mail, the press's counted words, what a kept mail says.
- `BidMailSetDoor.tsx`, drawn by all four doors.

## The plan

1. **PR 1, the server leg (M).** The migration, the function, its rules with a fake-driven test, `config.toml`,
   `docs/EDGE_FUNCTIONS.md`, the migration's doc. After the merge: `supabase db push`, deploy the function, a types PR.
2. **PR 2, the press (M).** The kernel and the door; door 1 (the mail's window) and door 4 (My email); the set's
   *from a mail* chip and *The mail ›* on Plan sets; a guide; the glossary.
3. **PR 3, the site and the bid (M).** Door 2 on the History line, which needs the tied mail's file count and its
   kept mark; a *New set* History line from `bid_plan_sets`; door 3 under Plan sets.
4. **PR 4, the job's press in the mail's window (S).** `MailPaperDoor` on a line tied to a Pipeline job.

## How to verify

On a ZZ test bid with a mail tied to it that carries two files:

1. Messages → the thread → the mail: the press is there. Keep both files. The set is on the bid, the folder holds
   both files, the mail reads *kept*.
2. Press again from each other door: no second set is offered.
3. A bid with no project folder: one is made and its link written on the bid.
4. As an estimator: the press works. As a training account: refused in words, nothing made.
5. The Development page's History: the *New set* line and the mail's *kept* mark.

## Where it stands

Built 2026-11-16, all four PRs. What was checked: each piece's tests, sweeps of some 600 test files around
Messages, bids and the Development page, and a look at the press, its form, the result line and the kept mark with
made-up rows at desktop and phone width.

What was not: the function has not been watched filing into a real Drive folder from the app, and the History
line's press, the list under Plan sets and the job's paper press on the mail's window were covered by render tests
alone. The five steps above are that look.
