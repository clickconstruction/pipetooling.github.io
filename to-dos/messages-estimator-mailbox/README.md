---
name: "Messages and the estimator's own mailbox: an answer the app never saw, the email's shape, the noreply sender and the Sent folder (Wendi's findings, 2026-10-27)"
number: 205
group: gated
status: proposed 2026-10-27 from Wendi's five findings on the Messages page · finding 5 built as its own PR the same day · findings 1 to 4 read against the code, the email's shape mocked up, six calls at the foot with a recommendation each
summary: >
  Wendi tested Messages on 2026-10-27, emailing herself from the app and replying from her own
  mailbox. She found four things the code confirms. A bid request she already answered from
  wendi@ still reads Our move, because the app reads only the two boxes' Inboxes and never a
  person's own mail. The email the app sends wears a navy bar and a cream card with a greeting,
  a signature and a footer the app writes. It goes from team@noreply.clicktooling.com with a
  Reply-To on bids@, which works but reads like a machine. And the sent copy shows up nowhere in
  Apple Mail's Sent, since the app copies nobody. One change answers three of the four: send the
  reply box's email through Gmail as the box the answer comes back to, the way the walk kit
  already replies. The rest is the shape of the email and how the app learns of an answer sent
  from a teammate's own mailbox.
next: The owner's six calls at the foot. Calls 3 and 4 want Wendi's eye, since she reads the email as the customer does. Then PR 1, the shape, which needs no decision on the sender.
size: M (four PRs, S to M; one small migration for the signature's two lines; a second migration only if call 1 picks reading each estimator's own Sent)
blocker: The owner's calls. Nothing else. Finding 5 is already its own PR.
ver: v2.5496 · 5504 · 5541 · 5686 · 5699 · 5707 · 5722 · 5739
opinion: build — every door it needs exists (the Gmail send the walk kit uses, the boxes' tokens, the signature columns, the Message-ID fence); what is missing is the decision on the sender and the shape, and the reader looking one label further
---

# Messages and the estimator's own mailbox (#205)

## For the owner

Wendi sent five findings. The fifth, a row under Went out that read *A number nobody has named* for an
email, is fixed as v2.5994 (PR #6338) and is not here. The other four are below, each read against
the code, with a recommendation. Six calls sit at the foot. **Calls 3 and 4 want Wendi's eye**: they
are about the email as the customer reads it, and she is the one who reads the answers. Call 1 wants
her word too on how she works a bid request: from wendi@, or from bids@ in Apple Mail.

## The findings, in Wendi's words

1. "What if I am already handling a project from my personal email, but it is duplicated through the
   bids email?" Rusty Cottar's thread read *Our move · 23 h · We owe them… · Rusty emailed yesterday. We
   have not written yet.* under *Wendi took Rusty Cottar · 2:49 PM*. She had already answered him from
   wendi@clickplumbing.com.
2. "This is what emails look like that we send, I don't love it." From *Click Construction*
   <team@noreply.clicktooling.com>, Reply-To bids@clickplumbing.com; a navy bar reading CLICK CONSTRUCTION
   over a cream card: *Hello Wendi,* / her words / *Wendi · cell <her number> · Email back, text, or
   call.* / *Click Construction.*
3. "This email address has noreply in the domain. It does receive replies. Replies come in successfully.
   Remove 'noreply'? I don't understand how this works."
4. "Outgoing emails sent through clicktooling show up in the inbox instead of sent mail in Apple Mail.
   Emails go through almost immediately."
5. "Perhaps change this to 'client nobody has named', since this is an email lead with no number attached
   to it." Built: v2.5994.

## How email works in Messages today

Read before this was written. Each is a door the builder goes through, not around.

- **Out.** The reply box's **Send email** calls `messages-email`. The function writes the line in
  `messages` first, so the email has an id, then sends through **Resend** from the app's one sending
  address, `EMAIL_FROM` (`Click Construction <team@noreply.clicktooling.com>`, the company's name on the
  address `noreply.clicktooling.com` verified in Resend, `docs/DOMAIN_CUTOVER.md`). Its **Reply-To** is
  the box the answer comes back to: the box the person last wrote to, else their kind's (`boxForReply`,
  R6, v2.5496). Nothing is copied to the sender. The sent copy is filed in Documents as
  `messages_email`. The words are `compose.emailDraft`'s; the frame is `buildMessagesEmail` over
  `buildGcCustomerEmail`, unframed.
- **In.** `gmail-sync` runs every minute while **Read bids@** is on. It reads **the Inbox** of the bids
  box, and of the team box once Settings names one, as those Workspace users under the service account's
  domain-wide delegation (`readerBoxes.ts`). It reads no other label and no other mailbox. A mail from a
  teammate's own address is taken since v2.5722: to the box with nobody outside named, it lands on their
  Our team thread; **to a customer with the box copied, it lands on the customer's thread as ours, going
  out, under the teammate's name** (`emailLine.ts`'s `emailParty`). The box's own sends and the app's are
  left out (`leftOut.ts`). One mail read in both boxes lands once, by its Message-ID (v2.5504).
