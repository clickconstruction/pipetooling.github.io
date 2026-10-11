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
| **Follow up** (the queue) | Everyone waiting on us, one count: *Needs a reply* (texts, voicemails, missed calls nobody answered, longest waiting first, with who has it), then the quote asks it lists today. Answering clears the row. A click anywhere on a row, off its buttons, opens the conversation landed on that message (the owner, 2026-10-11). | yes |
| **Messages** (the history) | Every contact, every channel, search across words and transcripts. No badge of its own. Where the list is hidden (a narrow window), a chevron left of the thread's avatar, with the avatar itself, is the way back to everyone (v1.48). The people list folds to a rail of faces with a court dot on each (‹ beside the search, › to open it again), kept per computer (the owner, 2026-10-11). | yes |
| **A contact's thread** | The header is layout A of `header-mockups.html` (the owner's pick, 2026-10-11): a name line with the who-has-it pill at the right; a facts line that starts with what they are to us as a label before the company, "Customer: Helotes Dental Office", "Trade partner: Hillside Excavation" (the owner, 2026-10-11), then phone, email; the court line with Settled; the Them and Us stamps. The name line's right end holds the conversation's state as one family: the who-has-it pill and Open · Snoozed · Done. The Them and Us stamps are a two-column block hugging the right edge of the court line, the dates lined up under each other (the owner, 2026-10-11: stacked, from the right). One quiet toolbar: Call in Quo and More ▾ (Show all text, Mark STOP, Edit the flow); Text and Email live only on the reply box, since they were the same buttons twice (the owner, 2026-10-11: what is redundant). Their flow is never a button: the right edge always carries a 64px rail, the twin of the list's, with the flow drawn as marks (green ticks done, the ring for the step on now with us or them under it, hollow for what comes, the lanes captioned, a count at the foot); its ‹ opens the 300px panel, the panel's fold › shrinks it back, the choice is kept like the list's, a mark's hover card names the step and what finishes it, and a click opens the panel at that step (the owner, 2026-10-11: the flow is as important as the messages, so a rail like the left one). Below 760px the rail is one row of marks above the thread. The jobs rail is one row of **tiles**, one size (240px; 220px in the folded header), since v1.34 (`jobs-tile-mockups.html` B1, the owner's pick 2026-10-11, after `jobs-chip-size-mockups.html`): the first line is the star, the job's **number badge** in its kind's color (a bid's bid number **B482**, a GC project's project number **#42**, a Pipeline job's HCP or Click number **J1077**; the app's number-first rule, as the header search and the schedule draw a job) and the name, cut with an ellipsis; the second line is **the day in words**, from facts the app keeps: a bid's *bid due Thu Oct 8 · 6 days* (amber within a week, *today*, red *bid was due Wed Sep 30 · 2 days late*, then *bid sent Sep 30* once ours went), a GC project's stage with its day (*building · since Sep 14*), a Pipeline job's Stages word (*billed Oct 1 · pay app 3*). A tile is **blue** when the thread is filtered to its lines and carries the **gold star** when it is the default; since the two marks mean different things, the *Their jobs* hover card is a legend drawn with the thread's own tiles, a blue one and a starred one, saying what each is, what ⧉ and × do, and the drag hint (the owner, 2026-10-11; the chip redraws stay in `jobs-rail-mockups.html`). GC projects carry no number today: the real build reads `projects.project_number` into GC mode and has New project claim the next free one; a project with none reads **GC** in its badge. **When the thread's own column is 640px or narrower** (a container query on the card, so it folds at a phone and at a wide window with the list and the flow open alike), the header folds to five rows (`header-narrow-mockups.html`, the owner's pick C with one change, 2026-10-11): the label and company as a subtitle under the name; the who-has-it pill stays in the corner as its avatar and first name, *R Rosa*, with since-when on its hover card, beside one pill naming the state, *Open ▾*, that opens the three; the phone and the email as links on one line; the court line; the two stamps on one line with the difference mark between them; and Call in Quo, More ▾ and the jobs chips as one strip that scrolls sideways. Then the lines in time order with the job on each, the tiles to filter by job, the reply box (text, email, note for the team), the quick replies. Wherever the thread names a job it is **the badge then the name** (v1.36, the owner's go): the tag on each line (*B482 Boerne Retail Shell ×*, the trade left off as on the tile), the Tie to button and its picker (whose rows read the tile's day words and the tied count), the job's card and the A job page, the Follow up row's job, and the Add a job and Who is this? pickers. | yes |
| **Customers** | The same threads kept to customers, ordered by who is waiting; team notes yellow. A filter of Follow up and Messages, never a second queue. | yes |
| **A job's conversations** | On the job's page: its own recent calls and texts, by contact, with answered or waiting. Reads the messages tied to that job. | yes |
| **Who is this?** | A number the app does not know: name it, say what they are to us, pick their company, tie it to a job. The answer becomes the rule for that number. | yes |
| **Their flow** (the right panel) | Folded by default; *Their flow ›* on the toolbar opens it. The person's journey with us as a small chart in lanes (Once; Per job; Any time): boxes green when done, orange on now with an *us* or *them* tag from the court, a decision as a slanted box, a loop as a dashed box with one pill per round (each ask, each pay application, each change order). Under it: what is on now, whose court, what finishes it, when the app nudges. Drawn from Settings → Flows (the owner picked B with C's tags, 2026-10-11). | yes |
| **Settings → Flows** | One flow per kind of person as a table: step, finished when (a fact the app keeps, never typed), whose move, nudge after, repeats. Renaming a step changes every panel. The same list is meant to drive Follow up's nudges and the Board's ring later. | yes, names editable |
| **A message's window** | Click any message: the whole text with its facts (who, the exact time received or sent, what it came through, the job it is tied to, whether a copy is kept), its attachments, its highlights, and the tools: Highlight the selected words, Copy, Print or save as PDF, Share (the Mac's share sheet), Tie to, Reply. | yes |
| **Settings → Phone and texts** | The Quo connection, the company number, registration, recordings on, who has a seat, who sees what. | yes, read only |
| The Pipeline's Job activity | Later: calls, texts and emails mixed into the feed; company-only rows yellow, anything the customer saw white. | not yet |
| Photos and the file agent | Later: photos saved on arrival, big files to the job's Drive folder. The mock-up's drafts 8 and 9 hold the design. | not yet |

