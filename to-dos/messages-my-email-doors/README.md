---
name: "Messages → My email: a door on the job and the bid, where the person already works, and the Sent side with no press"
number: 263
group: gated
status: proposed 2026-11-04 from Grace's review of #230, four days after the tab went live with no visit by a clickplumbing.com person and no tag · two design calls drawn Now beside the suggestion · nothing built
summary: >
  My email (#230) shipped 2026-11-01 as a tab on Messages, the person's own Inbox and Sent with one
  press to tag a conversation onto a job. Four days on, the usage ledger shows no office member on
  the company Workspace has opened the tab, and email_tag_threads holds no row. The people who
  would tag live elsewhere: Taunya on Jobs → Stages, Schedule and the Dashboard, Wendi and Grace on
  the Bid Board. The tab is a place to go, with no door from where they are and, by the owner's own
  call, no count anywhere. Two things would make it better. First, a line on the job window and on
  the bid, read from the person's own Gmail when the window opens and kept nowhere, naming the
  conversations with the job's people that are not on the job yet, with Yes on each. Second, the
  Sent side with no press at all, the shape #230 called option C and #207 called call 1: a mail the
  person sends from their own box to an address on exactly one open job lands on it by itself,
  marked as put there by the app, with Untag on the line.
next: The owner's five calls at the foot, call 1 first. Before any of it, Grace's own first live tag as grace@clickplumbing.com on a ZZ Test job, which proves the read and the tag no agent can.
size: S (call 1 as drawn: one Gmail search per window open through gmail-mine's list, one kernel, the line on JobThreadSummary and the bid's thread rail, the guide) + M (call 2: the follow widened to the person's Sent, a per-person fence, a marked line with Untag)
blocker: The owner's calls. No agent can read a Workspace mailbox, so the guess's quality on real rows is still unmeasured: Grace's walk comes first.
ver: proposed
opinion: build call 1 — the tab's one assumption, that a person will go and look, is the one the ledger refutes; a door at the job costs one read on open and keeps the person's press; call 2 after a month of call 1
mockup: to-dos/messages-my-email-doors/mockup.html
---

# Messages → My email: a door where the person already works (#263)

## The ask

Grace, 2026-11-04, re-reading her note that asked for a My email tab, which had since shipped as
#230: "is this still relevant? could we do this better?" The review that answers the first question
is on #230's card (`to-dos/messages-my-email/README.md` → *Review 2026-11-04*). This card is the
answer to the second.

## What the ledger says, four days in

Read 2026-11-04 as the dev through the app's own rows (`user_app_activity_page_daily`,
`email_tag_threads`, `users`).

| Fact | Read |
|---|---|
| Conversations tagged since 2026-11-01 | **0** (`email_tag_threads` is empty; no `messages` row has `mailbox` mine) |
| Office members with the switch on | every one, by default: Taunya, Roxi, Grace, Malachi, Zoe, William, Wendi, and the samples and twins the function refuses anyway |
| Time on `/messages?tab=my-email` since 11-01 | the dev alone: 62 min on the build day, 5 min on 11-02, 1 min on 11-05; **no clickplumbing.com person has opened it** |
| Where the office lives (since 10-22) | Taunya: Jobs → Stages 748 min, Schedule 334, Dashboard 328, Quickfill 260, Messages 5. Wendi: Bid Board 722, Dashboard 377, Messages 151. Grace: Bid Board 1264, Pricing 484, Takeoffs 465. Malachi: Tally → On site 130. Roxi, Zoe, William: no rows |
| The live tab as the dev | Google's refusal, one calm line: the dev's address is off the Workspace. The card said so on 11-01; it still holds |

The tab's design took the owner's call 2 as built: no badge, no count, no Needs you line, "an untouched
tab looks empty, not nagging". The ledger shows the other side of that coin. Nothing brings a person
to it, and the one Messages page it sits on is where Taunya spends five minutes a fortnight.

## The two calls, drawn

The mock-up draws each as one spot, **Now** beside **My suggestion**, the recommendation first.

### 1 · A door on the job and the bid (recommended)

Where: the job window's **Where it stands** card (`JobThreadSummary.tsx`, read on Jobs → Stages and the
Pipeline, Taunya's 748 minutes), and the bid's thread rail on the Bid Board (Wendi's and Grace's
hours). When the window opens and the person's switch is on, one `gmail-mine` `list` call as them, the
search the tab already takes (`from:` or `to:` the job's people's addresses, the job's number, minus
the tag label), metadata only, kept nowhere. One line under the card:

> *Your mail with Dale Okafor: 2 conversations not on this job* · Re: 4 Elm Ct water heater **Yes** · Invoice 88412 **Tag…**

**Yes** is the tab's own tag onto this job. Nothing of it counts anywhere, nags, or is read for a job the
person does not open. A person whose address Google refuses, or whose switch is off, sees no line.

| Option | What it is | Cost | Verdict |
|---|---|---|---|
| **A · The line, read on open** | One Gmail search when the job or bid window opens, the rows with Yes inline. | S: one read through the function that exists, one pure kernel for the search and the line's words, the line on two surfaces, the guide. | **Yes.** The press stays the person's; the read happens where they already are. |
| B · A bare press | *Your own mail with Dale ›* opening the tab searched on the job's people (`?tab=my-email&q=…`, which already works). No read until pressed. | XS. | A fallback. It still sends the person to the tab, and the tab is what nobody opens. Ship it inside A as the line's own door when there are more than three rows. |
| 0 · Nothing, wait the month | The card's own retire test as written. | Nothing. | No. The test cannot pass: the tab has no door, so "nobody tags" measures the door, not the want. |

### 2 · The Sent side with no press (second, after a month of call 1)

#230 weighed it as option C and chose the tab; #207's call 1 asked the same thing from Wendi's side
(her answer from wendi@ never reached the thread, so Rusty's thread read *Our move* for a day). The
follow (`gmail-mine` `follow`, every five minutes) reads tagged conversations today. Widened: for each
person with the switch on, their Sent since the last run; a mail to an address that is on exactly one
open job, or whose domain is one customer's with one open job (the guess's own steps 3 and 4), lands
on that job as ours under the person, with a grey mark *from Wendi's mail · put here by the app* and
**Untag** on the line. A mail to nobody the app knows lands nowhere. A mail the boxes already hold is
tied, never doubled, as the tag does today.

| Option | What it is | Cost | Verdict |
|---|---|---|---|
| **A · The Sent side follows the guess** | As above; the person presses nothing, and every landed line says the app put it there. | M: the follow's selection widened to a person's Sent with a `last_sent_read_at` per person, the same `landMail`, the mark's words, a fence so a line the app placed is the first thing an Untag takes off. | **Yes, second.** It is the one shape with zero presses, and it is the shape Wendi asked for. It ties on a guess alone, which #230 refused for the Inbox; the Sent side is safer, since the person chose the address. |
| B · Keep a press | Today. | Nothing. | For the Inbox, yes. For the Sent, the press is the undue work the note asked us to avoid. |

### 3 · A Needs you line on the Dashboard

*Mail in your box that looks like a job: 4* on the Dashboard's Needs you card, every morning, from a
per-person run that lists each box's metadata. Not recommended now: it is the counter #159 drew,
it is the count the owner's call 2 refused, and it costs a Gmail read per person per run for a line
that call 1 answers where the job is. Revisit after call 1 has a month.

### 4 · The retire test, re-dated, and who walks it first

#230 says the tab retires if nobody tags after a month. The month cannot start until a person on the
Workspace has opened the tab once: no agent can (the dev's address is off it), and nobody has.
Grace is on the office team as grace@clickplumbing.com with the switch on. Recommended: Grace opens
Messages → My email as herself, reads the first page, counts the guesses right, wrong and none over
the first thirty rows, and tags one conversation onto a ZZ Test job, then untags it and deletes the
rows (#230 → How to verify, PR 2 and PR 3). The month runs from that day, 2026-12-05 if it is
tomorrow, measured by `email_tag_threads` rows per person.

### 5 · The guess's thread rule

The guess reads the subject, the sender's one job and the sender's domain, each mail alone. It does
not read the mail's own conversation: on the same page, another mail of the same Gmail conversation
that a box already holds on a job (`inMessages.jobKey`) says the job outright, and today that row
reads *already in Messages ✓* while its newer reply reads *Tag…*. A page-local rule, "a mail of this
conversation is on JP1077 already", is pure and an afternoon. Recommended, as its own small PR, once
Grace's walk has rows to measure the guess against; blind, it would be the third guess rule nobody
has seen fire.

## What this does not touch

- The Inbox keeps its press: a customer's mail never lands on a guess alone (#230's call 3).
- The Legal desk's pull, the 60-day follow, the imitation guard and the switch stand as built.
- #207's sender and shape (calls 5 and 6) are a different question: what the app sends, not what it reads.
- #259 (the HTML part of inbound mail) is untouched.

## Where it plugs in

Exists: `gmail-mine` (`list` with `q`, `tag`, `follow` and `landMail`), `src/lib/myMail/` (`mailGuess.ts`
steps 3 and 4, `mineFunction.ts`'s `myMailQuery`, `planFollow`, `myMailGuessFacts`), the job window's
`JobThreadSummary.tsx` (Where it stands), the bid's thread rail, `JobPickerWindow`, `email_tag_threads`,
`users.my_mail_on`, `useMessagesHost` for the job's people and their addresses.

New for call 1: `src/lib/myMail/jobDoor.ts` (the search for a job's people and number, the line's words,
the rows the line draws, at most three with the tab as the door for more), a `MyMailJobLine.tsx` drawn
by the two surfaces, and `check:plain-words` on its words. New for call 2: `users.my_mail_sent_read_at`
(one migration, `SET lock_timeout = '3s'`), the follow's second selection, the mark on the line and its
Untag.

## How to verify, once built

- Call 1: as grace@clickplumbing.com, open a job whose customer has written to her own address: the
  line names the conversation with Yes; Yes tags it, the line reads *on this job ✓*, and the tab's
  Tagged view shows it. A job with no mail draws no line. A session opened with Imitate draws none.
- Call 2: send a mail from her own Gmail to the ZZ Test customer's address on one open ZZ Test job;
  within five minutes it is on the job's thread as ours, marked, and Untag takes it off. Delete the
  ZZ Test rows.

## Where it stands

- 2026-11-04: written from Grace's review of #230 (the ledger, the code, the live tab as the dev). The
  mock-up draws the job window's Where it stands card and a thread line, each Now beside the
  suggestion, at a desk and on a phone. Nothing built. Waiting on the five calls, and on Grace's walk.
