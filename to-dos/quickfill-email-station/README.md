---
name: "Quickfill Email station: the live inbox, not the retyped list"
number: 159
group: ready
status: the owner's yes 2026-10-24 ("build it all", the recommendations taken) · PR 1 v2.5814 (kernels + migration), PR 2 v2.5820 (the gmail-count function) PR 3 v2.5824 (the two Settings cards) and PR 4 v2.5827 (the station) in the queue; PR 5 next; the Google admin step is the owner's before the switch goes on
summary: >
  The Email station is three free boxes and a mark. Its history shows the same six emails retyped
  every morning for a week, and the station cannot tell that nothing moved. The app already reads
  Gmail as bids@ and the team box under the Workspace delegation, so the station can read Gmail's
  own state instead: for each box the office names and each label (Inbox, Follow Up, Next
  Actions), the live count, the oldest thread's age, the threads sitting past the limit with the
  day they arrived and a door into Gmail, what moved since the last look, and a Looked that saves
  the live list as the note. The same read, under a metadata-only scope, can count a teammate's own
  labels; who is counted and who sees it is the owner's list, said on the station.
next: PR 5, the trend in the history window; the owner's Google admin step (below) before the first live sweep.
size: M as a train of five (S · M · S · M · S); one migration, one new edge function, one Google admin step for the metadata scope
blocker: The five-minute Google admin step before the first live sweep (with PR 2).
ver: v2.5814 · 5820 · 5824 · 5827
opinion: build B over the delegation with the metadata-only scope — the key already reaches every mailbox on the Workspace, so the honest control is the app's own list and the words on the station, not a consent screen asking for a yes the admin already gave; start with the two shared boxes and one person
---

# Quickfill Email station: the live inbox, not the retyped list (#159)

## The ask

The owner, 2026-10-24, with a screenshot of the station in Roller view and its Mark history
window open:

> in quickfill as well taking a look at the email history how could we improve this card to be
> more useful. the primary function of quickfill is to stop things from falling through the
> cracks. since we have a helper capable of seeing org wide emails perhaps we could expose parts
> of individual users inboxes? if we did we would be able to track emails in those inboxes. can
> you take a deep and holistic look at this section and let me know what you think?

This is a proposal, not a build. Nothing here is built until he picks.

## Today

The station ([`QuickfillEmailSection.tsx`](../../src/components/quickfill/QuickfillEmailSection.tsx),
v2.2185) is the banner *Are my work@ and bids@ inboxes clean?*, a count line *0 open · last look
23h ago · Taunya*, and three rows, each a label, a door and a free box: **Inbox** (*Open Gmail →*,
*Still in inbox — one per line, or free text*), **Follow Up** (*Open label →*), **Next Actions**
(*Open label →*), then **Mark Email up to date!**. The mark refuses an empty note. The note it
saves is the rows joined with their labels, and the station's count is the number of lines
typed. In the Roller the bar reads *Mark inside · next →* because the station is in the
note-first set (`QUICKFILL_NOTE_FIRST_SECTIONS` in [`round.ts`](../../src/lib/quickfill/round.ts)).

The history window shows what the station really is. Read live on 2026-10-24: five marks, one a
morning, all by the same person, 6 · 8 · 7 · 7 · 6 open items, and a Note column holding the same
hand-typed list five days running, three of the Inbox items, both Follow Up items and the Next
Actions item word for word, with one or two new names drifting through the middle. So:

- The same emails sat for a week. Nothing on the station says so. The person retyped them each
  morning and the station counted the typing.
- The count is lines typed, not emails. A morning with a short note reads as a clean day.
- The station cannot say what is new, what cleared, or how old the oldest is. That is the crack
  it exists to catch, and it is blind to it.
- The three doors open Gmail for whoever is signed in, so a second person opening the station
  lands in their own Inbox, not work@'s or bids@'s.
- Everything true about the mail is in Gmail already: which threads are in the Inbox, which carry
  the label Follow Up, when each arrived. The station asks a person to copy it by hand.

## What the reader can see