## The actions

Each one is a button in the prototype; each becomes one press in the app.

- **Answer**: text, email, or a note for the team (yellow). From the thread, Follow up or Customers.
- **Call in Quo**: opens the call in Quo's app; the call comes back as a line with its recording,
  transcript and summary.
- **Who has it**: a person pill in the top right corner of the thread and on the Follow up row, not a
  menu (the owner, 2026-10-11): it reads
  *You have this*, *Rosa has this* or *Nobody has it · Take it*, with initials and since when. Pressing it
  lists the team with initials, what each does, how they are right now and how many conversations each
  holds; *I'll take it* first when it is not yours, then each teammate, then *Nobody*. A take or a
  hand-off writes a quiet gray event line in the thread ("Robert handed Greg to Wendi · 10:36 AM"), the
  way Intercom records an assignment, so the thread keeps it without reading as a note. Beside the pill,
  the thread's state is one control with three states, Open · Snoozed · Done, as Intercom's inbox has it
  (the owner, 2026-10-11: take hints from Intercom and the CRMs). Each teammate shows a presence dot.
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
  the contact** / **remove it**. Removing asks first (the owner, 2026-10-11: harder to remove, with a useful ask): the
  modal names the job, says it changes only the tie to this person and the job itself stays, how many messages are tied
  and that they keep their tie, where new messages land after if it was the default, and that + add a job puts it back;
  **Keep the job** is the blue, focused answer and **Take it off Elena** the plain one, as the app's own confirms are
  built. The thread gets a gray event line naming who took it off.
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

## Whose court it is in

