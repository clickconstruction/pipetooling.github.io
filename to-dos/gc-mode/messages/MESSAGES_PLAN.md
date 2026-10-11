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
| **Settings → Phone and texts** | The Quo connection, the company number, registration, recordings on, who has a seat, who sees what. | yes, read only |
| The Pipeline's Job activity | Later: calls, texts and emails mixed into the feed; company-only rows yellow, anything the customer saw white. | not yet |
| Photos and the file agent | Later: photos saved on arrival, big files to the job's Drive folder. The mock-up's drafts 8 and 9 hold the design. | not yet |

## The actions

Each one is a button in the prototype; each becomes one press in the app.

- **Answer**: text, email, or a note for the team (yellow). From the thread, Follow up or Customers.
- **Call in Quo**: opens the call in Quo's app; the call comes back as a line with its recording,
  transcript and summary.
- **I have this** / **hand it to …**: claims the thread so two people do not answer the same text.
- **No reply needed** / **Done**: clears the row from Follow up; the thread stays. **Reopen** puts it back.
- **Remind me**: snooze a row to a day; it returns to Follow up then.
- **Write it down** / **Not a promise**: a promised day read from a call, voicemail or text is offered as
  a button, never written on its own. Written down, it becomes the contact's promise on that job.
- **Ask the architect** / **Answer it myself**: a text that reads like a plans question.
- **Who is this?**: name an unknown number.
- **Tie to a job** (drag, or press and hold) / **Untie** / **set the default job** (★) / **add a job to
  the contact** / **remove it**.
- **Quick replies**: the lines typed every day ("Your quote is in your portal", "Did the invite come
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
