---
name: "Messages: an invitation is a bid lead and a notice is not a person — New stops asking Who is this? of mail nobody wrote to us"
number: 223
group: gated
status: proposed 2026-10-30 from Taunya's look at New on the Messages page · read against the reader, the sort card and the lane · four pieces, six calls at the foot · nothing built
summary: >
  On 2026-10-30 New held thirteen rows and eleven of them were mail nobody wrote to us: nine
  invitations to bid and agency procurement notices, one newsletter, one bid platform's own
  notice. The reader already leaves out list mail, no-reply senders and Gmail's other tabs by
  their headers, but a GC's bid platform and a public agency's procurement system send
  person-to-person mail with none of those marks, so each lands as a Who is this? row with no
  press that sorts it anywhere but onto a person. The app's own rules say what to do: never
  delete, sort each to where it belongs, remember the answer so the app stops asking, and let a
  robot take the obvious ones first. Four pieces: a notice, not a person (one press that takes
  the thread off Follow up and puts the sender on a left-out list the reader checks); the reader
  reading the body's own unsubscribe line; an invitation is a bid lead (the row asks Bid it? and
  its card offers Start a bid with the GC, the link and the due date, Not for us, or Keep it
  with the GC; an addendum lands on the bid it names); and the robot's first pass (the obvious
  notices folded with a count and Put back).
next: The six calls at the foot. PR 1 needs calls 1 and 2 only and can go first; PR 2 needs none.
size: M+S+L+M (PR 1 a notice, with one small migration and a gmail-sync redeploy; PR 2 the reader's body cue; PR 3 Bid it?; PR 4 the addendum tie and the robot's fold)
blocker: The six calls. Call 3 wants the estimator's word on what a bid made from an email should carry.
ver: v2.5354 · 5494 · 5546 · 5559 · 5711 · 5716 · 5722 · 5793 · 5795 · 5798 · 5811 · 5814 · 5982 · 6179 · 6191 (PR #6595, the row these pieces build on; this card is PR #6601)
opinion: build — every door exists (the reader's left-out rule, the sort card's record-making presses, the bid's ITB links, the line-to-job tie by subject, the Sort all desk); what is missing is two more answers to the sort's question and a list the reader remembers
mockup: to-dos/messages-notices/mockup.html
---

# Messages: an invitation is a bid lead and a notice is not a person (#223)

## For Taunya

New on the Messages page is meant to hold what came in and still needs sorting, one row per
person. On 2026-10-30 it held thirteen rows, and eleven were not people writing to us. This card
says why they get through, what the app already does with mail like it, and the four pieces that
would make New hold only what needs a person. **Six calls sit at the foot.** Calls 1 and 2 unlock
the small first PR; call 3 wants Wendi's word, since it is about what a bid made from an email
should carry.

## The ask, in Taunya's words

Taunya, 2026-10-30, looking at New on `/messages` with thirteen rows:

> I am looking at these messages and the vast majority of them are solicitations or newsletters,
> not direct communication. Based on the style of our app, how should I handle these?

## What New held on 2026-10-30

Counted by kind, with no sender named here, since the repo is public.

| Kind | Rows | What it is |
|---|---|---|
| An invitation to bid from a GC's estimating platform | 4 | A general contractor inviting us to price a project. Sent person-to-person by the platform under the estimator's name. |
| A public agency's procurement notice | 5 | A county addendum, a state agency's solicitation, a university's notice to respondents, a school district's project, a bid-room posting. |
| A newsletter | 1 | A surety broker's article. No list headers. |
| A bid platform's own notice | 1 | A site visit added to an invitation's calendar. |
| A person | 1 | A missed call from a customer, with the app's text back. The one row New is for. |
| Below the fold | 2 | Two more agency notices. |

## What exists today

- **The reader leaves out what it can tell by headers.** `gmail-sync` (v2.5354; the team box
  since v2.5494) reads each box's Inbox every minute and takes every mail once, by its Gmail id.
  `src/lib/emailIn/leftOut.ts` leaves out spam and trash, mail not in the Inbox, the box's own
  sends and the app's, mail marked as a list or bulk or sent by a machine (`List-Unsubscribe`,
  `List-Id`, `Precedence`, `Auto-Submitted`), a no-reply sender, and Gmail's Promotions, Social,
  Updates and Forums tabs. Nothing in Gmail is deleted, archived, moved or marked read. A GC's
  platform and an agency's procurement system send under a person's name with none of those marks,
  which is why they get through. The newsletter had no list header either; its unsubscribe line was
  in the body, which the reader does not read.
- **A sender nobody has named becomes a Who is this? row.** `email_place_address` finds or makes
  the contact; the New lane (`followUp/newLane.ts`) asks *Who is this?* of every `unknown`; the sort
  card's guesses on bids@ open with **A customer we know** and **A new customer** (v2.5795, since a
  general contractor is a customer), then a trade partner, a supply house and a candidate, each made
  by the press (v2.5811), **One of our own team** (v2.5546), **Someone else**. Every press names the
  sender as a person or a company. There is no press for *this is not a person*.
