---
name: "Messages → My email: a person's own @clickplumbing.com mail beside the threads, one press to tag a conversation onto a job or a bid"
number: 230
group: gated
status: proposed 2026-11-01 from the owner's ask, read against the code and the live switches; a mock-up at phone and desk widths; nothing built; the owner's seven calls at the foot, a recommendation on each
summary: >
  The owner asked for a tab in Messages that shows a person their own @clickplumbing.com email, in and
  out, so tagging an email onto a job or a bid becomes easy, and the team later reads a job's full
  story from what was tagged, without making extra work for the person. Today the app reads only the
  two shared boxes' Inboxes; a person's own mail reaches a job only by forwarding it to bids@ with the
  job number in the subject, which works and which nobody does. The plan is a tagging desk, never a
  second inbox: the tab reads the person's Inbox and Sent live from Gmail under the delegation the
  bids@ reader already holds and keeps nothing; the app guesses the job from the subject, the sender and
  the conversation and the person presses Yes; a tag copies that conversation, in and out, onto the job as
  lines in Messages with the files and a court-ready .eml, and later mail in it lands by itself; the Legal
  desk pulls a tagged conversation onto a matter's Evidence. Five PRs, one migration, one edge function,
  nothing to do at Google on the recommended path.
next: The owner's seven calls at the foot (1, 4 and 7 decide the shape; the rest can take the recommendation), then PR 0, the guide, the same day, and PR 1.
size: M as a train of five (S · M · M · S · S) after a docs-only PR 0; one migration, one new edge function; no Workspace admin step on the recommended path
blocker: The owner's calls. Nothing at Google: the delegation already covers the read. The first live person must be on the clickplumbing.com Workspace, which the dev account is not.
ver: v2.5354 · 5466 · 5494 · 5504 · 5722 · 5814 · 5820 · 6004 · 6038 · 6095 · 6202
opinion: build — read through and keep nothing until a press, the guess with a Yes, the conversation as the unit, the desk pulls Evidence; ship the forward guide first either way, and retire the tab after a month if nobody tags
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
  sits on the person. The office moves a line with **Tie to** on the reply box, the press-and-hold
  **Tie this message to** sheet on a phone (`tieSheet.ts`) and the job picker (`JobPickerWindow`, their
  own jobs first, then a search), all through `tie_message(message, kind, job)`, which also adds the
  job to the person's `contact_jobs`.
- **A forwarded copy already works.** A mail one of us forwards to bids@ lands on its first sender with
  the forwarder's note as a team note (`forwarded.ts`), and the subject's job number ties it. That is
  the one way a person's own mail reaches a job today. Nobody has been told, and six weeks of the
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
| **0 · Nothing but the guide** | The forward to bids@ with the job number in the subject, documented. | A forward per mail and a typed number. Never the Sent side. | A guide. |

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
| **0 · The guide** | *tag an email onto a job from Gmail*: the forward to bids@ with the job number in the subject, as it works today; one grey line in the reply box's send window pointing at it. | XS, docs and words | none |
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
| 1 | How the app sees a person's mail | A read through with a tag. B copy every person's box in. C copy in mail to known addresses only (#207 PR 4). 0 the forward guide alone. | **A**, with 0 shipped the same day. C later as a guess source if Wendi wants the Sent side with no press. | |
| 2 | Where it lives | A tab on `/messages`. A lane in Follow up. A Quickfill station. | **A tab**, the person's own, no count anywhere. | |
| 3 | Who may turn it on | Every office member, their own switch. The owner's list of people. | **Their own switch**; the owner sees who has it on. | |
| 4 | The unit of a tag | The conversation, and later mail follows (PR 4). One mail at a time. | **The conversation.** It is the unit a person thinks in, and it keeps the court honest. | |
| 5 | Evidence | The Legal desk pulls from the job's messages (PR 5). The tag pushes with a second press. | **The desk pulls.** One press stays one press. | |
| 6 | A label in the person's Gmail (*Tagged in ClickTooling*) | Yes, as the reader labels the boxes. Never write to a person's box. | **Yes**: the person sees in Gmail what is on a job, and `gmail.modify` is granted already. | |
| 7 | The key | The delegation as the person, as today. Each person's own Connect Gmail (#159 way 2). | **The delegation**, with the honest sentence on the card. Way 2 swaps PR 2's token source if the owner wants Google's own yes. | |

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

- PR 0: the guide renders; a forward to bids@ with `JP1077` in the subject lands on the sender's
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