The app already reads Gmail. `gmail-sync` ([`supabase/functions/gmail-sync/index.ts`](../../supabase/functions/gmail-sync/index.ts),
[`docs/EDGE_FUNCTIONS.md`](../../docs/EDGE_FUNCTIONS.md) → gmail-sync, [`docs/MESSAGES_ARCHITECTURE.md`](../../docs/MESSAGES_ARCHITECTURE.md) → The channels) runs every
minute while **Read bids@** is on (Settings → Phone and texts). It takes a Google access token for
the Drive service account ([`docs/DRIVE_INTAKE_SETUP.md`](../../docs/DRIVE_INTAKE_SETUP.md)) with `sub` set
to a mailbox's address ([`_shared/googleToken.ts`](../../supabase/functions/_shared/googleToken.ts)), reads that mailbox's new
Inbox mail through Gmail's history, and lands each email on its sender's thread in Messages with the
label *In ClickTooling*. The boxes it reads are [`readerBoxes.ts`](../../src/lib/emailIn/readerBoxes.ts):
bids@ and the team box typed in Settings → Phone and texts → Inboxes. Both are live: the card read
*Last read today at 9:07 AM. Nothing wrong.* for each on 2026-10-24.

**What makes that possible is domain-wide delegation**, granted once in the Google Admin console:
the service account's client id with the scopes `gmail.readonly` and `gmail.modify`. Delegation is
domain-wide by name. It lets the key act as **any user on the Workspace**, not only bids@. Nothing
but the code stops the reader from reading a teammate's mailbox today. That is the fact under the
owner's question, and it cuts both ways: reading a person's Inbox is a token call away, and the
only real control over it is the app's own list of who is read and what is shown.

### The two ways to read a person's mail

**1. The delegation the bids@ reader uses, as that person.** `googleServiceToken(saJson, scopes, person.email)`,
the address from `users.email`. No per-person setup, no password, nothing for the person to press.

- Scopes. The station needs labels, counts, thread ids, senders, subjects and dates. Gmail has a
  scope for exactly that and no more, `https://www.googleapis.com/auth/gmail.metadata`: Google
  itself refuses a message body or an attachment under it, and refuses the `q` search parameter,
  so the sweep lists by label id, which is all it needs. Adding that scope to the delegation row
  is one admin step (Admin console → Security → Access and data control → API controls → Manage
  domain-wide delegation → the client → add the scope). Or the sweep asks for `gmail.readonly`,
  already granted, and the "never the words" promise is the code's alone. The pick is the owner's;
  the recommendation is the metadata scope, so the promise is Google's.
- `readerBoxes.ts` stays as it is. It is the list of boxes the *taker* reads: it writes lines,
  copies files and puts a label on. The station's read is a different walk that writes nothing to
  Gmail, so it gets a sibling kernel, `countedBoxes.ts`: the two shared boxes (from the same
  settings) plus each row of a new table `email_box_watch` (a person, their address, the labels
  they name, on or off), each box with its own token and its own try, so one box failing leaves
  the rest counted.