In place of a bare "waiting 6 d", the header's third line says whose move it is and shows both last
words (the owner, 2026-10-11): an orange **Our court · 6 d** when the last word was theirs (it counts from
their last message), a green **Their court · 2 d** when the last word was ours (it counts from our last
message, or reads *Their court · until Wed Oct 7* while a promise runs), and beside it two stamps,
**Them** text · Sep 26 *+6* and **Us** email · Sep 19 *+13*: an older stamp is its date and a mark in parentheses for how many days ago, *(+6)*, a stamp from today keeps its time, *today · 11:30 AM*, and the block's hover card spells each out in full, *text · Sat, Sep 26 · 2:14 PM · 6 days ago*, then draws **a small calendar** of the last six weeks (or back to the first message), S M T W T F S with each week's dates at its right (*Sep 27 – Oct 3 · this week*), each day colored by who wrote, blue us, green them, split for both, a yellow dot for a team note, today outlined, a count on a day with more than one, so who wrote and when reads at a glance (the owner, 2026-10-11; the owner's pick 4 of five compact forms for the stamp; the folded one-line form uses the same compact date and leaves the mark off, since the mark between the stamps carries the difference) (the owner, 2026-10-11; the same on the Follow up row's snippet and the job card's list, while a line in the thread keeps the bare time under its day divider). On the folded header the two stamps are **one sentence in words, no color** (`stamps-words-mockups.html` B, the owner's pick 2026-10-11, after the pills whose green read as the court's): *Priya texted last Saturday; we emailed two weeks ago.* The newer side comes first, so the order says who wrote last; the channel is the verb (texted, emailed, called, left a voicemail); the when is *today at 11:30 AM*, *yesterday*, the weekday (*on Wednesday* this week, *last Saturday* the week before), *last week*, *two weeks ago*, *three weeks ago*, then the date. The person is named, never a guessed pronoun; a number nobody has named reads *they*. The sentence is the hover target for the same card as the block, which keeps the exact stamps and the calendar. A reply, an email or a call
from us moves the ball to their court; their next message moves it back. A note for the team moves
nothing, since they never saw it. The Follow up rows and the Messages list carry the same court word in
small, so the queue reads "Our court · 6 d" without opening the thread. Snoozed and the promise stay as
their own pills.

**We owe them.** Our last word does not always end our turn: "I will send the start date Monday" is a
message from us and a thing we still have to do (the owner, 2026-10-11). So the send window asks one
thing before Send, *After this goes, is anything still on us?*, with what it is and a day; the toolbar's
*We owe them…* sets the same later. While it is open the ball stays in our court whatever was said last,
the header reads *Our court · we owe the start date · by Mon Oct 5*, Follow up lists it under **We owe
them** with who marked it and when, and the thread gets a gray event line. *Settled* opens a note for the
team at the bottom of the thread, *Settling: we owed the start date · by Mon Oct 5*, and the note is what
settles it: the person says how or why, the note goes in the thread with a *✓ settled the start date* chip,
the row closes as any note does, and the court goes back to whose word was last (the owner, 2026-10-11: a
settle always says why, for the team). *Not settled yet* backs out. Settled's hover card also lists the other things one could do about what we owe, each with its own control (the owner, 2026-10-11): send it to them, with the before-it-goes window's question settling it when nothing is still on us; *We owe them…* to change what or the day; Snoozed to put the row off; or leave it, and Follow up keeps it. The app's table needs an owed item per
contact: what, by when, who marked it, when, when it was settled and the note that settled it.

## Every control explains itself on hover

Hovering any control (and tabbing to it) opens a small white card below it (never above: a card that would run past the bottom slides up only as far as it must, the owner, 2026-10-11), the look of a little window: the
control's name, one sentence on what it does, and in quieter type what it changes elsewhere (the owner,
2026-10-11: "like a modal"). The rule for the words: where the row goes, what counts change, what the
thread keeps, what undoes it. Written so far: Open, Snoozed, Done, Mark STOP and Clear opt-out, Call in
Quo, the who-has-it pill in its three states, Show all text, Tie to, and Edit on the quick replies. In
the app these are the words a first-timer reads, so they follow `plainWords.ts`.

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

## Who gets a new message (proposed 2026-10-11, the owner's call)

The owner asked: when a new email comes in, how does the app know who to assign it to? Proposed, in
this order, the first that fits:

1. **Whoever answered this person last**, if they are here today (the presence dot). Continuity beats
   the rule: Elena keeps talking to the person she talked to yesterday.
