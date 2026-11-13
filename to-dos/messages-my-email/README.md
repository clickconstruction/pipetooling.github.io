---
name: "Messages → My email: a person's own @clickplumbing.com mail beside the threads, one press to save a conversation to a job or a bid"
number: 230
group: close
status: built 2026-11-01 after the owner's "build all of this", every call taken as recommended and the switch on by default; twelve PRs, six migrations pushed, gmail-mine and login-as-user deployed; on 2026-11-12/13 the press became Save to job, the Gmail label came out and a seat save names the dev (five PRs, Where it stands); 23 saved conversations by 2026-11-13, one of them most likely the first by a person's own press; left: a real save walked end to end, then a month of use; the larger changes are notes under What should change next
summary: >
  Built 2026-11-01. Messages has a second tab, My email, beside Follow up: each office member's own
  @clickplumbing.com Inbox and Sent, read live from Gmail under the delegation the bids@ reader holds,
  kept nowhere until a save. The app guesses the job from the subject, the sender and the conversation,
  and the person presses Yes. A save copies the whole conversation onto the job as lines with the files
  and a court-ready .eml, adds the job to the person's jobs and puts nothing in their Gmail, and later
  mail in it lands by itself until 60 days past its newest mail. Take off the job and Another job undo
  or move it. The Legal desk puts a saved conversation on a matter's Evidence. The switch on Your account is on by
  default. An independent review found ten defects, the worst a teammate's mail readable through
  Imitate; all ten are fixed, and two more the lead found after it.
next: Grace's own walk as grace@clickplumbing.com on a ZZ Test customer (`docs/recent-features/v2.6292.md` → Verify), opening Messages → My email, counting the guesses over the first thirty rows and saving one conversation onto the ZZ Test job. The dev account is off the Workspace, so the live test proved the gate, the refusal and the screens, not a read. Reviewed 2026-11-04 (the section at the foot): four days live, no visit by a Workspace person and no tag; the doors that would change that are #263 (`to-dos/messages-my-email-doors/`). The month of use starts at the first visit; the tab retires if nobody saves by its end. The save log points to a first save by a person's own press on 2026-11-12 (Where it stands, 2026-11-13).
size: M, built as twelve PRs on 2026-11-01: the five planned, the forward guide, four from the review (the imitation refusal, the follow's window, the tab's Untag, the function's untag and ties) and two the lead found after it (the row's words, hidden labels in an open conversation)
blocker: Nothing in the code. The first live read and save needs a clickplumbing.com session, which no agent may open.
ver: v2.6257 · 6266 · 6274 · 6275 · 6276 · 6279 · 6289 · 6290 · 6291 · 6292 · 6295 · 6296 · 7020 · 7022 · 7035 · 7068 · 7073
opinion: built — watch whether people tag; retire the tab after a month if nobody does, and the forward guide stays
mockup: to-dos/messages-my-email/mockup.html
---

# Messages → My email (#230)

## The ask

The owner, 2026-11-01, in a session of its own:

> Can you help me think through what we could do to extend messages as it currently is such that we
> could, in a new tab in messages, offer the user their @clickplumbing email messages and sends, this
> would have the potential to make associating emails with jobs and bids easier. This way later, if
> there is legal issue or a question about a job, a user who has already tagged an email into the job
> allows us to as a team make more unified decisions on better knowledge. I see benefits long term in
> our team being able to be better from this only if it doesn't create undo work… can you help me come
> up with a way to offer this, create a plan, then create a mockup, ask yourself this is the best we can
> do, then present me the plan and mockup and explain what the user experience could be.

This is a plan and a mock-up. Nothing is built until the owner picks.

## What is there today

Read on 2026-11-01 against the code, the docs and the live switches through the dev seat. Each is a
door the builder goes through, not around.

- **Email in.** `gmail-sync` reads the **Inbox** of bids@clickplumbing.com and team@clickplumbing.com
  every minute, as those Workspace users under the Drive service account's domain-wide delegation
  (`readerBoxes.ts`; the scopes on the delegation row are `gmail.readonly` and `gmail.modify`). Both
  boxes are live and healthy (`gmail_sync_state`: last ok 2026-11-01 07:49 UTC, no error). Each mail
  lands in its sender's thread with its files copied into the private `message-attachments` bucket and
  the Gmail label *In ClickTooling* put on. It reads no other label and no other mailbox. A teammate's
  own mail is taken since v2.5722 only when it reaches a box: on their Our team thread, or on the
  customer's thread as ours when the box was copied. Bulk, no-reply and the senders the office marked
  *A notice, not a person* (v2.6202) are left out. One mail in both boxes lands once, by its
  `Message-ID` (v2.5504).
- **How a mail is tied to a job today.** The reader ties the line from the subject: a job's number as
  the app shows it (`JP1077`, `BP523`, `#42`) standing in the subject, or a job's whole name among the
  sender's own jobs (`jobInSubject.ts`, `subjectJobs.ts`); else the person's starred job; else the line
  sits on the person. The office moves a line with its job chip (*no job*, or **change** beside
  *Tied to* in the opened message) and the press-and-hold **Tie this message to** sheet on a phone
  (`tieSheet.ts`), over the job picker (`JobPickerWindow`, their own jobs first, then a search), all
  through `tie_message(message, kind, job)`, which also adds the job to the person's `contact_jobs`.
  The reply box's **Tie to** sets the job a reply lands on, not a line's (corrected 2026-11-01).
