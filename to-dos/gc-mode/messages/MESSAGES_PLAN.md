# Messages: every call, text and email with a contact, in one place

> The plan and the prototype iterate together. `prototype.html` beside this file is the clickable
> picture of what we want built; this file is the shape, the decisions, the open questions and the
> build order. Change one, change the other. The 2026-10-05 mock-up that started it is
> `../quo-messages-mockup.html`; the owner's answers from that day are in `../README.md` → *Calls,
> texts and big files* and are repeated here so this folder stands alone.

last_updated: 2026-10-11
status: prototype v1, nothing built in the app

## The idea, in the owner's words

- 2026-10-04: could one company number and one mailbox feed a message platform in the app?
- 2026-10-05: ten answers (below).
- 2026-10-11: *"All of these messages are really stored with a contact, and then we associate jobs
  with that contact. And sometimes particular messages with particular jobs."* Build it in the GC
  board first, as a prototype with an adjoining plan.

## The model

Three things, and the order matters.

1. **A contact owns every message.** A contact is one person we talk with: a name, the phone
   numbers and email addresses that are theirs, what they are to us (customer, trade partner,
   architect, inspector, someone we do not know yet) and the company they work for. Every call,
   voicemail, text, email and team note hangs on the contact, in time order, whatever channel it
   came through. A number the app does not know is a contact too, named "(830) 555-0172" until
   someone says who it is; the answer renames the contact and keeps its thread.
2. **Jobs are associated with the contact.** A contact's jobs are the bids, GC projects and
   Pipeline jobs they are part of: as the customer, as a trade partner asked to quote, as the
   architect. The app knows most of these already (the ask, the customer record, the architect on
   the project); a person can add or remove one. One of them is the **default**: new messages from
   the contact go there until someone changes it.
3. **Sometimes a particular message is tied to a particular job.** A message starts on the
   contact's default job. Drag another of the contact's jobs onto it (press and hold on a phone) to
   tie it there, or untie it so it sits on the contact alone. A job's page reads the messages tied
   to it; the contact's thread reads all of them, with the job on each line and chips to filter.

What this rules out: a thread per job (one company quoting four bids would have four threads and
the same voicemail in none of them), and a thread per phone number (the same person texting from
a new cell starts over). The person is the spine; jobs are labels on the person and on the lines.

## The surfaces

| Surface | What it shows | In the prototype |
|---|---|---|
| **Follow up** (the queue) | Everyone waiting on us, one count: *Needs a reply* (texts, voicemails, missed calls nobody answered, longest waiting first, with who has it), then the quote asks it lists today. Answering clears the row. | yes |
| **Messages** (the history) | Every contact, every channel, search across words and transcripts. No badge of its own. | yes |
| **A contact's thread** | The contact's header (what they are to us, their company, their numbers), the jobs rail with the default starred, the lines in time order with the job on each, chips to filter by job, the reply box (text, email, note for the team), the quick replies. | yes |
| **Customers** | The same threads kept to customers, ordered by who is waiting; team notes yellow. A filter of Follow up and Messages, never a second queue. | yes |
| **A job's conversations** | On the job's page: its own recent calls and texts, by contact, with answered or waiting. Reads the messages tied to that job. | yes |
| **Who is this?** | A number the app does not know: name it, say what they are to us, pick their company, tie it to a job. The answer becomes the rule for that number. | yes |
| **A message's window** | Click any message: the whole text with its facts (who, the exact time received or sent, what it came through, the job it is tied to, whether a copy is kept), its attachments, its highlights, and the tools: Highlight the selected words, Copy, Print or save as PDF, Share (the Mac's share sheet), Tie to, Reply. | yes |
| **Settings → Phone and texts** | The Quo connection, the company number, registration, recordings on, who has a seat, who sees what. | yes, read only |
| The Pipeline's Job activity | Later: calls, texts and emails mixed into the feed; company-only rows yellow, anything the customer saw white. | not yet |
| Photos and the file agent | Later: photos saved on arrival, big files to the job's Drive folder. The mock-up's drafts 8 and 9 hold the design. | not yet |

## The actions