- Limits. A Google Group or an alias cannot be impersonated (the reader's header says so already).
  An address on another Workspace fails at the token exchange. Both land as that box's
  `last_error` and the station says *The app cannot read this box: …*.

**2. Each person connects their own Gmail once**, in Settings → Your account, through Google's
consent screen. The app gets a refresh token for that person alone, under scopes the person saw.

- What it takes: an OAuth client in the same Cloud project, a consent screen set to **Internal**
  (a Workspace-only app needs no Google verification, even for Gmail's restricted scopes), a
  `gmail-connect` function for the redirect that trades the code for tokens, the refresh tokens in
  the vault (as `quo_api_key` is), a refresh on each sweep, and **Disconnect** that revokes the
  token at Google and deletes the row. The sweep itself is the same code as way 1 with a different
  token.
- What it buys: the person's own yes, in Google's words, and a revoke that is theirs. What it
  costs: five more moving parts, a token that dies when the admin resets the person's password,
  and a yes that the Workspace admin already holds anyway, since the delegation reaches the same
  mailbox whether or not the person presses.

Both ways read the same thing the same way. The difference is who said yes and where the key
lives. For company mailboxes on the company's Workspace the recommendation is way 1 with the
metadata scope, the owner's list of who is counted, and the words on the station.

### What one sweep does, per box

1. `labels.list` (1 unit) finds the label ids by name. `INBOX` is a system label; *Follow Up* and
   *Next Actions* are the person's own, matched by exact name, then case-blind. A name with no
   label is written as missing, the station says so, and the other labels still count.
2. Per label, `labels.get` (1 unit) gives `threadsTotal`, the live count, exact even for a
   4,000-thread Inbox.
3. Per label, `threads.list` with `labelIds` (10 units a page of 100), newest first, up to three
   pages. A thread the table already holds needs nothing more. A new one takes `threads.get` with
   `format=metadata` and the headers From, Subject and Date (40 units): the first message's date
   is the day it arrived, the last message's date its last activity. Beyond three pages the count
   stays exact and the list says *300 of 4,120 listed*.
4. The table's rows for this box and label that the list did not return are marked gone, with the
   time. That is what *cleared* means.
5. One row per box, label and day keeps the count, the oldest age, the new and the cleared, so
   the history has a line for a day nobody looked, which is the day that matters.

A clean box in steady state is seven calls and about 40 units, under two seconds. The first sweep
of a 40-thread box is about 1,700 units and ten seconds. Gmail's limits (its quota page, read
2026-10-24): 6,000 units a minute per user, 1,200,000 a minute per project, 80,000,000 a day
before any charge. Six boxes swept every 15 minutes is under 60,000 units a day, under a tenth of
a percent of the day's threshold. Quota is not a cost here.

### The honest costs

| Cost | What it is |
|---|---|
| A Google admin step | Adding `gmail.metadata` to the delegation row, five minutes as the Workspace admin. None if the sweep reuses `gmail.readonly`. Way 2 instead needs an OAuth client and an Internal consent screen in the Cloud project. |
| Tables | `email_box_watch` (who is counted: a person, the address, the labels, on or off, who added them), `email_box_threads` (one row per thread seen in a counted label: box, label, Gmail thread id, arrived, last activity, sender name and address, subject, first and last seen, gone at), `email_box_days` (box, label, day, count, oldest days, new, cleared). RLS per the stance below. One migration with the three fences. |
| A new edge function | `gmail-count`, a cron every 15 minutes while its switch is on, plus **Read again** from the station for one box with a one-minute floor. Deployed by hand, its own `docs/EDGE_FUNCTIONS.md` section, the kernels mirrored by `gen:edge-kernels`. `_shared/gmail.ts` gains `gmailLabels`, `gmailThreadsByLabel` and `gmailThread` (metadata). |
| Run time per box | Steady state under two seconds; the first sweep of a busy box about ten. The function sweeps boxes one after another, so eight boxes is well inside a run. |
| A label that does not exist | The row reads *No label named Follow Up in work@ yet. Make it in Gmail, or pick another label.* with a door to Gmail's labels page. Nothing errors; the box's other labels still count. |
| A box the key cannot read | A group, an alias, an address off the Workspace: its row says so, with Google's reason, and every other box reads. |
| The Gmail door | A thread link under a box's address (`authuser=`) opens when the browser is signed into that account. For a box a person reads only as a Gmail delegate, the door opens their own Gmail's search for the subject. |
| What it never does | Files, archives, labels, deletes or marks read a single message. Reads a label the person did not name. Keeps a body or an attachment. |

## Options

[`mockup.html`](./mockup.html) beside this file, served at `/to-dos/quickfill-email-station/mockup.html`:
today, the three options, the pick on a desk, on a phone and in dark, its history window, the two
Settings cards and the critique. Every name, box and subject there is made up.

### A · Lanes, not Gmail

Keep the three boxes. Above them, one line per shared box from Messages, which the bids@ reader
already fills: *bids@ · 2 need a reply · 1 we owe →*, the counts the Dashboard's Needs you reads
today. Messages' Follow up lanes become the station's count.

- Cheapest. No Gmail read, no table, no admin step. An afternoon.
- But the lanes answer a different question. *Needs a reply* is a conversation nobody answered;
  the Inbox is what a person has not filed. An email answered yesterday still sits in the Inbox
  until it is archived, and the station would call it clean. Follow Up and Next Actions are the
  person's labels, which Messages never sees, so those two rows stay hand-typed and the history
  stays a retyped list. Half the crack.

### B · Live labels, per box and per person — the pick

The station reads Gmail's own state. For each box it counts, the shared ones first and then *Your
mail* for the signed-in person when they are on the list, one row per label: the label with its
live count, the oldest thread's age, and under it the threads sitting past the limit (the owner's
number, three days to start), each with the day it arrived, the sender, the subject and
**Open in Gmail →**. One line says what moved since the last look, *+1 new · 2 cleared · 4 still
here*. For the shared boxes a quiet line adds what Messages knows, *2 need a reply →*. The count
line becomes *7 open · 3 past 3 days · read 4 min ago · last look 23h ago · Taunya*.