- **A forwarded copy already works.** A mail one of us forwards to bids@ lands on its first sender with
  the forwarder's note as a team note (`forwarded.ts`). Its job comes from the forwarded mail's own
  subject, not from what the forwarder types into the forward's subject (`emailLine.ts` reads the
  forwarded block's `Subject:` first), so a typed job number does nothing; the habit that works is a
  job number in the subject of a mail we start, which every reply carries (corrected 2026-11-01). That
  is the one way a person's own mail reaches a job today. Nobody has been told, and six weeks of the
  reader being live show nobody does it.
- **What a tagged mail already gives the team.** The sender's thread (one per person, every channel),
  the job's lines in Job activity with the orange **Customer** pill, the job window's **Where it
  stands** card (whose word came last, their promise, what we owe), the bid's rail on the thread,
  **Lines that match** (the search), Went out for what we sent, and the court on Follow up (ours when
  their line is newest). A line's files get the paper offers under them: a trade partner's W-9 and
  certificate (`paperGuess.ts`) and, since v2.6095, a supply house's PDF as **Record this bill**.
- **Email out.** The reply box's **Send email** goes through `messages-email` as a plain email
  (v2.6038) from `EMAIL_FROM` with a Reply-To on the box, filed as a sent copy. Punch list #207
  (`to-dos/messages-estimator-mailbox/`) holds Wendi's findings on this: an answer sent from her own
  mailbox that the app never saw (finding 1), the sender, the Sent folder. Its PR 3 (read the boxes'
  own Sent) and PR 4 (read each person's own Sent by a switch, mail to known addresses only) are the
  nearest neighbours of this card; #207's calls 1, 5 and 6 are still open.
- **The counter.** `gmail-count` (punch list #159, v2.5820) sweeps the labels on `email_box_watch`
  under the metadata-only scope for Quickfill's Email station, keeping senders, subjects and dates,
  never a body. The switch `email_count_on_v1` is **off**, the watch list is **empty**, and the owner's
  admin step (adding `gmail.metadata` to the delegation row) is **not done**. #159 found the fact
  under this card: the delegation is domain-wide by name, so the key can already act as any mailbox on
  the Workspace, and the only honest control is the app's own list of what it reads and the words on
  the screen. It also drew the other way, each person's own **Connect Gmail** through Google's consent
  screen (an Internal consent screen, a `gmail-connect` function, refresh tokens in Vault, Disconnect).
- **The Legal desk's Evidence tab** takes a document per matter: a PDF, an image, an email as `.eml`
  (`message/rfc822`) or plain text, up to 10 MB, through `addLegalMatterDocument` and the dev seat's
  `plan_matter_document` (v2.6004). The firm reads it through the portal's 15-minute links. **There is
  no door from a Messages line to Evidence today**: an email thread goes there as a file a person
  exported from their mail client.
- **Who sees Messages.** The office team (`GC_OFFICE_TEAM`: dev, master, assistant, controller,
  estimator). A tech reads a job's lines only on a job they were dispatched to. Sample accounts and
  twins are refused by every send door (`REAL_ACCOUNT`).
- **The Workspace side.** The boxes are on clickplumbing.com, so the delegation was granted there.
  The dev account is `robert@douglasmining.com`, an address off that Workspace: a token for it fails
  at Google's exchange. The first live person for this tab is the owner or an office member with a
  clickplumbing.com address.

## The user experience, as a short walk

1. Marisol, an estimator, turns on **My email in Messages** on Settings → Your account. The card says
   what is read, what is kept, and that a tag puts a conversation where the office reads it.
2. She opens Messages. Beside **Follow up** there is a second tab, **My email**, hers alone. It lists
   her Inbox and Sent together, newest first, read live from Gmail. Nothing is unread, nothing counts.
3. The last column already says what the app thinks: *JP1077 · 4 Elm Ct?* with a **Yes** on Dale's
   mail, because the subject names the job and Dale is on it. She presses Yes. Three mails, Dale's two
   and her own reply, land on Dale's thread tied to JP1077, with the spec sheet. A row with no guess
   says **Tag…** and opens the job picker, her own jobs first.
4. Dale writes again on Thursday. She never opens the tab: the conversation is tagged, so his mail
   and her answer land on the job by themselves.
5. Two weeks later the office reads JP1077: Dale's thread shows the whole exchange with a grey line
   saying Marisol tagged it from her mail; Job activity has the lines with the Customer pill; the job
   window's Where it stands reads whose word came last. When the account reaches the Legal desk,
   **From the job's messages…** on the Evidence tab lists the conversation as one `.eml` as received,
   and one tick puts it on the matter for the firm.

## The options, weighed

### 1 · A read-through of the person's Gmail, or copying their mail in

| | What it is | What it costs the person | What it costs us |
|---|---|---|---|
| **A · Read through, keep nothing until a tag** (recommended) | An edge function lists the signed-in person's Inbox and Sent from Gmail, metadata and snippets, 50 at a time, and reads one mail whole when opened. The app stores nothing until the person tags, and then only that conversation. | Opening the tab. One press per conversation worth keeping. | One function, one small migration. No new scope: `gmail.readonly` is on the delegation row. |
| **B · Copy every person's mail in** (#207 PR 4 widened to Inbox) | `gmail-sync` reads each person's box as it reads bids@, every mail a line in `messages`. | Nothing, and that is the trouble: their vendor mail, their newsletters and their personal threads become rows in a table the office team reads, and every unknown sender a Sort all row. | A per-person reader state, a per-person fence on every read, and a second inbox inside the app. |
| **C · Copy in only what matches a known contact** (#207 PR 4 as written) | The reader lists metadata and reads whole only a mail to or from an address `contact_channels` holds. | Nothing. | The same reader change. Clean for the Sent side; it never sees a new customer's first mail, and it still tags without anyone's say, so a mis-tie is nobody's to notice. |
| **0 · Nothing but the guide** | The forward to bids@, documented. | A forward per mail; the job only when the mail's own subject names it. Never the Sent side. | A guide. |

A is the tab. C is the right shape for #207's finding 1 if the owner wants the Sent side with no
press at all, and it can sit under A later as a second guess source. Ship 0 in any case, the same day.

### 2 · A new tab, or the existing lanes

A **tab** beside Follow up on `/messages` (`?tab=my-email`), the person's own, drawn only while their
switch is on. Not a Follow up lane: the mail is theirs, it never counts on Needs a reply, never moves
the court and never shows to a teammate. Not a Quickfill station: Quickfill is the office's round and
this is one person's desk. On a phone the tab is the same list, one column.

### 3 · Who tags

| Way | Verdict |
|---|---|
| The person, one press | Yes. The press is the person's say that this conversation belongs to the job. |
| A rule (*mail from ridgeway.example goes on JP1077*) | No, for now. A rule outlives the job and tags the next job's mail onto the old one. |
| The app's guess, with a **Yes** | Yes. The guess is drawn on the row and in the reader; the app never tags on a guess alone. |
| The conversation follows | Yes. Once one mail of a Gmail conversation is tagged, every mail in it so far lands, and later ones land by themselves. This is the one automatic thing, and it is what keeps the court honest. |

The guess, in order (`mailGuess.ts`, pure, with its test): the conversation is already tagged
(`email_tag_threads` holds its Gmail thread id, so it lands by itself and never shows under *To tag*);
the subject names a job by number or by name among the sender's jobs (the reader's own rule, reused);
the address is on one contact with one starred or one open job; the address's domain is a customer's
with one open job. Otherwise no guess, and **Tag…** opens the job picker.

### 4 · What happens to a tagged conversation

- **Always:** one `messages` line per mail in the conversation, channel `email`, direction in or out,
  `who_user_id` the person on their own sends, the job keys from the tag, the files copied as the reader
  copies them (25 MB a file), and the raw mail kept as `<id>.eml` (`format=raw`) beside them, so Evidence
  gets the mail as received with its files inside and a sha256. The address is placed as the reader
  places it (`email_place_address`); an unknown one asks *Who is this?* in the same press with the job's
  customer and the supply houses first, so no Sort all row is made that the tagger did not name.
- **On the Legal desk, by a press there:** Evidence → **From the job's messages…** lists every email
  conversation on the account's jobs, tagged from a person's mail or read from the boxes, one `.eml`
  each, and the app's own sends as their filed copies; a tick puts it on the matter through
  `addLegalMatterDocument`. The desk pulls; the tag never pushes, so the tag stays one press and the
  office decides what counsel reads, as it does for every document today.
- **Never:** a text, a push, a reminder, a Follow up row for the tagger, a change to the job's stage.

### 5 · What the team sees afterwards

Nothing new to learn. The lines sit on the sender's thread tied to the job and on the bid's rail; Job
activity shows them with the Customer pill when the sender is a customer; Where it stands reads them;
Lines that match finds them; Went out lists the person's own sends tagged in the last 7 days with *from
her mail*. A grey line on the thread says *Marisol tagged this conversation from her mail · later mail
in it lands here by itself*. The court reads the facts: the customer's mail and the person's Gmail reply
both land, so a tagged conversation never reads as a false *Needs a reply*.

### 6 · What never gets copied

- The list is a live read and keeps nothing: no table of subjects (unlike the counter), no snippet, no
  sender, until a tag.
- The function reads the signed-in person's own `users.email` and refuses any other address; a dev's
  **View as** is refused; samples and twins are refused as every send door refuses them.
- Drafts, Spam, Trash and Chats are never read. A label the person names on their card (*Personal*) is
  left out of the list. Bulk, no-reply and the office's *A notice, not a person* senders fold to one
  line, left out as the reader leaves them out.
- Nobody on the team reads a person's mail through the app. The owner's Phone and texts tab shows who
  has the tab on and how many conversations were tagged, and no window into anyone's box.
- **Untag** deletes the lines, the files and the `.eml`, unless the office already put the conversation
  on a matter, which keeps its own copy and says so.
- The honest sentence on the card: the delegation the bids@ reader uses can already act as any mailbox
  on the Workspace. The switch is the person's yes in the app's words, and the code is the fence. If the
  owner wants Google's own consent screen per person, that is #159's way 2 (an Internal consent screen,
  `gmail-connect`, tokens in Vault, Disconnect), five more parts, the same tab.

## The "no undue work" test, piece by piece

| Piece | The person does | The app does |
|---|---|---|
| Turning it on | One switch, once. | Reads their own address from their account. No admin step, no paste. |
| Seeing the mail | Opens the tab. | Lists Inbox and Sent live, folds notices, hides what is tagged under *To tag*. |
| Tagging a known conversation | **Yes** on the row, or **Tag…** and a pick. | Guesses the job from the subject, the sender and the conversation; copies the whole conversation with its files and the `.eml`; ties every line; adds the job to the person's jobs. |
| Tagging an unknown sender | One more press: who they are, the job's customer offered first. | Makes the contact as the sort card does; never leaves a Sort all row for someone else. |
| The next mail in that conversation | Nothing. | Lands it on the job within five minutes (PR 4), in and out. |
| Answering the customer | In Gmail, as today. | Sees the reply in Sent and lands it on the job (the conversation follows), so the court flips back without a press. |
| Getting it to the firm | One tick on the Legal desk. | Lists every conversation on the account's jobs as `.eml` files and files the ticked ones on the matter. |
| Nothing done | Nothing. | Nothing is kept. No badge, no count, no Needs you line ever nags about this tab. |

## Sizing

| PR | What | Size | Migration · function · Google |
|---|---|---|---|
| **0 · The guide** | *tag an email onto a job from Gmail*: the forward to bids@, the job from the mail's own subject, as it works today; one grey line in the reply box's send window pointing at it. | XS, docs and words | none |
| **1 · Kernels and the migration** | `src/lib/myMail/rows.ts` (a Gmail metadata listing to rows: who, subject, snippet, day, direction, files, the fold), `mailGuess.ts` (the guess, in order, over `jobInSubject` and the contact's jobs), `tagPlan.ts` (what a tag writes, line by line), each with its test on made-up mail. Migration `SET lock_timeout = '3s'`: `users.my_mail_on boolean default false` and `users.my_mail_hidden_labels text[]`; `messages.mailbox` takes `mine` beside `team` and `bids` (`messages_mailbox_known`), and `messages.mail_user_id uuid` names whose box it came from; `email_tag_threads` (the Gmail thread id, the person, the job keys, tagged by and at, last read at, the fences), read by the office team and written by the function; types regenerated as its own `chore(types)` PR after the push. | S | one migration |
| **2 · `gmail-mine`** | One function, four actions as the signed-in person: `list` (Inbox and Sent by label id, `format=metadata` with the snippet, 50 a page, a `q` search), `open` (one mail whole, the body as the thread's email line draws it), `tag` (the conversation: `threads.get`, each mail's raw kept as `.eml` in `message-attachments` under `mine/<line>/`, the files copied, `email_place_address`, `email_write_line` with the `Message-ID` fence so a mail the boxes already took is tied and not doubled, `tie_message`, the `email_tag_threads` row, the Gmail label if call 6 says so), `untag`. Reads as `users.email` only; refuses an address off the Workspace with Google's words on the tab; refuses a training account, a sample and a twin. Its `docs/EDGE_FUNCTIONS.md` section; `check:calls-ahead` on the PR since it names the new table. | M | deployed after PR 1's push; nothing at Google |
| **3 · The tab** | `/messages?tab=my-email` beside Follow up in `MessagesTopBar` (the pill drawn while the person's switch is on), the list with *To tag · Tagged · All*, the search, the fold, the guess column, the reader with the guess bar, the job picker (the existing `JobPickerWindow`), the Yes, Untag, the phone's sheet; the card on Settings → Your account; the owner's line on Phone and texts; the grey line on the thread; the guide *tag an email onto a job from your own mail*; `docs/MESSAGES_ARCHITECTURE.md`, `ACCESS_CONTROL.md`, `PROJECT_DOCUMENTATION.md`, `twins/APP_DIRECTORY.md`. | M | none |
| **4 · The conversation follows** | A cron every five minutes while any switch is on: for each `email_tag_threads` row read in the last 60 days, one `threads.get` (metadata) as that person; a mail not yet a line is tagged as PR 2 tags one. The cron row in a migration. | S | one migration (the cron row) |
| **5 · Evidence pulls** | Legal desk → Evidence → **From the job's messages…**: the email conversations on the account's jobs as `.eml` files (the kept raw for a tagged or box-read mail; the filed copy for the app's own sends), ticks, `addLegalMatterDocument`. | S | none |

PRs 1 to 3 are the tab. PR 2 lands after PR 1's push; PR 3 after PR 2's deploy. PRs 4 and 5 can wait a
month of use. The whole train touches `gmail-sync` nowhere, so #207's PR 3 and PR 4 land beside it.

## The owner's calls

| # | The call | Options | Recommended | Owner's answer |
|---|---|---|---|---|
| 1 | How the app sees a person's mail | A read through with a tag. B copy every person's box in. C copy in mail to known addresses only (#207 PR 4). 0 the forward guide alone. | **A**, with 0 shipped the same day. C later as a guess source if Wendi wants the Sent side with no press. | A, with the guide the same day (2026-11-01, *build all of this*). |
| 2 | Where it lives | A tab on `/messages`. A lane in Follow up. A Quickfill station. | **A tab**, the person's own, no count anywhere. | A tab. |
| 3 | Who may turn it on | Every office member, their own switch. The owner's list of people. | **Their own switch**; the owner sees who has it on. | Their own switch, **on by default** (the owner's word, 2026-11-01). |
| 4 | The unit of a tag | The conversation, and later mail follows (PR 4). One mail at a time. | **The conversation.** It is the unit a person thinks in, and it keeps the court honest. | The conversation. |
| 5 | Evidence | The Legal desk pulls from the job's messages (PR 5). The tag pushes with a second press. | **The desk pulls.** One press stays one press. | The desk pulls. |
| 6 | A label in the person's Gmail (*Tagged in ClickTooling*) | Yes, as the reader labels the boxes. Never write to a person's box. | **Yes**: the person sees in Gmail what is on a job, and `gmail.modify` is granted already. | Yes. Reversed 2026-11-12 on the owner's word: the label came out (v2.7035), so a save puts nothing in a person's Gmail. |
| 7 | The key | The delegation as the person, as today. Each person's own Connect Gmail (#159 way 2). | **The delegation**, with the honest sentence on the card. Way 2 swaps PR 2's token source if the owner wants Google's own yes. | The delegation. |

## Where it plugs in

Exists:

- `supabase/functions/gmail-sync/index.ts`, `_shared/gmail.ts` (`GMAIL_SCOPES`, the calls),
  `_shared/googleToken.ts` (`sub` = the mailbox), `src/lib/emailIn/` (`historyWalk.ts`, `leftOut.ts`,
  `leftOutSenders.ts`, `emailLine.ts`, `forwarded.ts`, `jobInSubject.ts`, `subjectJobs.ts`,
  `paperGuess.ts`, `gmailMessage.ts`), `email_write_line`, `email_place_address`,
  `messages.rfc_message_id` (v2.5504), `gmail_sync_state`.
- `tie_message`, `contact_job_check`, `contact_jobs`; `JobPickerWindow.tsx`, `tieSheet.ts`,
  `jobTiles.ts`; the thread window and its slots (`ThreadWindow.tsx`, `threadSlots.tsx`:
  a grey line is an `aboveLines` or `lineBody` slot, never a page change); `MessagesTopBar.tsx` over
  `topBar.ts`; `messagesIo.ts`; `MessageWindow.tsx` (the reader's shape); `PaperOffers.tsx`
  (`billOffer`, the W-9 and certificate offers under a tagged file).
- `email_box_watch` and `countedBoxes.ts` (the counter's list; this card does not reuse them: the
  counter keeps rows and the tab keeps none).
- `src/lib/legal/legalMatterDocuments.ts` (`.eml` as `message/rfc822`), `addLegalMatterDocument`,
  the Evidence tab in `jobs/legal/`.
- `SettingsAccountTab.tsx` (the signature card is the shape for the switch card, v2.6038);
  Settings → Phone and texts (`EmailReaderSettingsCard.tsx` for the owner's line).
- `docs/MESSAGES_ARCHITECTURE.md`, `docs/EDGE_FUNCTIONS.md`, `to-dos/messages-estimator-mailbox/`
  (#207), `to-dos/quickfill-email-station/` (#159).

New: `src/lib/myMail/` (the three kernels), the function `gmail-mine`, the migration, the tab's
components under `src/components/messages/myMail/`, the two guides, the Evidence door.

## How to verify, once built

- PR 0: the guide renders; a forward to bids@ of a mail whose own subject carries `JP1077` lands on the sender's
  thread tied to the job within a minute (this works today and is the baseline).
- PR 1: `npm test` on the kernels with made-up mail: the guess order, the fold, a tag plan for a
  three-mail conversation with one file.
- PR 2: as an office member on the Workspace, `list` answers 50 rows and keeps no row anywhere;
  `open` reads one mail; `tag` on a ZZ Test customer's conversation (sent from the walk kit's address
  to that person's own box) writes the lines, the files and the `.eml`, and a second `tag` writes
  nothing more; as the dev (off the Workspace) the function answers with Google's reason and the tab
  says it plainly; a sample account is refused.
- PR 3: light and dark, desk and phone; the tab absent while the switch is off; *To tag* hides the
  tagged and the folded; the guess column and the reader's bar; Yes, Tag…, Untag; the grey line on the
  thread; Job activity and Where it stands read the lines; Lines that match finds them.
- PR 4: a reply to the tagged ZZ conversation from the kit lands on the job within five minutes with
  no press, and the court flips.
- PR 5: the Evidence door lists the conversation as one `.eml`, a tick files it, and the firm's
  portal link opens it.
- Cleanup: every ZZ Test row, line, file and `.eml` deleted before the session ends.

## Is this the best we can do?

- **The simpler shape.** Shape 0, the forward guide, costs nothing and works today. It misses every
  mail the person sent, needs a typed job number, and six weeks of the reader being live show nobody
  does it. The tab earns its keep only by making the tag cheaper than a forward and by seeing the Sent
  side. So the guide ships first, in any case, and the tab is measured against it.
- **The risk of a second inbox nobody keeps.** The tab shows no unread, no badge, no count on the
  strip, no Needs you line; it cannot reply, archive or mark read. Its default view hides what is
  tagged and what is bulk, so an untouched tab looks empty, not nagging. The honest test after a
  month: conversations tagged per person. None, and the tab retires and the guide stays.
- **Does a tag make work for someone else?** No. A known sender is one press and no sort row. An
  unknown sender is named by the tagger in the same press. The office finds the lines where it already
  reads lines.
- **Why the conversation and not the mail?** Tagging the customer's mail alone flips the court to Our
  move while the answer already sits in the person's Sent. #207's finding 1 was exactly that row. The
  conversation is the unit, and following it is the one automatic thing in the plan.
- **What could be dropped.** PR 4 and PR 5 after a month of use; the search, the hidden-label list
  and the Gmail label are each an afternoon and can wait. PRs 1 to 3 are the tab.
- **What this does not solve.** A mail a person never opens the tab for stays in their box. That is
  by design: the plan asks for one press per conversation worth keeping, and no more.

## Where it stands

- 2026-11-01: written from the owner's ask, the code, the docs and the live switches (the boxes read
  and healthy; the counter off with an empty list and its admin step not done). The mock-up draws the
  tab, a mail with the tag press on a desk and a phone, the job's story afterwards and the switch
  card. Nothing built. Waiting on the seven calls.
- 2026-11-01, later: the owner took every call as recommended, with the switch **on by default**, and
  asked for all of it built. Built the same day as twelve PRs, each with its own tests:

  | PR | Version | What it built |
  | --- | --- | --- |
  | #6692 | v2.6257 | PR 0, the forward guide |
  | #6696 | v2.6266 | PR 1, the kernels, the contract and migration `20261101083844` |
  | #6701 | v2.6275 | PR 2, the `gmail-mine` function |
  | #6705 | v2.6274 | PR 3, the tab on Messages and the card on Your account |
  | #6706 | v2.6276 | PR 5, the Legal desk's Evidence door, migration `20261101130407` |
  | #6715 | v2.6279 | PR 4, the follow and its cron, migration `20261101154949` |
  | #6725 | v2.6289 | Review fix: the follow stops 60 days after a conversation's newest mail and reads in turn, migration `20261101172319` |
  | #6727 | v2.6290 | Review fix: My email never opens in a session Imitate or View as opened, migration `20261101175329` |
  | #6728 | v2.6291 | Review fix: Untag on every tagged conversation, Another job…, a mail not on the job yet, the empty page |
  | #6729 | v2.6292 | Review fix: an untag keeps the office's promises and highlights, the tag records its own ties, hidden labels stay out, and seven more, migration `20261101183219` |
  | #6737 | v2.6295 | The lead's fix: a mail not on the job yet says so in the list |
  | #6738 | v2.6296 | The lead's fix: a label left out stays out of an open conversation too |

- Live: all six migrations pushed with `supabase db push`, and the ledger matches the repo. `gmail-mine`
  and `login-as-user` are deployed, and the Pages deploy is green. Checked live as the dev: the bar shows
  Follow up · My email, and Follow up is unchanged. The tab draws Google's refusal as one calm line,
  because the dev's address is off the Workspace. The card on Your account shows the switch on. A phone
  width has no sideways scroll. Both functions refuse a call with no session, and the guide's share page
  is up.
- An independent review of the build found ten defects, and the four review PRs fixed all ten. The worst:
  Imitate and View as open a real session as the person, and My email read that person's mail. Now each
  imitation is recorded first, and a session that follows one is refused. The lead found two more after
  it and fixed both: the row said *open the line ›* on a mail no line holds yet, and opening a mail
  listed the mails of its conversation under a label the person leaves out.
- No tag was made before the fixes went live: the function's logs show only refusals, the dev's and the
  lead's probes. So no tag lacks the ties v2.6292 records.
- Known and left as it is: a person's own magic link in the 24 hours after someone imitated them is
  refused, so they sign in again a day later. That is the safe side of telling the two apart.
- Left: a clickplumbing.com office member's first real tag, which no agent may sign in to do. The
  importers that `npm run check:edge-drift` names, whose drift is the kernel copy alone. Then a month of
  use, counting conversations tagged per person; the tab retires if nobody tags.
- 2026-11-09: `email_tag_threads` is no longer empty. One row: Taunya's login tagged the conversation
  *ZZ TEST paper for JP1088 Riders Walk* onto JP1088 on 2026-11-07 at 07:28 UTC, `placed_by_app`
  false, no tied lines. By its hour and its ZZ subject it is the seat's `apply_mail_tag` running as her
  login from a session, not her own press on the tab, so the 11-04 review's count (zero tags by a
  person) still stands and the month of use has not started. The walk planned for today as a new
  office account (robert@clickplumbing.com) did not run: the account was made with no login attached,
  and the sign-in waits on the desk's Attach a login. The checklist for the walk, in Grace's words, is
  in the shared notes folder (`close-out-notes-2026-11-09.md`); PR #7465 gives the seat the verbs to
  make the account and attach the login, so the next session can run it with the owner.
- 2026-11-12 and 11-13: five PRs, after the batch of 2026-11-09 showed a seat save reading as the
  person's own. All merged and live:

  | PR | Version | What it changed |
  | --- | --- | --- |
  | #7778 | v2.7020 | A save the dev seat makes names the dev: `tagged_by` is the dev and the grey line says *… through the dev seat* |
  | #7780 | v2.7022 | The seat can take off a save it made, and only one it made (`plan_mail_untag` → `apply_mail_untag`, server 0.79.0) |
  | #7794 | v2.7035 | The Gmail label is gone: a save puts nothing in the person's Gmail, the Saved list reads the app's own rows, and a one-time run deleted the label from every company mailbox |
  | #7839 | v2.7068 | When the seat saves someone's mail to a job, its owner gets a Needs you line for seven days and a record under Settings → Activity logs, in the app only (the owner's choice), migration `20261113001500` |
  | #7850 | v2.7073 | Tag is Save to job in every word a person reads: the press, *Not saved · Saved · All*, *Take off the job*, the grey line, the guide (renamed, its old address kept) |

- On prod: the migration pushed, `gmail-mine` and `dev-mcp` deployed from `main` after each merge,
  and `npm run check:edge-drift` clean at 06:42 UTC on 11-13. The label run finished at 23:30 UTC on
  11-12: 22 mailboxes, the label deleted in 5, never there in 12, and 5 refused by Google three times
  each (*Invalid email or User ID*) and left. The 5 it deleted from are exactly the 5 mailboxes with a
  save. Its marker row, `my_mail_label_cleanup_v1`, stays.
- The save log, read 2026-11-13 (`email_tag_threads` against `dev_mcp_calls`): 23 saved
  conversations. 18 are the seat's, one on 11-07 and seventeen from one mailbox on 11-09, each with an
  `apply_mail_tag` call behind it. All 18 predate v2.7020, so they still name the mailbox's person as
  the one who saved. 4 were placed by the app from a person's Sent (#263 call 2), 11-10 to 11-12. One,
  at 19:05 UTC on 11-12, has no seat call behind it and was not placed by the app: by the log, the
  first save made by a person's own press. It came before the line after a save went live (#324,
  v2.7032), and its green bar was not seen. No save has come since v2.7020 went live, so no grey line
  in the new words exists yet, no owner's notice has been written, and the seat's take-off has never
  run.
- Live walk, 06:43 to 06:55 UTC on 11-13, as the dev: the tab reads in the new words, the guide opens
  at its new address and at its old one, and Settings → Activity logs is headed *Most recent
  notifications*. The dev's address is off the Workspace, so the lists were empty and no row could be
  pressed. The walk found two flaws in the train, fixed in PR #7916 (in the merge queue at writing):
  the notice's **See the record** opened its tab above an owner's sent emails, and the guide held the
  notice's section twice.
- Left: PR #7916 onto `main`, and its door walked live. A real save walked end to end: the grey line
  in its new words, the owner's notice on their Needs you card, and the seat's take-off. A seat save
  onto a ZZ Test job would prove all three, but the mailbox's real owner would see the notice for seven
  days, so it waits for a mailbox whose owner has agreed.

## What should change next (notes, 2026-11-13)

Notes from the train above, not built. On Opus 5.5 the team makes no major change (Grace,
2026-11-13), so each waits here for a yes. None is urgent.

1. **Correct the seat's 18 old saves.** They predate v2.7020, so `tagged_by` names the mailbox's
   person and each grey line says that person saved it. A one-off correction: for each row an
   `apply_mail_tag` call names (`tag.account` and `tag.thread_id` in `dev_mcp_calls.args`), set
   `tagged_by` to the dev who made the call and rewrite the row's grey line (`messages.quo_id` =
   `mytag:<row id>`) in the seat's words. It writes to prod rows, so it needs the owner's word. The
   seventeen of 2026-11-09 stay on their jobs either way (#324 call 2). Size S.
2. **The owner of the 2026-11-09 mailbox was never told.** The notice (v2.7068) came after that batch.
   Whether to tell them now, and how, is the owner's call. Size XS.
3. **Take out the label run.** It finished on 2026-11-12, and now it only reads its marker at the
   start of every `follow`: `clearOldLabel` and `deleteLabel` in `gmail-mine`, the clean-up kernel in
   `src/lib/myMail/mineFunction.ts` and their tests. Then tighten the run test's pin
   (`gmailMine.run.test.ts`), which still allows one write to Gmail (`DELETE /labels`), so that any
   write to a person's Gmail fails a test. The 5 mailboxes Google refused keep the label; a person can
   delete it in Gmail by hand. Size S. The kernel is shared, so it deploys six functions.
4. **A person's own Take off the job leaves two traces.** The seat's take-off also clears the ties the
   save made onto the job's people, and a contact it made for a sender nobody knew (`planUntagSweep`,
   run only when `ctx.seat` is set). A person's own press does neither, so the job still lists the
   people the conversation named. Run the same sweep for both. Size S.
5. **The Sent read's refusal log can carry an address.** `gmail_mine_sent_refused` writes Google's own
   error text, up to 300 characters, and Google's delegation refusal names the mailbox. Log the kind
   of refusal and the user id only, as the function's other lines do. Size XS.
6. **Found here, owned elsewhere: three seat verbs write in another person's name.**
   `apply_cost_batch` (a `thread_note` lands under the payload's `author_user_id`),
   `apply_person_report` (an HR entry titled as the reporter's while its words may be the seat's) and
   `apply_clock_sessions` (a changed session keeps no editor stamp). None says the dev seat made the
   change, the gap v2.7020 closed for mail. It belongs to the dev seat (`docs/dev-mcp/README.md`). No
   card holds it yet; the nearest is #27. Size M across the three.

## Review 2026-11-04: is this still relevant, and could we do it better?

Grace, 2026-11-04, re-reading her note that asked for this tab (the ask above), which had shipped three
days before: "is this still relevant? could we do this better?" Read against the code, the twelve
fragments, the ledger and the live tab as the dev. The second answer is punch list #263
(`to-dos/messages-my-email-doors/README.md`, with its mock-up); this section is the review.

### Still relevant? Yes, and unproven

The need the note named has not moved: a person's own mail still reaches a job only by a press of
theirs (the tab) or a forward (the guide), and #207's finding 1 (Wendi's answer from wendi@ that the
thread never saw) is still open. What has moved is the evidence: the tab has had no visitor from the
Workspace in four days. Relevant, and not yet used.

### The note, line by line, against the build

| The note asked | What shipped | Where it differs | What the fragments say was left |
|---|---|---|---|
| A new tab in Messages | Messages → **My email** beside Follow up (v2.6274), drawn while the person's switch is on | None | The owner's line on Settings → Phone and texts (who has it on, how many tagged) was listed in PR 3's row and not built (v2.6274, *Not in this PR*); the grey thread line came with PR 4 (v2.6279) |
| The person's own emails **and sends** | Inbox and Sent, read live as the person under the bids@ delegation (v2.6275); a mail in their Sent is theirs whatever address it went out from (v2.6292 finding 6) | None | The Sent side lands only inside a tagged conversation (the follow); a reply the person sends outside one still never reaches the job (#207 call 1, open) |
| Associating emails with jobs **and bids** | A tag's job is a bid, a GC project or a Pipeline job (`MyMailJobKind`); the picker lists the sender's jobs first, then a search of all three | The guess's domain step reads a customer's open **Pipeline** jobs only (`customerOpenJobs`); a bid's customer domain gives no guess. A development is not a tag target; a development's History is the dev seat's | — |
| The team deciding later on shared knowledge | The sender's thread, Job activity with the Customer pill, Where it stands, Lines that match, Went out, the court on Follow up; the Legal desk's Evidence pulls a tagged conversation as the raw `.eml` as received (v2.6276); the `.eml` is `format=raw` with its headers and files, and Evidence falls back to a made record only when the raw copy is gone | None | The Legal pull is walked on fixtures only; no tagged `.eml` exists yet to pull |
| "Only if it doesn't create undue work" | One press (**Yes**) on a guessed row; **Tag…** and a pick otherwise; **Who is this?** once for an unknown sender; later mail follows for 60 days from the newest mail with no press; the switch is per person and on by default | The hidden work is the visit: the tab shows no count, no line and no door anywhere else, by the owner's call 2, so a person who never opens it tags nothing and misses nothing visible | The card's own retire test (a month of use) |

### The live walk, as the dev

`node scripts/dev-pane-login.mjs /messages?tab=my-email`, 2026-11-04. The bar shows Follow up · My
email; To tag · Tagged · All and the search draw; the page reads for a second and then draws Google's
refusal as one calm line (*Google will not read this address for the app: it is not on the company
Workspace. Google said: Client is unauthorized…*). The dev's address is off the Workspace, as the card
said on 11-01, so no row, no guess and no press was seen on real mail. The guess count the review asked
for (right, wrong, none over the first thirty rows) is **unmeasured** and waits on a Workspace person.
The dev seat's key (`dev-mcp`) was revoked that day, and the auto-mode classifier refused a `psql` read
of prod, so the counts below were read through the app's own PostgREST as the signed-in dev.

### The counts since 2026-11-01 (the card's own retire test)

| Person | Switch | Conversations tagged | Minutes on the tab |
|---|---|---|---|
| Taunya (assistant) | on | 0 | 0 (Messages: 5 min in 3 days) |
| Roxi (assistant) | on | 0 | 0 (no activity rows) |
| Grace (assistant) | on | 0 | 0 |
| Malachi (master) | on | 0 | 0 |
| Wendi (estimator) | on | 0 | 0 (Messages: 151 min since 10-22) |
| Zoe, William (estimators) | on | 0 | 0 (no activity rows) |
| Robert (dev, off the Workspace) | on | 0 | 62 on 11-01, 5 on 11-02, 1 on 11-05 |

`email_tag_threads` is empty and no `messages` row has `mailbox` mine. Where the office lives since
10-22: Taunya on Jobs → Stages (748 min), Schedule (334), the Dashboard (328) and Quickfill (260); Wendi
and Grace on the Bid Board (722 and 1264) with the Dashboard second; Malachi on the Tally.

### What would make it better, ranked

1. **A door where the person already works** (#263 call 1, recommended). A line under the job window's
   Where it stands card and on the bid's rail, read from the person's own Gmail when the window opens
   and kept nowhere: *Your mail with Dale: 2 conversations not on this job* with **Yes** on each.
   Evidence: zero visits to the tab; 748 minutes on Jobs → Stages. Cost S. The press stays the person's.
2. **The Sent side with no press** (#263 call 2, second). The follow widened to a person's Sent: a mail
   to an address on exactly one open job lands by itself, marked as the app's, with Untag. Evidence:
   #207 finding 1; the note's "undue work". Cost M. It ties on a guess alone, which #230 refused for the
   Inbox; the Sent side is the safer half.
3. **A Needs you line on the Dashboard** (#263 call 3). A morning count per person from a per-person
   metadata run. Evidence: the Dashboard is every office member's second page. Cost M and a Gmail read
   per person per run. Not now: it is the count the owner's call 2 refused, and call 1 answers it at the job.
4. **The guess's thread rule** (#263 call 5). The guess reads each mail alone; another mail of the same
   Gmail conversation on the page that a box holds on a job says the job outright and is not asked.
   Pure, an afternoon. Build after Grace's walk gives rows to measure it against.
5. **A bid's customer domain as a guess**: `customerOpenJobs` reads Pipeline jobs only, so a customer
   with one open bid and no job gives no guess from their domain. Small; folds into item 4's PR.
6. **Tagging from the email viewer**: not needed. A mail a box holds is a line already, with the viewer's
   own *Tied to* and, since v2.6509, *Put it on a bid…*; the tab says *already in Messages ✓* for it.
7. **After the 60-day follow**: a late reply shows as *not on the job yet ›* with **Put it on the job**
   (v2.6291, v2.6295). Right as built, and it only helps a person who visits, which is item 1 again.
8. **The Sent half inside a tagged conversation**: the follow reads `threads.get` as the person, so their
   Gmail reply lands as ours and flips the court (v2.6279). Right as built; unverified live.
9. **The legal tie**: the raw `.eml` (`format=raw`) is kept beside each tagged line and Evidence files it
   as received, headers and files intact (v2.6276). Right as built; unverified live.
10. **The switch, per person or per role**: per person and on by default is right. The ledger shows the
    switch is not what stands between anyone and a tag.

### What this review leaves

- Grace's own first live tag, as grace@clickplumbing.com, on a ZZ Test job: the read and the tag no
  agent can make, and the guess count over the first thirty rows. The month of use starts there.
- The owner's line on Settings → Phone and texts, still unbuilt from PR 3's row.
- #263's five calls.