- **One kind already leaves Follow up for good.** A supply house or a candidate is never on Follow
  up (`OFF_FOLLOW_UP` in `followUp/queue.ts`): name a sender as one and their thread leaves New and
  never comes back. That is the shape a notice wants, without pretending a surety broker is a supply
  house.
- **Sort all walks the lane** (v2.5793, one control per row; the desk one person at a time). Any new
  answer on the card is one more press the desk already walks.
- **The subject already ties a line to a job.** `subjectJobs.ts` and `jobInSubject.ts` read a job
  number or a job's name from the subject and land the line on it. A bid has no such tie yet; an
  addendum to a bid we are pricing lands on the sender's thread as a new Who is this? row.
- **A bid already knows its invitation.** `bids.itb_links` holds the PlanHub, BuildingConnected and
  Procore pages (`src/lib/itbLinks.ts`), `bid_gcs` the per-GC due date and submitted-to, and the
  Development page (v2.6179) keeps archived bids apart from the undecided. A lead's row carries
  **Start an estimate** (v2.5711), which makes the customer and opens the estimate in one press: the
  pattern an invitation wants.
- **The robots write down and the estimator takes** (#221, v2.6180): the robot's rows sit in a fold
  with a count, set aside and never deleted. The same shape fits notices.
- **The zero-code door is in Gmail.** The reader takes a mail given the Inbox label later
  (v2.5982), so a Gmail filter that skips the Inbox for a sender keeps that sender out of Messages
  today. It lives outside the app, nobody in the office knows it, and it remembers nothing in the
  app's words. It is the fallback, not the answer.

## The decision

### 1 · A notice, not a person

A fourth block on the *Who is this?* card, under the people: **A notice, not a person**, one press
that reads *Mark news@alamosurety.example a notice* (the sender's address in the button, the way the
other presses name what they make), and under it, when the address is on a company's own domain
(`companyDomain`'s rule, never an open mail service), a second press *and everything from
alamosurety.example*.

The press does three things and nothing else. The thread's state goes to done with a grey event
line, *Marked a notice · Rosa · 2:14 PM*, so the row leaves New and Needs a reply and the thread
keeps every line it had. The address, or the domain, goes on a left-out list the reader checks
(`email_left_out_senders`: `value`, `kind` address or domain, `mailbox` or null for both, `by`,
`at`), so the next mail from it is left out before `email_place_address` ever runs, and nothing
flips the thread back to waiting. And Gmail is untouched, by the reader's own rule. Search still
finds the thread; the *Who is this?* kind pill still lists it. A press pressed wrong is undone from
the thread: *Not a notice after all* takes the row off the list and the thread back to waiting.

On the Sort all desk the block sits where the card draws it, so sorting a morning's notices is one
press each with the desk moving on.

### 2 · The reader reads the body too

`leftOut.ts` gains one rule after the headers: a body whose last lines carry an unsubscribe line,
*view this email in your browser*, *you are receiving this because*, or *manage your preferences* is
bulk, left out and unlabelled like the rest. The kernel is pure and mirrored to the edge by
`scripts/edge-kernels.mjs`; the gmail-sync redeploy is the whole deploy. The newsletter of
2026-10-30 never reaches New after this. An invitation's platform footer does not read as bulk:
those say *to stop receiving invitations from this contractor*, which names a person's choice, not
a list, so the rule names its phrases exactly and the test holds a platform's footer as taken.

### 3 · An invitation is a bid lead

The app already says a general contractor is a customer. An invitation is that customer asking us
to price a job, which is the start of a bid, not a stranger. So the row's question changes.

- **The read.** A kernel `emailIn/invitation.ts` reads the subject, the body and the links: the
  words *invitation to bid*, *ITB*, *IFB*, *RFP*, *RFQ*, *addendum*, *solicitation*, *bid room*,
  *notice to respondents*, *pre-bid*, *plans are available*; a portal host (PlanHub,
  BuildingConnected, Procore, ESBD and the state's SmartBuy, BidNet, Bonfire, CivCast, DemandStar);
  the project's name from the subject; a due date and time when the body names one (*bids due
  Thursday, November 12 at 2:00 PM*). It is pure and tested on a platform's invitation, an agency's
  notice, an addendum and a plain email that names none of it.
- **The row.** A fourth sort on the New lane, `bid`, with the head **Bid it?**, ahead of *Who is
  this?* in the lane's order, since the sender need not be named for the bid to start. The row reads
  *Bid it? › Dale Ferris · dale@ridgeway.example* over *Email to bids@ · yesterday*, the subject under
  it as today.
- **The card.** Its head asks about the job, not the sender: *Bid it? Oak Hill Clinic, Boerne, from
  Ridgeway Builders*. Its first line gives the facts read: *Invitation to bid · due Thu Nov 12 at 2:00
  PM · BuildLink page*. Three presses. **Start a bid** makes the bid on the GC (the customer we know,
  else a new customer from the sender's company, the card's own blocks), with the name, the ITB link
  in `bids.itb_links`, the due date on the bid's GC row, and the thread tied to it, then opens the bid
  the way **Start an estimate** opens an estimate. **Not for us** writes a grey line with the reason
  typed in a field, *Not for us · too far · Wendi · 9:40 AM*, closes the row and keeps the sender a
  customer, so their next invitation still shows. **Keep it with Dale** names the sender only, as
  today's card does, and leaves the bid for later.
- **An agency's notice** reads the same way. The agency is the customer, an owner who could send us
  plans, which is what Prospects already calls one (v2.5559). The card's words say *from Bexar County
  Purchasing* and Start a bid makes the customer the same way.
- **Who holds it.** The *Who gets a new message* rule's estimator pick holds a Bid it? row
  (`messages/hasRule.ts`), so Mine shows the estimator their invitations and the office's Mine stays
  theirs.

### 4 · An addendum lands on its bid, and the robot's first pass

- **The tie.** When the subject names a bid we are pricing (the bid's name, or its project's, the
  way a job's name ties a line today), the line lands on that bid's thread and no sort row is made.
  The bid's rail shows the addendum where the estimator works. An undecided bid's own invitation
  and its addenda then read as one story.
- **The robot.** Once pieces 1 and 2 exist, the reader marks a notice itself when the sender's
  domain is already on the left-out list or the body carries the cue, and writes it down: under New,
  a fold *3 notices set aside this week* with each row's sender and subject and **Put back** on each,
  never a delete. What it is unsure of stays a row for a person, with the notice press as the card's
  first guess when the domain has been marked once before. The fold's count is the measure of how
  much the office no longer reads.

What this does not do: it never deletes or moves a mail in Gmail, never answers a sender, and never
decides go or no-go on its own. Not for us is a person's press with a reason.

## The calls

Each row holds the recommendation the mock-up draws. Each is answered in one line.

| # | The call | Options | Recommended | Answer |
|---|---|---|---|---|
| 1 | What the notice press remembers | This address. The whole domain. Ask each time. | The address, with the domain offered as a second press when it is a company's own, never an open mail service. | |
| 2 | Where a notice's thread goes | Done and off Follow up, search still finds it. Gone from every list on Messages. A Notices kind pill. | Done and off Follow up; search and the *Who is this?* pill still find it. A Notices pill only if the fold's count asks for one. | |
| 3 | What Start a bid makes (**Wendi's word**) | A bid on the GC with the name, the ITB link and the due date, undecided. Only the GC named, New Bid left to the estimator. The bid plus the plans filed for the robots (#221). | The first. Filing plans for the robots stays a press on the bid. | |
| 4 | What Not for us leaves behind | No bid; a grey line with the reason; the sender stays a customer. A bid made and archived with the reason, so the Development page holds it. | No bid. The thread holds the reason; the next invitation from them still shows. | |
| 5 | How far the robot goes | Marks notices itself for a marked domain or a body cue, folded with Put back. Only suggests; a person presses. Off until the office has pressed the notice press ten times. | Marks itself for a marked domain or a body cue; suggests for the rest. | |
| 6 | Who holds a Bid it? row | The office, under Everyone. The estimator the *Who gets a new message* rule picks, so Mine shows it to them. | The rule's estimator. | |

## Where it plugs in

- `src/lib/emailIn/leftOut.ts` and its edge copy: the body cue (piece 2) and the left-out list
  (piece 1, a second callback beside `isTheBox`). `supabase/functions/gmail-sync/index.ts`: `takeOne`
  reads the list once per run and skips the address before `email_place_address`.
- A migration: `email_left_out_senders` (`SET lock_timeout = '3s'`; `CREATE TABLE`, so the three
  fence calls at its end), office-read, office-write through one RPC `mark_notice(p_contact_id,
  p_scope)` that writes the row, sets the thread done and writes the event line, and `unmark_notice`.
- `src/lib/followUp/newLane.ts`: the fourth guess kind `notice` on `whoGuesses`, drawn by
  `NewLaneCard.tsx`'s `WhoBody` as its last block; `newLaneCardIo.ts` calls the RPC. The desk
  (`SortAllDesk.tsx`) draws the card as it is.
- `src/lib/emailIn/invitation.ts` (new, piece 3), read in `takeOne` and kept on the line as
  `messages.invitation` jsonb (the facts, so the card never re-reads the body) or read again on the
  client from the line's body; `newLane.ts`'s fourth sort `bid` and its `bidHead`;
  `NewLaneCard.tsx`'s `BidBody`; the bid's insert through the Bids form's save path
  (`src/lib/bids/useBidEditForm.ts`) with `itb_links` and the `bid_gcs` due date; the tie through
  `tie_message`'s bid column.
- `src/lib/emailIn/subjectJobs.ts`: the bid's name beside the job's (piece 4).
- Guides: *sort new messages* gains **A notice** and **Bid it?**; *turn on reading the bids inbox*
  gains the left-out list; the lane legend's New sentence names the two.
- Docs: `MESSAGES_ARCHITECTURE.md`, `EDGE_FUNCTIONS.md` → gmail-sync, `GLOSSARY.md`,
  `docs/migrations/`.

## The PR train

1. **A notice, not a person** (M, calls 1 and 2). The table and the two RPCs, the card's block, the
   reader's skip, the undo on the thread, the guides. Push the migration right after the merge
   (the client calls `mark_notice`), then deploy `gmail-sync`.
2. **The reader reads the body** (S, no call). `leftOut.ts`'s body rule with the platform footer
   held as taken; the edge copy; deploy `gmail-sync`. Independent of PR 1.
3. **Bid it?** (L, calls 3, 4 and 6). The invitation kernel, the fourth sort, the card and its
   three presses, the bid's insert and tie, the holder rule, the guide. One migration if the facts
   are kept on the line.
4. **The addendum's tie and the robot's fold** (M, call 5). The bid's name in `subjectJobs.ts`; the
   reader marking a notice itself; the fold under New with Put back. Deploy `gmail-sync`.

PR 1 and PR 2 both touch `leftOut.ts` and `gmail-sync` and land one after the other, either order.
PR 3 waits on neither. PR 4 waits on PR 1 and PR 3.

## How to verify

- PR 1: on the made-up newsletter's thread, press **A notice, not a person**; the row leaves New
  within the panel's re-read, the thread shows the grey line, `email_left_out_senders` holds the
  address, and a second mail from it (the walk kit sends one) makes no line and no row; **Not a
  notice after all** brings the row back. Sort all walks three notices in three presses.
- PR 2: a mail whose body carries an unsubscribe line and no list header is left out and
  unlabelled; a platform's invitation with its footer is taken. The kernel's tests hold both.
- PR 3: the walk kit's invitation lands as *Bid it? ›*; **Start a bid** makes the bid on the kit's
  GC with the link and the due date and opens it; the thread sits on the bid; **Not for us** writes
  the line with the typed reason and closes the row; Mine shows the row to the estimator's seat.
- PR 4: an addendum whose subject names the kit's bid lands on the bid's thread with no row; a
  mail from the marked domain shows under the fold with **Put back**, and Put back makes it a row.
- Every one: nothing in Gmail changed, by the box's label count on the Email station.

## Where it stands

- 2026-10-30: written from Taunya's look at New and the code, as PR #6601. Nothing of the four
  pieces is built. Waiting on the six calls, 3 with Wendi's word.
- 2026-10-30: the row these pieces build on went into the merge queue the same evening as v2.6191
  (PR #6595). On New the sort's question sits before the name, and the address or the number the
  line came from sits after it. The mock-up's *Bid it?* rows draw that shape. At Taunya's ask the
  card carries both PRs on the punch list: the version chip names PR #6595 and PR #6601, and the
  card's history link lists PR #6601 once it merges.