- **The move.** `courtOf` in `thread.ts`: ours when their line is the newest, counted from it; theirs
  when ours is. A team note moves nothing. *Took* is the holder (`hasLine` in `followUp/queue.ts`): who
  has the conversation, written as a grey event line. It never touches the clock.
- **Gmail can already send for us.** The walk kit's email reply (`walk/index.ts`'s `replyEmail`,
  v2.5739) builds the raw mail (`walkFunction.ts`'s `replyRaw`) and sends it through the Gmail API as
  the bids box (`gmailSend` in `_shared/gmail.ts`) under the same token the reader uses. The scope the
  owner granted, `gmail.modify`, covers sending and inserting. No new admin step.
- **The boxes in Apple Mail.** Wendi's screenshots show both her own inbox and bids@'s open in Apple
  Mail. The office reads the boxes there; the app reads them through the API.

## Finding 1 · an answer sent from her own mailbox

**What the code says.** The app saw Rusty's email to bids@ and nothing since, so his line is the newest
and the move is ours. Wendi's answer went from wendi@ to rusty@ and never touched a box the app reads.
The row is right by what the app knows and wrong by what happened.

**The door that exists today.** Copy bids@ on the answer. Since v2.5722 a teammate's mail to a customer
with the box copied lands on the customer's thread as ours, with her name, and the move flips to theirs.
The guide *turn on reading the bids inbox* says so under *A teammate's email*. Nothing on the thread
tells an estimator that, and nobody told Wendi.

**Two ways to need no habit.**

- **Read the boxes' own Sent.** If Wendi answers from bids@ in Apple Mail, the mail sits in bids@'s
  Sent label, which the reader never looks at. One more label in the history walk (`SENT` beside
  `INBOX`, `gmailHistory`'s `labelId`), the line written as ours going out with `who_text` from the
  mail's From name, the same Message-ID fence. Same token, same state row, no consent question: the box
  is the company's.
- **Read each office member's own Sent.** If she answers from wendi@, the app has to read her mailbox.
  The delegation already allows it for any Workspace user. The fence that makes it fair: a switch on
  Your account, off by default, *Let Messages see what I send to people in Messages*; the reader lists
  her Sent under the metadata scope first, which gives the To header and no body, and reads a mail whole
  only when its To is an address `contact_channels` already holds. Mail to anyone else is never read.
  One `gmail_sync_state` row per person, so `mailbox` widens or a sister table holds them.

**What *took* should mean.** Nothing new. *Took* says who, the clock says since when, and they are
different facts. Making a take stop the clock would hide the very row Wendi was looking at. The fix is
the reader seeing her answer, not the clock forgiving it.

**Recommended.** Read the boxes' Sent (PR 3) for the office members who answer from bids@ in Apple Mail,
and offer each office member the switch for their own Sent (PR 4). Until PR 3 lands, the thread's
reply box gains one grey line under its from line: *Answering from your own mailbox? Copy bids@ and this
thread hears it.* Wendi says which mailbox she answers from, which decides whether PR 4 is needed at all.

## Finding 2 · the email's look

**Where each piece comes from.** The greeting is `emailGreeting` over the name they go by. The signature
is `signatureLines`: the account's name, its title when set, its cell, then the owner's line *Email
back, text, or call.* The footer is `emailFooter`: the company, its address when Settings has one, and
the job. The navy bar and the cream card are `buildGcCustomerEmail`'s, the frame every customer email
wears, drawn unframed so the lines carry their own greeting and sign-off. None of it is in the editable
wording catalog: `messages_email` is a hardcoded row there.

**The mock-up** (`mockup.html`) draws today's shape exactly, then three plainer ones with the same words:

- **A · Plain.** No bar, no card. Her greeting, her words, the signature she keeps on Your account, and
  nothing after it. The From reads *Wendi Doll · Click Construction*.
- **B · One line of letterhead.** A with the company's name small at the top over a hairline.
- **C · Today's card, quieter.** The cream card without the bar, her greeting and signature, the job
  line in grey at the foot.

**Recommended.** A. A reply from the reply box is a person's reply; the estimate, the bill, the contract
and the lien notices keep their letterhead because they are papers. The greeting becomes hers: the box
pre-types *Rusty,* on its first line, which she keeps, changes or deletes, and the app stops writing
*Hello Rusty,* after the fact. The signature is one card on Your account: name from the account, title,
cell, and up to two lines of her own. The owner's reply line retires from the generated signature; he can
type it into his own.

## Finding 3 · the noreply address

**In plain words.** The app sends from `team@noreply.clicktooling.com` because that is the one address
the app's mail provider, Resend, is allowed to send as. *noreply* is only a name in that address. The app
puts a Reply-To on every Messages email, so when Rusty presses Reply, his mail client writes to bids@
instead. bids@ is read by the app every minute, which is why her reply landed in the thread at 3:06 PM.
It works. It also tells every reader that a machine sent it, and a reader who writes a fresh email
instead of pressing Reply writes to an address nobody reads.

**Four ways to lose the word, and what each costs.**

| | Way | What it costs | Who presses what |
|---|---|---|---|
| a | A Resend subdomain without the word: `mail.clicktooling.com`. | Nothing at Resend. Three or four DNS records in the clicktooling.com Cloudflare zone. Every app email moves with it, since all read `EMAIL_FROM`. Still an address nobody writes to. | A dev adds the domain in Resend and reads the records off; the owner adds them in Cloudflare; a dev sets the secret and redeploys. |
| b | Verify `clickplumbing.com` in Resend and send Messages' emails as `bids@clickplumbing.com` or the team box's address. | Nothing at Resend. Three records in the clickplumbing.com zone, which is also on Cloudflare (read 2026-10-27): Resend's DKIM, and an MX and a TXT on a `send.` subdomain for the bounce address. Google's own mail is untouched. Messages gets its own From secret so the other app emails stay as they are. The From then matches the box the reply comes back to, so no Reply-To is needed. | The same three people. One afternoon. |
| c | **Send through Gmail as the box** the answer comes back to, the way the walk kit replies. | No DNS, no provider, no secret. The function builds the raw mail with its files, the display name *Wendi Doll · Click Construction*, and sends as bids@ or team@ under the reader's token. Gmail's limit is 2,000 sends a day per box. The line keeps the mail's Message-ID so a copy the box gets back lands once. The function writes the `email_send_log` row itself. Resend's log stops seeing these. | A dev. One PR and a deploy. |
| d | Send through Gmail as the person, wendi@. | As c, but the mail sits in her Sent and Rusty's reply comes to her unless a Reply-To steers it to the box. Her mailbox is not read, so an answer that lands there is finding 1 again. | A dev. |

**Recommended.** c. The reply goes from the box the thread already listens to, the sent mail sits in
that box's Sent, and the word *noreply* is gone without a DNS change. b is the right second step if the
owner later wants the papers to come from the company's own domain too.

## Finding 4 · Inbox, not Sent

**Why.** Wendi addressed her test to herself, so what reached her Inbox was the delivery, not a copy.
The app sends no copy to the sender and nothing to the boxes: when she emails Rusty from the app,
nothing reaches any mailbox of ours. The thread and Went out are the record. What she wants is the sent
mail where Apple Mail keeps sent mail.

**Three ways.**

- Nothing. The thread holds it, Went out lists it for 7 days, Documents keeps the copy.
- After Resend sends, put a copy into the box's Sent through the Gmail API (`messages.insert` with the
  `SENT` label, one call). Keeps Resend. The copy carries the Resend From, so the mailbox shows a mail
  from team@noreply in its own Sent.
- Send through Gmail as the box (finding 3's c). The mail is in the box's Sent because the box sent it.

**Recommended.** The third, which call 5 gives for free. The second if the owner keeps Resend.

## A side note, apart from this to-do

While in the mail domain's zone for any of the ways above, the owner should check the two records Google
recommends for a Workspace domain, SPF and DMARC, against what the zone holds. The triage session's
hand-over note has what was read on 2026-10-27. Not built here.

## The owner's calls

Each row holds the recommendation the mock-up draws. The owner answers in one line each.

| # | The call | Options | Recommended | Owner's answer |
|---|---|---|---|---|
| 1 | How the app learns of an answer sent from a mailbox it does not read | Copy the box, as today. Read the boxes' own Sent. Read each office member's own Sent, by a switch on their account, mail to people in Messages only. A press on the thread, *Answered from my own email*. | Read the boxes' Sent, and offer the per-person switch. Until then, a grey line in the reply box says to copy bids@. No press: a press is a habit too, and the fact is in the mail. **Wendi's word on which mailbox she answers from.** | |
| 2 | What *took* means for the clock | Nothing changes. A take stops the clock. A take marks our move done. | Nothing changes. *Took* says who, the clock says since when. | |
| 3 | The email's frame (**Wendi's eye**) | A plain. B one line of letterhead. C today's card without the bar. Keep today's. | A. The papers keep their letterhead; a reply is a person's. | |
| 4 | The greeting, the signature and the footer (**Wendi's eye**) | Keep the app's greeting, signature line and footer. The greeting pre-typed in the box, the signature from Your account with two free lines, no footer. Keep the job line at the foot in grey. | The greeting pre-typed and hers, the signature from Your account, no footer. The owner's *Email back, text, or call.* retires from the generated lines. | |
| 5 | The sender | Keep team@noreply. A Resend subdomain without the word. clickplumbing.com verified in Resend. Through Gmail as the box. Through Gmail as the person. | Through Gmail as the box the reply comes back to, with *Wendi Doll · Click Construction* as the name. Every other app email keeps Resend and `EMAIL_FROM`. | |
| 6 | Where the sent mail shows in Apple Mail | Nowhere, the thread is the record. A copy put into the box's Sent. In the box's Sent because the box sent it. | In the box's Sent, which call 5's recommendation gives. A copy by insert if the owner keeps Resend. | |

## Where it plugs in

- `src/lib/messages/compose.ts`: `emailGreeting`, `signatureLines`, `emailFooter`, `emailDraft`, the
  send window's `EMAIL_SOURCES_NOTE`. `replyIo.loadSender` reads `users.name`, `title`, `phone`.
- `supabase/functions/_shared/messagesEmail.ts`: `buildMessagesEmail` over `buildGcCustomerEmail`; the
  plain shape is its own small builder beside it, text and HTML, with the link lines kept.
- `supabase/functions/messages-email/index.ts`: the send, `sendEmailViaResend` with `replyTo`; the line's
  `mailbox` from `boxForReply`. The Gmail path reuses `readerBoxes` for the box's address,
  `googleServiceToken` with `GMAIL_SCOPES`, `gmailSend`, and a raw-mail builder lifted from
  `src/lib/walk/walkFunction.ts`'s `replyMessage` with multipart files added.
- `supabase/functions/gmail-sync/index.ts`: `runBox`'s history walk, `gmailHistory` (one `labelId`
  today), `takeOne`'s party and direction, `email_write_line`.
- `src/lib/emailIn/historyWalk.ts`, `leftOut.ts`, `emailLine.ts`: the kernels the Sent read extends.
- `messages.rfc_message_id` (v2.5504): the fence a sent mail's id goes through.
- Settings → Your account (`SettingsAccountTab.tsx`): the signature card. The guides *reply from a
  thread* and *turn on reading the bids inbox*.

## The PR train

1. **The shape and the words** (S, calls 3 and 4; no decision on the sender needed). `signatureLines`
   drops the owner's line and takes the two free lines; `emailGreeting` retires in favour of the box's
   pre-typed first line; `emailFooter` goes or shrinks to the job line; a plain builder beside
   `buildMessagesEmail`; the signature card on Your account; migration `users.signature_lines`
   (`text[]`, two at most, `SET lock_timeout = '3s'`); the send window's note rewritten; the guide
   *reply from a thread*. Redeploy `messages-email`.
2. **Send through Gmail as the box** (M, calls 5 and 6). The raw builder with files; `messages-email`
   sends through Gmail when the box the reply comes back to is one `readerBoxes` names, else through
   Resend as today; the line keeps the sent mail's Message-ID and gmail id; the function writes
   `email_send_log` and files the sent copy as before; the from line in the reply box reads *from Wendi
   Doll · Click Construction, bids@*. `docs/EDGE_FUNCTIONS.md`'s `messages-email` section. Deploy.
3. **The boxes' Sent** (S, call 1). `gmailHistory` takes the SENT label beside INBOX; `takeOne` writes a
   line going out for a mail the box sent to a person, `who_text` from the From name, never for one the
   app sent (Message-ID held). `email_write_line` unchanged. The reply box's grey line retires once this
   is on. Deploy `gmail-sync`.
4. **A person's own Sent, by their switch** (M, call 1, only if Wendi answers from wendi@). Migration:
   `users.messages_read_my_sent boolean`, `gmail_sync_state` keyed by person as well as box. The
   metadata listing first, the whole read only for a known address. The guide *turn on reading the bids
   inbox* gains the section. Deploy `gmail-sync`.

PR 1 and PR 2 touch `messages-email` and land one after the other. PR 3 and PR 4 touch `gmail-sync`
and land one after the other. The two pairs are independent.

## How to verify

- PR 1: the send window shows the plain shape; a test email to the walk kit's address arrives with no
  bar, her greeting, her signature and nothing after. `npm run walk` still passes its email step.
- PR 2: an email to the kit lands in bids@'s Sent in Gmail and Apple Mail, From *Wendi Doll · Click
  Construction <bids@…>*; a Reply from the kit lands in the thread; the box's own copy, when the kit
  copies it back, writes no second line.
- PR 3: an answer sent from bids@ in Apple Mail lands on the person's thread as ours within a minute,
  the move flips to theirs, Went out lists it with the sender's name.
- PR 4: with the switch off nothing is read; with it on, a mail from wendi@ to a known address lands as
  ours, a mail to an unknown address never does, and `gmail_sync_state` shows her row's health.

## Where it stands

- 2026-10-27: written from Wendi's findings and the code. Finding 5 is v2.5994 (PR #6338). Nothing
  else built. Waiting on the six calls, 3 and 4 with Wendi's eye, 1 with her word on which mailbox she
  answers from.