The mark is the Roller's green **Looked · 7 open · next →**, since the count is live and the note
writes itself: the list the person looked at, label by label, with ages, so the history keeps the
names of what sat. A one-line box, *A word about these*, stays for the human's sentence and is
optional. The station leaves the note-first set.

Under it, in plain words: *Counts work@, bids@ and Marisol's Inbox, Follow Up and Next Actions.
Senders, subjects and dates only, never the words. Marisol's rows show to Marisol and Dale.* with a
door to Settings.

- The station can finally say the thing it exists to say: *this has sat nine days*.
- The person stops retyping. The morning look is a read and a press.
- Costs the table, the function, the admin step and the stance below.

### C · Counts only, no names

B's sweep, but the table keeps thread ids and dates only, never a subject or a sender. Each label
row shows the count, the oldest age and the since-last-look numbers; the stuck threads are a count
with a door, and the person types what they are if they want to.

- The tightest stance: nothing in the app names a person's email.
- But the crack has no name. *3 past 3 days* sends the person back to Gmail to find which three,
  and the history can say a thread sat nine days without saying which. For the two shared boxes,
  whose mail already lands in Messages with its subject, this hides what the app already shows a
  room away.

**Rejected:** a smarter free box that remembers yesterday's lines and lets the person tick them
off. It is still a person copying Gmail by hand, and the day the person is out, the station knows
nothing. Also rejected, for now: Gmail's push (`users.watch` and a Pub/Sub topic renewed every
seven days) in place of a sweep. Live to the second is more than a morning station needs, and it
is three more parts to keep alive.

## The privacy stance

The same on every way and every option, and said on the station, not only here:

- **Only the labels the person names.** Inbox, Follow Up and Next Actions to start; a person adds
  or drops a label in Settings → Your account. The sweep lists by those label ids and nothing
  else. Sent, Drafts, Spam, Chats and every other label are never read.
- **Subjects, senders, dates and ages. Never the words.** Under the metadata scope Google refuses
  a body; under option C not even the subject is kept. No attachment is ever fetched.
- **A person's rows show to that person and to the lead the owner names**, and to no one else on
  the station. The two shared boxes show to the office team, as Messages does. Whether the owner
  himself sees every person's rows is his to say (decision 2); the recommendation is that he names
  the lead and sees what the lead sees.
- **The station says what it counts and who sees it**, in one sentence under the rows, every time
  it is drawn, with a door to the setting.
- **It writes nothing to Gmail.** No label, no archive, no read mark. The bids@ reader's *In
  ClickTooling* label is the taker's and stays on the shared boxes alone.
- **A person who is off the list has nothing in the tables**, and turning a person off marks their
  rows gone and stops the sweep for them the next run. Deleting them from the list deletes the rows.

## Decisions for the owner

1. **How the app reads a person's mail.** The reader's delegation, as that person, with the
   metadata-only scope added in the Admin console (recommended: one admin step, nothing for the
   person to press, Google holds the "never the words" promise); or each person's own **Connect
   Gmail** press in Settings → Your account (their yes, five more parts, and a yes the admin's key
   already has).
2. **Whose mail, and who sees it.** The owner names the people whose labels are counted and the
   one lead who sees everyone's rows. Each person sees their own. Does the owner see all of them,
   or only as the lead? And may a person switch their own row off? Recommended: start with the two
   shared boxes and one person; the owner names himself or an office lead; a person may switch
   off and the owner sees that they did.
3. **work@, smaller.** The reader has two slots and both are filled: the team box (`team@…`) and
   bids@. work@ is read by nobody but the person who opens it. The station's sweep counts work@
   either way, since any mailbox on the Workspace is a box it can count. Whether work@'s mail
   should also *land in Messages threads* is a different question: if customers write to work@,
   the Team inbox's address in Settings → Phone and texts becomes work@ and the reader follows with
   no code; if work@ is something else, it needs a third slot in `readerBoxes.ts` and the
   `Mailbox` union, a build of its own. Recommended: count it now, decide the slot when he says what
   work@ is for.