Each one is a button in the prototype; each becomes one press in the app.

- **Answer**: text, email, or a note for the team (yellow). From the thread, Follow up or Customers.
- **Call in Quo**: opens the call in Quo's app; the call comes back as a line with its recording,
  transcript and summary.
- **I have this** / **hand it to …**: claims the thread so two people do not answer the same text.
- **No reply needed** / **Done**: clears the row from Follow up; the thread stays. A reply closes it the
  same way, and so does **a note for the team**: whoever writes the note has looked at it, so the row
  closes on a note every time (the owner, 2026-10-11). Nothing reopens by hand; a new message from
  them reopens the row by itself.
- **Remind me**: snooze a row to a day; it returns to Follow up then.
- **A day was heard** / **Not a promise**: a day read from a call, voicemail or text is offered, never
  written on its own, and never as one general button (the owner, 2026-10-11: a general *Write it down*
  is confusing when the day could be a payment, a quote or a start). The offer names what the day is a
  promise of and where it goes, by who they are: a trade partner's quote (their ask on the Board, which
  Follow up and the ring read), a start or delivery (the schedule), their insurance or W-9 (the company's
  papers); a customer's payment (the Pipeline's payment promises, which the chase loop reads), their
  answer on our bid (the bid's follow-up), a day we can be on site (the schedule as a wait); an
  architect's answer (the plan question) or certificate (the pay application). The written line repeats
  exactly what and where. The first choice is the likely one for who they are; the others are one press.
  The offer is one line: the day, "is a promise of", and short choices with a one-word tag for where it
  goes (Board, Schedule, Papers, Pipeline, Bid); the job is already on the message's own line, so the
  choice does not repeat it (the owner, 2026-10-11: too long and wordy).
- **Ask the architect** / **Answer it myself**: a text that reads like a plans question.
- **Who is this?**: name an unknown number.
- **Tie to a job** (drag, or press and hold) / **Untie** / **set the default job** (★) / **add a job to
  the contact** / **remove it**.
- **Before it goes**: *Send text…* and *Send email…* never send at once. They open one window with
  two tabs that show the message the way the contact's own inbox or phone shows it: the email with its
  inbox row, From, To, the subject made from the job and the first line, the letterhead, the greeting from
  the contact's name, the signature and the footer; the text as a green bubble under the texts already
  in their thread, from the company number, with the character count, how many texts it is, and on
  their first text from us the company name and the opt-out line the carriers require. The window warns
  when there is no email or number on file, when they sent STOP, or when a text runs past two pieces.
  *Send a test to me* and *Send as email* or *Send as text* sit in the window; *Change it* goes back.
  The window is the confirmation: the only Send that sends is the one inside it (the owner, 2026-10-11).
  A note for the team is added at once; nobody outside sees it.
- **Tie to, as a picker**: the draft's *Tie to* opens a list of the contact's jobs, each with its name,
  what it is (a bid, a GC project, a Pipeline job), its day or stage, how many messages are tied to it,
  the ★ default marked, and an *Open* button on the right that shows the job's card in a window: what it
  is, its day, the customer, the trades asked, the people on it, the last conversations tied to it, and
  a button to open the bid or the project itself. *No job* and *Add a job* sit at the bottom. The same
  card opens from the ⧉ on a job in the rail.
- **Four lines, or the highlights**: a long message shows its first four lines in the thread with *the
  whole email* under it; *Show all text* at the top of the thread, off by default, shows every message
  in full for that thread (the owner, 2026-10-11). Select words in a message's window and press
  *Highlight*: the excerpt is kept with who and when, marked in the window, and the thread shows the
  highlights in place of the four lines from then on. The clamp and the highlights apply to any long
  message, a transcript or a note too, not only email.
- **Attachments**: a chip per file under the message (name, size, kind; a picture shows a thumbnail).
  In the window each has Open, Save to Drive (the file agent copies it to the job's Plans or Team only
  folder, a quote or a photo to Team only) and, for a quote, *Enter it as their quote*. The app keeps its
  own copy on arrival, as photos (draft 8); a link is a link. Open: what an attachment on an outgoing
  message looks like, and whether a highlight should also become a team note on the job.
- **Quick replies**: a two-row strip that scrolls sideways above the box, in its own gray panel so it
  reads apart from the box below it, never a loose pile (the owner, 2026-10-11); a press fills the box
  and nothing sends. The team's lines come first, then the person's own. **Edit** on the strip opens the
  quick replies window: the team's and mine in two lists, each line with who added it and when and, once
  changed, who last edited it and when; anyone can add a line, for the team or just for themselves, and
  anyone can edit any line (the owner, 2026-10-11). The window keeps the history on the line itself, so
  the app's table needs added_by, added_at, edited_by, edited_at and a scope (team or one person). The lines typed every day ("Your quote is in your portal", "Did the invite come
  through?", "Checking on the number, still good for today?").
- **Opt out**: a STOP from the contact flags the number; the app refuses to text it and says so.
- **Search**: words in texts, emails, transcripts and summaries, across every contact.

## Decided by the owner (2026-10-05)

1. One company number for everyone, not one per estimator. Each person has a Quo login; *Robert
   has this* on a thread keeps two people from answering the same text.
2. Everyone on the team sees every thread. The Money tab stays the owner's.
3. Reply from several places: the thread, Follow up, Quo's phone app, a Customers tab in Bids, and
   later the Pipeline's Job activity (team-only rows yellow, anything the customer saw white).
4. Pick the job by dragging it onto a message; press and hold on a phone. Closed jobs one click away.
5. Record every call, no notice (Texas one-party consent).
6. Photos to Drive in one move; the file agent copies and names them.
7. Quo Business, two seats: the assistant (customers) and the estimator (trades). Everyone else
   reads every thread and texts from the app with no seat. About $75 a month.
8. The file agent files on its own when it is sure; Move and Undo on every file.
9. Every job's Drive has Plans (anyone with the link) and Team only.
10. No files@ address; the team forwards to bids@.
11. Claude is ours, not Quo's: reading texts and summaries for a promised day or a plans question
    is an Anthropic account the app calls.

Left for the owner: yearly or monthly billing; Claude from the first day or later.

## Decided 2026-10-11

- The contact owns the messages; jobs are associated with the contact; a message may be tied to
  one job. (The owner's words above.)
- It is built in the GC board first: the Follow up tab and the Messages tab on `/gc`.

## Open, from the 2026-10-11 review of the mock-up

Each gets an answer here and a picture in the prototype before it is built.

- **Email as a channel.** How bids@ is read (a Gmail grant or a forwarded copy), how a reply goes
  out as the company, and how a thread's emails and the sent copies in Documents line up.
- **The phone layout.** Follow up and the thread at 375 px; press and hold in place of drag.
- **Which record a contact is.** The app has people in several places (customers' contacts, GC
  customer contacts, a trade company's contacts, the Person Desk). A contact here must be one of
  them or point at one, never a fifth list.
- **Who gets pinged.** The badge, a push to a phone, the Dashboard's Needs you line, quiet hours.
- **A trade's portal messages and its Quo texts**: one thread or two.
- **Outbound beyond a text**: send our bid, the schedule, a pay application from the thread.
- **A text that is a promise to pay** becomes a payment promise on the Pipeline, not a quote promise.
- **Opt-out and compliance**: STOP and HELP, the opt-out flag, what the app refuses to send.
- **Missed-call text-back and after hours**: Quo's or ours, and what the thread records.
- **Correcting a tie** and whether the job's feed follows.
- **Search inside transcripts.**
- **Retention and legal hold**: how long recordings are kept, who deletes, how a matter freezes a thread.
- **One inbox**: the Customers tab is a filter, never a second queue with its own count.

## How it would be built, once the shape is settled

In the order a GC lane builds: a plan page per cut, SQL first, then the read, then the screens.

1. **Tables**: `contacts` (or a view over the people the app already has), `contact_channels`
   (a phone number or email that is theirs), `contact_jobs` (the association, with the default),
   `messages` (one row per call, text, email or note: contact, job or null, channel, direction,
   who, when, the words, the recording and transcript links, the state), `message_promises`
   (what was written down and by whom). Read-only and digital-twin fences as every GC table.
2. **The Quo link**: one webhook receiver (`message.received`, `call.completed`, `call.missed`,
   `call.voicemail.completed`, `call.recording.completed`, `call.transcript.completed`,
   `call.summary.completed`), checked as Quo's, matched to a contact by number, threaded, tied to the
   default job; one sender for a text from the company number. Replies made in Quo's own app come
   back through the same events.
3. **Follow up**: *Needs a reply* at the top, one count; claim, done, remind me.
4. **Messages**: the history and search; the thread with the jobs rail, drag and press-and-hold.
5. **Who is this?** and the matching rule.
6. **Customers** as a filter; the job's conversations list on the project page.
7. **Email** through a shared Google mailbox, into the same threads.
8. Later: Job activity on the Pipeline, photos, the file agent.

## Prototype log

- **v1, 2026-10-11** (`prototype.html`): Follow up with Needs a reply (claim, no reply needed, reply,
  write down a promised day, ask the architect), Messages with search and the All, Customers,
  Trades, Unknown filters, the contact's thread with the jobs rail (★ default, drag a job onto a
  line, press and hold on a narrow screen, untie, add a job), quick replies, a note for the team in
  yellow, Who is this?, a job's conversations, Settings read-only, an opt-out flag. Made-up people
  from the GC mode prototype. Nothing is saved; reload starts over.
- **v1.1, 2026-10-11**: the *Note for the team* button in the reply box is yellow, the same yellow a note
  has on the page (the owner: the button should look like what it makes).
- **v1.2, 2026-10-11**: *Preview email* and *Preview text* under the draft, one window with two tabs
  drawn as the contact's own inbox and phone, with the counts, the first-text footer, the warnings, and
  *Send a test to me*. Is this the best we can do? Two things it still lacks: the email's subject is not
  editable in the window (the app's emails set their own subjects, so this follows), and a photo or
  file attached to the draft is not drawn yet (photos are a later draft).
- **v1.3, 2026-10-11**: the preview window is the confirmation screen. *Send text…* and *Send email…*
  open it on the matching tab; only the Send inside it sends. The two preview links are gone, since
  Send is the preview; the character count stays under the box.
- **v1.4, 2026-10-11**: *Tie to* is a picker, not a native menu: each job with its kind, day, tied count
  and an *Open* button that shows the job's card in a window (facts, people, last conversations, Open
  the bid or the project). The rail's jobs open the same card from ⧉.
- **v1.5, 2026-10-11**: a note for the team closes the row like a reply does; the Reopen button is gone,
  and a new message from them reopens the row by itself (a *They text back* demo button shows it).
- **v1.6, 2026-10-11**: quick replies sit in a two-row strip that scrolls sideways, with a label and a
  faded right edge that says there is more; twelve lines in the demo.
- **v1.7, 2026-10-11**: no general *Write it down*. A heard day offers the kinds of promise it could be
  for who they are, each naming where it goes; the written line repeats what and where. Elena's
  voicemail about the check for pay application 3 shows a customer's payment promise beside Greg's quote.
- **v1.8, 2026-10-11**: the quick replies strip sits in a gray panel of its own, set apart from the
  entry box under it.
- **v1.9, 2026-10-11**: the promise offer is one line with short choices and a one-word tag for where
  each goes; the full sentence lives on the written line and on the hover.
- **v1.10, 2026-10-11**: *Edit* on the quick replies strip opens the window: the team's and mine, who
  added and edited each and when, add for the team or just me, edit any line in place.
- **v1.11, 2026-10-11**: a long message shows four lines; *Show all text* per thread, off; click a
  message for its window (facts, tools: Highlight, Copy, Print or PDF, Share, Tie to, Reply);
  highlights kept with who and when and shown in place of the four lines; attachment chips with Open,
  Save to Drive and Enter it as their quote. Two long emails (Jonah's addendum, Greg's quote) show it.
  Is this the best we can do? The clamp covers transcripts and notes too; highlights carry a name;
  Reply from the window puts the cursor in the box. Open: a highlight as a team note; what Share
  carries for a call (the recording or the summary).