2. **By who they are**, from the two seats decided on 2026-10-05: a customer → the assistant (Rosa);
   a trade partner or an architect → the estimator (Robert). The rule lives in Settings → Phone and
   texts and the owner can change it there.
3. **A number or address nobody knows → nobody**: the row reads *Nobody has it · Take it* and whoever
   answers first takes it, after *Who is this?* names them.

Whatever assigned it, the pill says so ("Rosa has this · by the rule"), the thread gets the gray event
line, and anyone can take it or hand it on. An email that names a job in its subject or title block is
tied to that job as well as to the person (the file agent's reading, draft 9). Not proposed: round robin
or load balancing; the team is three people and the rule is enough. Open: what happens when the rule's
person is out (fall to the other seat, or to nobody).

## Decided 2026-10-11

- The contact owns the messages; jobs are associated with the contact; a message may be tied to
  one job. (The owner's words above.)
- It is built in the GC board first: the Follow up tab and the Messages tab on `/gc`.

## Open, from the flow panel (2026-10-11)

- Does a customer's flow start at the bid or at the first conversation? (Drawn as the first conversation.)
- Is a trade partner's onboarding one shared flow, or does it differ by trade? (Drawn as one.)
- Which facts finish each step: the table names them in words; each must map to a column or a row the app has.
- Whether the flow list also drives Follow up's nudges and the Board's ring, or only the panel at first.

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
- **v1.12, 2026-10-11**: a click anywhere on a Follow up row opens the conversation landed on that
  message, with a short flash on it; the row's snippet is cut to a sentence or two; a job that is
  named like the company is not repeated on the row.
- **v1.13, 2026-10-11**: *Who has it* is a person pill with a team picker: initials, role, how they are
  right now, how many each holds, I'll take it, hand to, nobody; a hand-off writes a gray event line
  in the timeline; presence dots; the thread's Open · Snoozed · Done control beside the pill (Intercom's
  hints, the owner's ask).
- **v1.14, 2026-10-11**: the *who has it* pill sits in the thread's top right corner, on the name row;
  the other actions move to their own row under it.
- **v1.15, 2026-10-11**: hover cards on the controls, white and window-like: name, what it does, what
  it changes. Open, Snoozed, Done, Mark STOP, Call in Quo, the who-has-it pill, Show all text, Tie to,
  Edit quick replies. They show on keyboard focus too.
- **v1.16, 2026-10-11**: the thread header is layout A from `header-mockups.html` (the owner picked A
  over B and C): name line with the pill, facts line, one toolbar with Text and Email buttons that start
  a reply, the jobs rail as one row with its hint at the right.
- **v1.16, later**: Settings shows the proposed *Who gets a new message* rule (last answerer if here,
  else by who they are, else nobody).
- **v1.17, 2026-10-11**: the facts line leads with the kind as a label before the company:
  "Customer: Helotes Dental Office".
- **v1.18, 2026-10-11**: the email moved under the name and back again the same hour; it stays on the
  facts line after the phone (the owner's call).
- **v1.19, 2026-10-11**: whose court it is: the header's third line reads Our court or Their court
  with the count, and the two stamps Them and Us with the channel and time of each last word; the
  Follow up rows and the list carry the court word. An older email from Rosa to Priya seeds the Us stamp.
- **v1.20, 2026-10-11**: *We owe them*: the send window asks whether anything is still on us; the
  toolbar's *We owe them…* and *Settled*; the header reads *Our court · we owe …*; Follow up lists them
  under *We owe them*; events in the thread. Priya seeds one: the start date by Mon Oct 5.
- **v1.21, 2026-10-11**: the send window's question is one big tick row right above the Send button,
  the whole row a target (the owner: make it easy to click smoothly); the what-and-when boxes appear
  only once it is ticked, with the cursor in the first.
- **v1.22, 2026-10-11**: the tick row sits at the right, directly above Send as email or Send as text,
  with the box on its right edge in line with the button.
- **v1.23, 2026-10-11**: list fixes from the owner's screenshot: the right column is capped so a long
  court word never squashes the name; the list's court pill is the short form ("Our · we owe", the
  full words on hover); an email's snippet is its subject; a missed call's reads "no voicemail".
- **v1.24, 2026-10-11**: the people list collapses to a rail of faces (‹ beside the search), each
  with its court dot and a hover card; › opens it again; the choice is kept in the browser.
- **v1.25, 2026-10-11**: the right panel, *Their flow*, folded by default: the chart in lanes with loops
  and the us/them tag on the current box (mock-up B with C's tags, the owner's pick), the on-now lines
  under it, and Settings → Flows with the editor table (names editable). Every person has a place in
  their flow in the demo.
- **v1.25, later**: the wrapper's modifier class collided with the chart's own class and stacked the
  columns; renamed. The panel and the rail now stick to the top of the window while the thread scrolls.
  Checked with headless screenshots at 1400 px, open and folded.
- **v1.26, 2026-10-11**: at a window between 760 and 1040 px the people list folds itself into the
  rail while the flow is open, so the panel keeps its column at the right (the owner's screenshot showed
  it under the thread at about 1000 px); only under 760 px does the panel go below the thread.
- **v1.27, 2026-10-11**: the chart runs down each lane, one box per line with a small arrow between,
  the us/them tag inside the box at its right, a fork marked by a colored left edge, and a loop as a
  dashed group with its caption on its own line and the rounds as pills (the owner: cramped at 280 px).
- **v1.28, 2026-10-11**: in the header only the name line sits beside the avatar; the facts line,
  the court line and the stamps start at the left edge (the owner: no need to push them over).
- **v1.29, 2026-10-11**: the toolbar tidied: Text and Email gone from it (the reply box has them),
  Open · Snoozed · Done up beside the who-has-it pill, Mark STOP and Show all text and Edit the flow
  behind More ▾, Their flow › at the far right, the jobs rail without its hint sentence.
- **v1.30, 2026-10-11**: Settled opens the team note at the bottom with a Settling banner; the note
  settles it and carries a ✓ settled chip; Not settled yet backs out; the Follow up list's Settled does the same.
- **v1.31, 2026-10-11**: the stamps as a right-hugging two-column block (rail-mockups.html A); the flow as a
  64px rail of marks at the right edge, opening to the panel (rail-mockups.html R1); the toolbar's button gone.
- **v1.32, 2026-10-11**: the header folds when the thread's column is 640px or narrower (header-narrow-mockups.html,
  the owner's pick C with the who-has-it pill kept in the corner): the company as a subtitle under the name, *R Rosa*
  and *Open ▾* in the corner, phone and email as links on one line, the stamps on one line with the Us-against-Them
  mark between them (*−7*, the owner's ask), the toolbar and the jobs as one scrolling strip; the More menu pins to
  the window inside the strip. A container query, so a narrow column at a wide window folds too. Wide is unchanged.
- **v1.33, 2026-10-11**: the *Their jobs* hover card is a legend with the thread's own chips: a blue one (the
  filter, what you are looking at) and a gold-starred one (the default, where new messages land), then ⧉, × and
  the drag hint (the owner: explain the two marks in the card instead of redrawing the rail; `jobs-rail-mockups.html`
  keeps the three redraws for later).
- **v1.34, 2026-10-11**: the jobs rail's chips are tiles of one size (`jobs-tile-mockups.html` B1, the owner's pick
  after `jobs-chip-size-mockups.html`): the number badge and the name on the first line, the day in words on the second
  with its tone (soon, today, late; sent once ours went), from the job's facts; the jobs in the demo carry their numbers
  (B482, B491, #42, #47, J1077); the legend's samples are tiles too. The trade left the tile (it is on the header and
  each line); the message tags and the tie picker are unchanged.
- **v1.35, 2026-10-11**: every popover (the who-has-it picker, the state pill's menu, More ▾, Tie to) keeps inside the
  window: pinned to its button's right edge as before, it flips to the left edge when it would run past the window,
  and narrows if it still must (the owner's screenshot: More ▾ hung off the left of a narrow pane). The real build's
  rule for the same: a menu is placed from its button's rect and clamped to the viewport, never by `right:0` alone.
- **v1.36, 2026-10-11**: the job number everywhere the thread names a job (the owner's go): the badge then the name
  on each line's tag, the Tie to button and its picker (rows read the tile's day words), the job's card, the A job
  page, the Follow up row and the Add a job and Who is this? pickers; the kind pill is gone, the badge's color says
  the kind. jobLabel with the trade stays for toasts and hover text.
- **v1.37, 2026-10-11**: × on a tile asks first: a modal with the job's badge, what changes and what does not (the
  job stays in the app; the N tied messages keep their tie; where new messages land next if it was the default; + add
  a job puts it back), Keep the job as the blue focused answer, Take it off as the plain one; a gray event line
  records the removal (the owner: harder to remove, with a useful ask).
- **v1.38, 2026-10-11**: the *Their jobs* label stacks on two lines beside the two-line tiles, the tiles' height, so
  it reads as the row's heading (the owner's ask).
- **v1.39, 2026-10-11**: the label is right-aligned against a thin rule, and the tiles are a block beside it, so a
  second row of tiles starts at the rule, not under the label (the owner's ask for the rule; the block from the
  self-review).
- **v1.40, 2026-10-11**: a time with no day divider beside it says *today*: the Them and Us stamps (full and short),
  the Follow up row's snippet, the job card's conversations and the A job page (the owner's ask).
- **v1.41, 2026-10-11**: the header's stamps end with how long ago (*· yesterday*, *· 2 days ago*; today says only
  today); the folded one-line form leaves it off (the owner's ask).
- **v1.42, 2026-10-11**: the days-ago on a stamp is a small mark, *+6*, not words (the owner's ask).
- **v1.43, 2026-10-11**: the stamp's compact form (the owner's pick 4): an older stamp is its date and the *+6* mark,
  today's keeps its time; the Them and Us hover card spells each stamp out in full with the weekday, the time and
  the days ago in words. The folded line uses the same date.
- **v1.44, 2026-10-11**: the Them and Us card draws a minimalist calendar of the last six weeks, S M T W T F S,
  each day colored by who wrote (blue us, green them, split both), a yellow dot for a team note, today outlined,
  days to come dashed, a count on a busy day (the owner's ask: who communicated and when, at a glance).
- **v1.45, 2026-10-11**: the card loses its two sentences (the title, the two stamps and the calendar are the card),
  and each week is named at its right by its dates, *Sep 27 – Oct 3 · this week* (the owner's ask).
- **v1.46, 2026-10-11**: a hover card always opens below its control; when it would run past the bottom it slides
  up only as far as it must, never above the control (the owner: it will never fit up).
- **v1.47, 2026-10-11**: between 761 and 860 px with the flow open, the thread had fallen into the hidden list's 64px
  column and the panel had taken the thread's (the owner's screenshot); that band now lays the thread and the
  280px panel side by side with no list column.
- **v1.48, 2026-10-11**: where the people list is hidden, the *‹ Everyone* line is gone; a chevron sits left of the
  avatar and the two are one press back to everyone, highlighted together on hover, with a hover card saying so
  (the owner's ask).
- **v1.49, 2026-10-11**: the folded header's stamps are two pills, the newer filled in its side's color (green them,
  blue us), the older plain with its +N; the one-line form and its signed between-mark are gone
  (`stamps-narrow-mockups.html` C, the owner's pick).
- **v1.50, 2026-10-11**: the days-ago mark reads *(+6)*, in parentheses and no longer a bordered pill, on the stamp
  pills and the wide block alike (the owner's ask).
- **v1.51, 2026-10-11**: the folded header's stamps are one sentence in words with no color, the newer side first
  and the channel as the verb (`stamps-words-mockups.html` B, the owner's pick over the mock-up's own A: the pills'
  green read as the court's). The wide block keeps its dates and (+6).
- **v1.52, 2026-10-11**: Settled's hover card lists the other options, each with its control drawn: send it to them
  (the send window's question settles it), We owe them… to change it, Snoozed, or leave it (the owner's ask). Open:
  the send window today keeps what we owe ticked and fixed while something is owed; it should offer 'this message
  settles it' so the first option is true.