## Where it plugs in

Exists:

- [`QuickfillEmailSection.tsx`](../../src/components/quickfill/QuickfillEmailSection.tsx) and its
  test; the station's wiring in [`Quickfill.tsx`](../../src/pages/Quickfill.tsx) (`email-inbox`,
  `markSectionUpToDate` with `noteText`, the metric through `useReportQuickfillSectionMetric`);
  the note-first set in [`round.ts`](../../src/lib/quickfill/round.ts); the banner in
  [`sectionBanners.ts`](../../src/lib/quickfill/sectionBanners.ts).
- [`QuickfillSectionMarkHistoryModal.tsx`](../../src/components/quickfill/QuickfillSectionMarkHistoryModal.tsx),
  reading `quickfill_section_mark_events` (`marked_at`, `outstanding_count`, `note_text`, the
  marker's name).
- The Gmail side: [`gmail-sync`](../../supabase/functions/gmail-sync/index.ts),
  [`_shared/gmail.ts`](../../supabase/functions/_shared/gmail.ts) (`GMAIL_SCOPES`, the calls),
  [`_shared/googleToken.ts`](../../supabase/functions/_shared/googleToken.ts) (`sub` = the box),
  [`readerBoxes.ts`](../../src/lib/emailIn/readerBoxes.ts), `gmail_sync_state`, the switch
  `gmail_sync_on_v1` and its card [`EmailReaderSettingsCard.tsx`](../../src/components/settings/EmailReaderSettingsCard.tsx),
  the Inboxes card [`BoxesSettingsCard.tsx`](../../src/components/settings/BoxesSettingsCard.tsx)
  over `messages_boxes_v1`.
- Messages' lanes and their counts, which the Dashboard's and Quickfill's Needs you already read
  ([`needsYouSources.ts`](../../src/lib/needsYouSources.ts), `gcFollowUp`); `users.email` for a
  person's address; `is_master_or_dev()` and `gc_office_team()` for the policies.

New, in the recommended build:

- Kernels `src/lib/emailIn/countedBoxes.ts` (the boxes to count) and `src/lib/emailIn/labelFacts.ts`
  (threads to rows: arrived, age, past the limit, new · cleared · still since a point, the note the
  mark saves, the missing-label words), each with its test; `src/lib/quickfill/emailStation.ts`
  (the station's model from the rows) and `emailStationIo.ts`.
- Migration: `email_box_watch`, `email_box_threads`, `email_box_days`, their policies (a person's
  rows to the person, the lead and the owner as decided; shared boxes to the office team), the
  switch `email_count_on_v1`, the lead and the limit as `app_settings` keys, the cron row posting
  only while the switch is on, the three fences.
- Edge function `gmail-count` with its section, and the three Gmail calls in `_shared/gmail.ts`.
- Settings: **Mail the app counts** under Phone and texts (the switch, the limit in days, the
  people, the lead, each box's health) for the owner and a dev; **Mail Quickfill counts** under Your
  account (the labels, the words, Off for me if allowed).
- The station redrawn, the history window's trend body, the guide `quickfill.md`'s Email words,
  `docs/QUICKFILL_ARCHITECTURE.md`, `docs/MESSAGES_ARCHITECTURE.md`, `docs/EDGE_FUNCTIONS.md`,
  `docs/ACCESS_CONTROL.md`, `PROJECT_DOCUMENTATION.md`.

### The PR train, B over the delegation

1. **PR 1 · S** — the kernels and the migration. `countedBoxes.ts`, `labelFacts.ts`, tests; the
   three tables, policies, fences, switch, keys, cron row (switch off); the migration page; types.
2. **PR 2 · M** — `gmail-count`, the Gmail calls, `GMAIL_METADATA_SCOPES`, mirrored kernels, the
   docs section; deployed. The admin step happens before the switch goes on, and the first sweep
   is the two shared boxes alone.
3. **PR 3 · S** — the two Settings cards. The owner adds the first person; the person sees their
   card and the words.
4. **PR 4 · M** — the station over the facts: the rows, the since-last-look line, the Messages line
   for the shared boxes, the Gmail doors under the box's address, Looked with the composed note, the
   words under the rows; out of the note-first set; the guide.
5. **PR 5 · S** — the history window's trend body for this station, over `email_box_days` and the
   marks, in the per-station slot #156's redraw of the window is drawing.

Way 2 instead swaps PR 3 for an M: the OAuth client and consent screen, `gmail-connect`, the
vault rows, **Connect Gmail** and **Disconnect**; PRs 1, 2, 4 and 5 are the same.

### Shared with the two sibling proposals

- **#156, the Mark history window:** this station wants a per-station body in the window (a trend
  over weeks, not the rows) under the generic rows; the slot is theirs to draw, the body is PR 5
  here. The composed note means a plain-text history still reads, so neither blocks the other.
- **#157, the Texts station:** the *what Messages knows* line (a box's lane counts with a door) is
  one small kernel both stations can read; whichever ships first owns it, and the other imports
  it. The Texts station has the same retyped-note shape, and the same cure, since every text is
  already a line in Messages.

## Is this the best we can do, are we being straightforward

- **Does it catch the crack?** Yes, by name and by age: *Harlan Freight — W-9, arrived Oct 14, 9
  days*, on the day nobody looked as well as the day someone did. Today's station cannot say that
  on any day.
- **Is the read honest about what it can see?** The delegation can read every mailbox on the
  Workspace already. The proposal does not pretend otherwise. It narrows the read by scope (Google
  refuses the words), by list (the owner's), by label (the person's) and by audience (the person
  and the lead), and says all four on the station.
- **Why not ask each person?** Because the admin's key already has the yes, and a consent screen
  would suggest a choice that is not there. If the owner wants each person's own yes anyway, way 2
  is drawn and costs five parts, not a redesign.
- **Why Gmail's labels and not Messages?** Messages knows conversations and who owes whom. The
  Inbox is a person's own filing surface, and *not yet filed* is a different fact from *not yet
  answered*. The station shows both and says which is which.
- **Why a sweep and not a push?** A morning station needs this morning's truth, not this second's.
  Fifteen minutes and a **Read again** press are enough, and two fewer things can break.
- **What stays by hand?** One optional sentence. The limit in days is the owner's number, not a
  guess per label.
- **What does not change?** The mark, the round, the rhythm and the history table. The station
  keeps its id, so every past mark stays in its history.

## How to verify, once built

As the dev, `/quickfill?view=roller&station=email-inbox`. With the switch off the station is as it
is today. Switch on with the two shared boxes: within a minute the rows fill with live counts and
the oldest age; the count line reads *read N min ago*. Add a label the box does not have in
Settings and the row says so, the others still counting. Add one person: their rows appear for
them and the lead and for nobody else (View as a third office member shows the shared boxes
alone). Archive one stuck thread in Gmail and press **Read again**: it moves to *cleared*. Press
**Looked**: the history row carries the composed note. Light and dark, desktop and phone, and the
Gmail door under the box's address. Nothing in Gmail changes: no label, no read mark.

## The admin step, the owner's, before the switch goes on

The counter asks Google for the `gmail.metadata` scope, which the service account's delegation row
does not hold yet (it holds `gmail.readonly` and `gmail.modify` for the bids@ reader). Five minutes
as the Workspace admin:

1. admin.google.com → **Security** → **Access and data control** → **API controls** → **Manage
   domain-wide delegation**.
2. Find the row of the service account `gmail-sync` uses (the Drive intake account,
   `docs/DRIVE_INTAKE_SETUP.md`; its client id is the row's name) → **Edit**.
3. Add `https://www.googleapis.com/auth/gmail.metadata` beside the two Gmail scopes already
   there → **Authorize**.
4. Tell the session; then the switch on Settings → Phone and texts → **Mail the app counts**
   (v2.5824) goes on and the first sweep reads the shared boxes on the list.

Until the step is done every box fails at the token exchange with Google's `unauthorized_client`,
which the card shows as that box's error, and nothing is read.

## Where it stands

Proposed 2026-10-24 from the live station and its history, the Gmail reader's code and docs, and
the Settings page as it read that morning (both shared boxes being read, nothing wrong). Nothing
built, no version claimed. Waits on decisions 1 and 2; decision 3 can wait for the owner to say
what work@ is for. Sibling proposals the same day: #156 (the Mark history window), #157 (the Texts
station) and #158 (the Physical inbox station).
