# Messages: every call, text and email with a contact, in one place

> Moved to `main` on 2026-10-14 from `to-dos/gc-mode/messages/MESSAGES_PLAN.md` on branch `spike/gc-mode`, where the prototypes and
> mock-ups it names by a bare file name still live (`git show origin/spike/gc-mode:to-dos/gc-mode/messages/<file>`). The
> other plans it names beside it are `docs/MESSAGES_PLAN.md`, `docs/MESSAGES_BUILD_PLAN.md`,
> `docs/MESSAGES_RESIDENTIAL_BUILD_PLAN.md`, `docs/MESSAGES_RESIDENTIAL_HANDOFF_2026-10-13.md` and
> `docs/MESSAGES_LIVE_WALK_2026-10-14.md`. This copy is the one kept current; the map is `docs/MESSAGES_ARCHITECTURE.md`.

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
| **Follow up** (the queue) | Everyone waiting on us, one count: *Needs you* first (rows a team note brought back on its day, v1.128), then *Needs a reply* (texts, voicemails, missed calls nobody answered, longest waiting first, with who has it; a missed call or a voicemail carries *Call back in Quo*), *We owe them*, *Nudges from the flow* (one row per step quiet past its nudge, with Call in Quo, Text instead or Write it, and Hold; v1.101) and then the quote asks it lists today. Answering clears the row. A click anywhere on a row, off its buttons, opens the conversation landed on that message (the owner, 2026-10-11). | yes |
| **Messages** (the history) | Every contact, every channel, newest conversation first and nothing else (v1.147), search across words and transcripts. No badge of its own. Where the list is hidden (a narrow window), a chevron left of the thread's avatar, with the avatar itself, is the way back to everyone (v1.48). The people list folds to a rail of faces with a move dot on each (‹ beside the search, › to open it again), kept per computer (the owner, 2026-10-11). | yes |
| **A contact's thread** | The thread is a window (v1.69, `thread-regions-mockups.html` D): the header pins at the top (the whole of it since v1.150) and the reply box at the bottom, and the conversation scrolls between them in a tinted well (v1.68). The header is layout A of `header-mockups.html` (the owner's pick, 2026-10-11): a name line with the who-has-it pill at the right; a facts line that starts with what they are to us as a label before the company, "Customer: Helotes Dental Office", "Trade partner: Hillside Excavation" (the owner, 2026-10-11), then phone, email; the move line with Settled; the Them and Us stamps. The name line's right end holds the who-has-it pill; Open · Snoozed · Done came off it in v1.146 (the state is the app's to set, read on the move line, and pressed from Follow up's row or ⋯). The Them and Us stamps are a two-column block hugging the right edge of the move line, the dates lined up under each other (the owner, 2026-10-11: stacked, from the right). A pair after the name, ☎ and ⋯ (Show all text, Mark STOP, See their page, Edit the flow), since v1.138; Text and Email live only on the reply box, since they were the same buttons twice (the owner, 2026-10-11: what is redundant). Their flow is never a button: the right edge always carries a 64px rail, the twin of the list's, with the flow drawn as marks (green ticks done, the ring for the step on now with us or them under it, hollow for what comes, the lanes captioned, a count at the foot); its ‹ opens the 300px panel, the panel's fold › shrinks it back, the choice is kept like the list's, a mark's hover card names the step and what finishes it, and a click opens the panel at that step (the owner, 2026-10-11: the flow is as important as the messages, so a rail like the left one). Below 760px the rail is one row of marks above the thread. The jobs rail is one row of **tiles**, one size (240px; 220px in the folded header), since v1.34 (`jobs-tile-mockups.html` B1, the owner's pick 2026-10-11, after `jobs-chip-size-mockups.html`): the first line is the star, the job's **number badge** in its kind's color (a bid's bid number **B482**, a GC project's project number **#42**, a Pipeline job's HCP or Click number **J1077**; the app's number-first rule, as the header search and the schedule draw a job) and the name, cut with an ellipsis; the second line is **the day in words**, from facts the app keeps: a bid's *bid due Thu Oct 8 · 6 days* (amber within a week, *today*, red *bid was due Wed Sep 30 · 2 days late*, then *bid sent Sep 30* once ours went), a GC project's stage with its day (*building · since Sep 14*), a Pipeline job's Stages word (*billed Oct 1 · pay app 3*). A tile is **blue** when the thread is filtered to its lines and carries the **gold star** when it is the default; since the two marks mean different things, the *Their jobs* hover card is a legend drawn with the thread's own tiles, a blue one and a starred one, saying what each is, what ⧉ and × do, and the drag hint (the owner, 2026-10-11; the chip redraws stay in `jobs-rail-mockups.html`). GC projects carry no number today: the real build reads `projects.project_number` into GC mode and has New project claim the next free one; a project with none reads **GC** in its badge. **When the thread's own column is 640px or narrower** (a container query on the card, so it folds at a phone and at a wide window with the list and the flow open alike), the header folds to five rows (`header-narrow-mockups.html`, the owner's pick C with one change, 2026-10-11): the label and company as a subtitle under the name; the who-has-it pill stays in the corner as its avatar and first name, *R Rosa*, with since-when on its hover card, beside one pill naming the state, *Open ▾*, that opens the three; the phone and the email as links on one line; the move line; the two stamps on one line with the difference mark between them; and Call in Quo, More ▾ and the jobs chips as one strip that scrolls sideways. Then the lines in time order with the job on each, the tiles to filter by job, the reply box (text, email, note for the team), the quick replies. Wherever the thread names a job it is **the badge then the name** (v1.36, the owner's go): the tag on each line (*B482 Boerne Retail Shell ×*, the trade left off as on the tile), the Tie to button and its picker (whose rows read the tile's day words and the tied count), the job's card and the A job page, the Follow up row's job, and the Add a job and Who is this? pickers. | yes |
| **Customers** | The same threads kept to customers, ordered by who is waiting; team notes yellow. A filter of Follow up and Messages, never a second queue. Since v1.108 the page has *Threads · By step · By company*, the last two the same boards Trade partners has. | yes |
| **Money → Bill day** | Since v1.122: *From the trades* (the section *Bill day on a job* below), with To the owner and Forecast as main's Money page has them. | yes |
| **Trade partners** | A page since v1.99: *By step* (one row per step with the people as chips, v1.108), *By company* (one row per company with the Once lane as a track), *By trade* (one row per trade, A to Z, each company a chip with the step it is on, its job and how long or how late; v1.172) and *Asks* (the Board's, unchanged). | yes |
| **A job's conversations** | On the job's page: *Papers on this job* as a grid since v1.176, with the counts in the title and the strip before the job's day, List behind a tab (each paper with its state, the step it finishes and where the person is, with the step card's own buttons, v1.100; each company under a gray title row, v1.175), then its own recent calls and texts, by contact, with answered or waiting. Reads the messages tied to that job. | yes |
| **Who is this?** | A number the app does not know: name it, say what they are to us, pick their company, tie it to a job. The answer becomes the rule for that number. | yes |
| **The flow** (the right panel) | Folded to a rail of marks by default; the rail's ‹ opens it. The person's journey with us as a small chart in lanes (Once, the papers signed once per company: the trade's W-9, insurance and MSA, the customer's master agreement; Per job, where a customer's ask, bid, yes and contract live since v1.157, and where change orders sit apart under Warranty with no arrow into them since v1.160, since they can happen at any point in the job): boxes green when done, orange on now with an *us* or *them* tag from whose move it is, a decision as a box with a colored left edge (v1.27), a loop as a dashed box with one pill per round (each ask, each pay application, each change order). Under it: what is on now, whose move, what finishes it, when the app nudges. Drawn from Settings → Flows (the owner picked B with C's tags, 2026-10-11). Its title is the flow's own name, *Customer flow*, *Trade partner flow* or *Architect flow* (v1.111). A step that turns on a paper carries a paper mark, and a press on a step opens its card: see *The flow suite* below. Built v1.96 to v1.103: the marks, the card, the states, the portal page, the by-step boards, the papers on the job page, the Follow up nudge rows, the usual, the phone sheet. | yes |
| **Settings → Flows** | One flow per kind of person as a table: step, finished when (a fact the app keeps, never typed), whose move, nudge after, repeats. Renaming a step changes every panel. The rest of the editor, order, whose move with the seat, the nudge with *⌕ see it* (what it looks like when it goes, v1.106), papers, the usual, and the facts picked from a list, is drawn in *The flow suite* below and built in v1.98 with the History and How it is going tabs and a *Who is where* card that becomes the who-moves preview while an edit waits. The same list drives Follow up's nudges since v1.101; the Board's ring later. | yes |
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
  *You have this*, *Rosa has this* or *Nobody has it · Take it*, with initials; since when is on its hover card, in words, *Since last Saturday, Sat Sep 26, 2:30 PM* (v1.90). Pressing it
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
- **A day was heard** / **just talk**: a day read from a call, voicemail or text is offered, never
  written on its own, and never as one general button (the owner, 2026-10-11: a general *Write it down*
  is confusing when the day could be a payment, a quote or a start). The offer names what the day is a
  promise of and where it goes, by who they are: a trade partner's quote (their ask on the Board, which
  Follow up and the ring read), a start or delivery (the schedule), their insurance or W-9 (the company's
  papers); a customer's payment (the Pipeline's payment promises, which the chase loop reads), their
  answer on our bid (the bid's follow-up), a day we can be on site (the schedule as a wait); an
  architect's answer (the plan question) or certificate (the pay application). The written line repeats
  exactly what and where. The first choice is the likely one for who they are; the others are one press.
  The offer is one line: the day, "is a promise of", and short choices with a short tag for where it
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
  inbox row, From, To, the subject made from the job and the first line, with a *change* that replaces it for this one email (v1.84; a subject is the email's own, unlike the To line and the greeting, which go on the record), the letterhead with the company number once, the greeting from
  what the contact goes by, a *change* on it setting the goes-by name on their record for every greeting after, with an
  event line (v1.81), the signature as the sender's name, title and own cell from their account (v1.78: the company
  number was in the letterhead, the signature and the reply line, three times; now once), a reply line, *Email back, text, or call* (the owner's words, v1.80), and the footer; the text as a green bubble under the texts already
  in their thread, from the company number, with the character count, how many texts it is, and, drawn as its own
  grey bubble labelled *added by the app*, the company name and the opt-out line the carriers require, on the first
  text we ever send a number and on the first after 30 days of silence from our side (v1.86); when the reason is only
  the silence, *Leave it off this time* holds it back on that one text and the message keeps a note that it was held,
  never on a first text. The To line is a press that adds or changes
  the contact's email or number on their record, for every message after as well, with a gray event line in the thread
  (v1.79); our From is never set per email, one mailbox and one number for everyone (the owner, 2026-10-05). The window warns
  when there is no email or number on file, and the To line is where to add one, when they sent STOP, or when a text runs past two pieces.
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
  own copy on arrival, as photos (draft 8); a link is a link. **Going out** (v1.91): **Attach** beside the box offers
  the job's own files first (the papers the app makes and the files on it), then a file from this computer, then a
  photo; the chips sit under the box with ×. The channel decides what it can carry: an email takes the file, and a
  file over the email limit (a plan set) goes as a link, the way a plan set always has; a text takes a photo as the
  picture and anything else as a link line under the message, to their portal when the thing has a page there (*The
  plans are in your portal: click.co/t/…*), else a signed link to the file. The sent message keeps each file with how
  it went, as the file or a link (a photo on a text goes as a link line, since Quo's API sends no picture messages; helper 3's read of the docs, 2026-10-12), and the preview shows the chips, the picture or the link lines before
  it goes. A file from this computer is kept in the job's Team only folder; a photo in the job's photos. Open: whether
  a highlight should also become a team note on the job.
- **Quick replies**: a gray panel above the box, folded to one line by default since v1.126 (a press opens it, the label folds it, kept per computer); a press on a line fills the box and nothing sends. Since v1.67 (`quick-replies-mockups.html` C, the owner's pick 2026-10-11) each line says who it is for, customers, trade partners, architects or anyone, and may belong to a flow step, and the strip shows only the lines for this kind of person in three groups, the step they are on first, then the rest of their kind, then anyone's, your most used first in each and then the team's; lines read whole on wrapping rows; the strip's head names the groups as pills with their counts, a press scrolls the box to that group and the pill for the group in view stays lit (the owner, 2026-10-11, v1.71); past ten lines on the team's list a box in the head narrows every group as you type, the typed words lit in each line (v1.72). Once the box has words, from typing or from a quick reply's press, the strip folds to one row, *Quick replies · 13 for trade partners ▸*, a press showing the lines again until the box is cleared, which shows them by itself (v1.77). The app counts each press. **Edit** on the strip opens the
  quick replies window (`quick-replies-editor-mockups.html`, v1.67): every line in one table, in groups by who it is
  for and then by the flow's steps in their order, the lines on no step last and the most used first in each (v1.73),
  each row the words, how often it is used with your own share, who added it and the last change, with tabs by who
  it is for and a search that lights the words; a row opens in place, the words and the two tags as fields, Save keeping the old words in a history of
  every version with its change struck and highlighted, who and when, and the use by person with the last use;
  Remove asks and keeps the line as removed, with a Removed tab to bring it back; Add a line guesses the tags from
  the words and says so until confirmed, and *just for me* keeps it off the team's list (the owner, 2026-10-11). The
  app's tables: the line (words, for, step, scope, removed), its versions (by, at, kind, from, to) and its presses
  (by, at, contact). The lines typed every day ("Your quote is in your portal", "Did the invite come
  through?", "Checking on the number, still good for today?").
- **Opt out**: a STOP from the contact flags the number; the app refuses to text it and says so. The opt-out line
  itself follows the rule in *Before it goes*: a first text, or the first after 30 quiet days, carries it as the
  app's own bubble; a person may hold it back once on the silence reason, and the hold is recorded on the message.
- **Search**: words in texts, emails, transcripts and summaries, across every contact.

## Whose move it is

In place of a bare "waiting 6 d", the header's third line says whose move it is and shows both last
words (the owner, 2026-10-11): an orange **Our move · 6 d** when the last word was theirs (it counts from
their last message), a green **Their move · 2 d** when the last word was ours (it counts from our last
message, or reads *Their move · until Wed Oct 7* while a promise runs), and beside it two stamps,
**Them** text · Sep 26 *(+6)* and **Us** email · Sep 19 *(+13)*: an older stamp is its date and a mark in parentheses for how many days ago, *(+6)*, a stamp from today keeps its time, *today · 11:30 AM*, and the block's hover card spells each out in full, *text · Sat, Sep 26 · 2:14 PM · 6 days ago*, then draws **a small calendar** of the last six weeks (or back to the first message), S M T W T F S with each week's dates at its right (*Sep 27 – Oct 3 · this week*), each day colored by who wrote, blue us, green them, split for both, a yellow dot for a team note, today outlined, a count on a day with more than one, so who wrote and when reads at a glance (the owner, 2026-10-11; the owner's pick 4 of five compact forms for the stamp; the folded one-line form uses the same compact date and leaves the mark off, since the mark between the stamps carries the difference) (the owner, 2026-10-11; the same on the Follow up row's snippet and the job card's list, while a line in the thread keeps the bare time under its day divider). On the folded header the two stamps are **one sentence in words, no color** (`stamps-words-mockups.html` B, the owner's pick 2026-10-11, after the pills whose green read as the move pill's): *Priya texted last Saturday; we emailed two weeks ago.* The newer side comes first, so the order says who wrote last; the channel is the verb (texted, emailed, called, left a voicemail); the when is *today at 11:30 AM*, *yesterday*, the weekday (*on Wednesday* this week, *last Saturday* the week before), *last week*, *two weeks ago*, *three weeks ago*, then the date. The person is named, never a guessed pronoun; a number nobody has named reads *they*. The sentence is the hover target for the same card as the block, which keeps the exact stamps and the calendar. A reply, an email or a call
from us moves the ball to their move; their next message moves it back. A note for the team moves
nothing, since they never saw it. The Follow up rows and the Messages list carry the same move word in
small, so the queue reads "Our move · 6 d" without opening the thread. Snoozed and the promise stay as
their own pills.

**We owe them.** Our last word does not always end our turn: "I will send the start date Monday" is a
message from us and a thing we still have to do (the owner, 2026-10-11). So the send window asks one
thing before Send, **After this sends:** with two presses on the same line, *Their move* and *Our move*, the chosen
one lit and a line under it saying what that means: with something owed, *This message gets the start date done*
or *We still owe the start date by Mon Oct 5*, our move the default; with nothing owed, *Nothing is on us* or *We
still owe [what?] by [when?]* with the two blanks, their move the default (v1.83, the owner: use our move and their
move here). The strip's *We owe them…* sets the same later. While it is open it stays our move whatever was said last,
the header reads *Our move · we owe the start date · by Mon Oct 5*, Follow up lists it under **We owe
them** with who marked it and when, and the thread gets a gray event line. *Mark it done* opens a note for the
team at the bottom of the thread, *Marking it done: we owed the start date · by Mon Oct 5*, and the note is what
marks it done: the person says how or why, the note goes in the thread with a *✓ done: the start date* chip,
the row closes as any note does, and the move goes back to whose word was last (the owner, 2026-10-11: it
always says why, for the team; and *done*, not *settled*, is the department's word, v1.66). *Not done yet* backs out. The owed pill on the move line is a press (the owner, 2026-10-11): it takes you to the reply box, where a strip above the box reads *We owe Priya the start date by Mon Oct 5*, with who marked it small after it, *Rosa, last Saturday*, the exact stamp on its hover card (the owner, 2026-10-11: the by-date is the point), and holds the ways to deal with it as buttons: **Mark it done, with a team note** (the note opens in its place), **Send Priya the start date** (the box, as a text; the send window's *After this sends: Their move · Our move* line, v1.83, is where the message that gets it done says so), **Put it off**, and × to put the strip away. The what and the day are **two blanks in the sentence** (`owed-blanks-mockups.html`, the owner's go 2026-10-11), each a press: the what opens a list by who they are, the flow's steps that are our move first (Settings → Flows, the *us* rows), then the lane's usual asks, then *something else* with a free box; the day opens a row of chips, tomorrow and the next five days by name with their dates, a week and two weeks out, one press each, and in the same row, filling what is left beside them, a box for anything else in words, *Oct 20*, *next Friday*, *in two weeks*, read back as a date as you type and set with Enter, kept as typed when it cannot be read (v1.64). *We owe them…* opens the same strip empty, one line, *what?* and *when?* with the list open and **Mark it** at the line's right, which writes it (v1.63: no hint line; the button's hover card holds the rule that the what comes first and the day is optional). A change writes a gray event line, so *Rosa, last Saturday* stays honest. The buttons follow the words: *Send Priya a pay application*. The lists' words are the owner's to confirm. Each button's hover card says what it changes. The choices live where the answer is written, not in a pop-up (the pop-up picker of v1.56–v1.59 and the list on Settled's card before it both read as a second place to decide). The Settled button is gone (the owner, 2026-10-11): the pill is the one control for what we owe, in the thread's header and on Follow up's *We owe them* rows alike, and settling is two presses, the pill then *Settle it*. The send window, while something is owed, carries a real tick, **This message settles the start date**: ticked, the message that goes clears what we owe, carries the ✓ settled chip and writes an event line; left alone, it stays our move (v1.57). The app's table needs an owed item per
contact: what, by when, who marked it, when, when it was done and the note that marked it done.

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

Whatever assigned it, the pill says who has it ("Rosa has this"; the rule is named in Settings, not on the pill), the thread gets the gray event
line, and anyone can take it or hand it on. An email that names a job in its subject or title block is
tied to that job as well as to the person (the file agent's reading, draft 9). Not proposed: round robin
or load balancing; the team is three people and the rule is enough. Open: what happens when the rule's
person is out (fall to the other seat, or to nobody).

## Decided 2026-10-11

- The contact owns the messages; jobs are associated with the contact; a message may be tied to
  one job. (The owner's words above.)
- It is built in the GC board first: the Follow up tab and the Messages tab on `/gc`.

## Open, from the flow panel (2026-10-11)

- Does a customer's flow start at the bid or at the first conversation? (Drawn as the first conversation, per job.
  The customer's Once lane holds only the master agreement, which one-job customers skip; v1.157.)
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
- **Opt-out and compliance**: STOP, which Quo answers itself and the app mirrors as the number's opt-out; HELP, INFO, REVOKE and OPT OUT, which the app answers; a stop asked in plain words becomes a team note to use Mark STOP, never an automatic stop; the opt-out flag; what the app refuses to send.
- **Missed-call text-back and after hours**: Quo's or ours, and what the thread records.
- **Correcting a tie** and whether the job's feed follows.
- **Search inside transcripts.**
- **Retention and legal hold**: how long recordings are kept, who deletes, how a matter freezes a thread.
- **One inbox**: the Customers tab is a filter, never a second queue with its own count.
- **Documents, for files going out** (the owner, 2026-10-11, after v1.91). Three things, in the order they bite:
  1. **One list of a job's files.** The Attach picker's first section is *the job's own files*, and today that answer
     is spread over places that do not know each other: the papers the app makes (the statement of work, a pay
     application, our contract, the schedule), the job's Drive folder in its Plans and Team only halves, the files a
     trade partner uploaded from its portal (`gc_trade_files`), the sent copies already in Documents, and the files
     that arrived on messages. Documents gives one read per job, *the job's files*, that walks all of them and tags
     each with where it lives and whether it has a portal page; the picker and the job's own page read it. No new tab
     and no second list: the thread, the picker and Documents read the same files.
  2. **A sent copy keeps its files.** The copy of an email as it went carries the files that went with it, and a text
     that went as a link keeps the link, each marked how it went (the file or a link; never a picture on a text), as the thread shows
     it; otherwise the copy is not the copy.
  3. **Two landing places, by rule.** A file picked from this computer goes to the job's Team only folder and a photo
     to the job's photos, the way incoming ones already do, so nothing sent lives only on the message.
  4. **The big files stay in Drive, and a handler hands out links to them** (the owner, 2026-10-11). Every job's
     Drive already has its Plans half, readable by anyone with the link, and its Team only half, and a plan set has
     always gone out as a Drive link; Documents keeps that and adds the handler, which does four things in order.
     (a) It decides by size and kind, never by hand: anything over the email limit, and any plan set however small,
     lives in the job's folder and goes out as a link; a small paper the app makes, a pay application or a statement
     of work, still goes as the file, since a PDF in the inbox is what a customer expects. (b) It hands out a link the
     app owns, not Drive's: the trade partner's portal page (`click.co/t/…#plans`) or a signed file link, which the app
     forwards to the Drive file, so the link opens the right half, Plans and never Team only; the app sees who opened
     it and when, as the portal already shows; and a link can be cut off without changing the folder's share for
     everyone. (c) It puts a file there on the way out: a file picked from this computer goes into the job's folder
     first, Team only by default, and the message links to it, so nothing goes out that Documents does not hold.
     (d) It keeps Drive the one copy: the *one list of a job's files* reads the Drive folder as a source, beside the
     papers the app makes and the portal uploads, and copies nothing into the database. Open: whether a customer's
     link opens their portal, as a trade partner's does, or the file itself (the open item on which record a contact
     is), and how long a signed file link lives (a week fits the way a plan set is read; a portal link lives as long as
     the portal does).

## The flow suite (proposed 2026-10-11, `flow-suite-mockups.html`)

The owner asked for the rest of the flow: how it is edited and how it reaches the papers. One rule under
all of it, from the surface table: **a step is finished by a fact the app already keeps, never by a typed
word.** A sweep of GC mode found a stamp for nearly every step the prototype draws, and a person-journey
kernel (`src/lib/journeys/personJourney.ts`) that already reads a state per step from stamps for five
journeys; the flow is that kernel's list made editable, not a sixth list. Five pieces, in the order a
person meets them:

1. **A paper mark on the step box.** A step that turns on a paper shows ○ not yet, ✓ on file, or a blue ↗
   when it went and is waiting on them; hover reads the paper's state in full. A step with no paper shows
   nothing. The box becomes a press (hover explains, press chooses) that opens the step's card; the rail's
   marks open the same card when the panel is folded. The On now line gains *Nudge now*.
2. **The step card.** *Finished when*: the step's facts, each read live with a mark, its date, where the
   copy lives, and one button that moves it (*Open* a paper on file; *Ask for it* fills the reply box with
   the step's quick reply and their portal link; *Send it* opens the send window, the review before a paper goes (v1.113): who it goes to, the sign-by day, the email or text as they see it, the paper as they see it, the standard agreement unchanged; their sign page carries the app's versioned e-sign consent verbatim (v1.114) and a typed signature, and *Remind them* reopens the window with the history in words. The same for the customer's contract and a change order. It is the paper send the company window already has,
   so the sent copy is filed and the thread shows it). *After this*: the next step, with its send, so the
   office can get one step ahead and never two. *Nudge*: the count and the channel, *Nudge now*, *Hold
   until*. *How they got here*: the history in words, one stamp per line with its person and day. A loop's
   card is one line per round, each with its own mark and move; a fork's card reads its two ways out.
   **By hand, without a typed word**: a paper handed to us is filed as a paper (a file or a photo, a date,
   who filed it), which is a fact, so the step finishes the same way; there is no mark-it-done that writes
   nothing.
3. **Settings → Flows, the editor.** The office (the owner and the assistants) changes a step's name, its
   place in the lane, whose move, the nudge (days and a channel, or *at their promised day*), whether it
   repeats and per what, the papers it turns on, and the facts that finish it, joined with *and*, or *or*
   on a fork; adds a step between two; removes one. It cannot change the facts, which are a list in code
   with the column each reads, or the lanes, which are the shape of the data. A fact picker lists the
   facts in groups (Papers, Their portal, Money, …) with the step each is in use on. Because the flow is a
   read over the stamps, every edit is tried on everyone before it is saved: a preview column says who
   moves and why (*Tom Riddle · Papers in → MSA signed*). History is the quick replies window's: every
   change with its person and day, a Removed tab, *Put it back*.
4. **The papers read the flow back.** While the reply box holds a step's quick reply, the Attach picker's
   first rows are that step's papers, starred, then the job's files. The company's Documents rows (and the
   job's tab for per-job papers) gain a *Finishes* column, the step each paper turns on and where the
   person is, with the step card's own buttons.
5. **The nudge becomes a Follow up row.** When a step is on now, the move is theirs and the thread has been
   quiet the step's count of days (a promised day beats the count), Follow up gets a row in its own section, *Nudges from the flow*, after *We owe them*: the step, what we are waiting on, the channel the flow asked for with a one-press switch.
   Answering or the fact turning true clears it. The Board's ring keeps its own stages until its lists and
   the flows agree (a later cut).

**What finishes each step today** (the sweep, 2026-10-11; migrations under `supabase/migrations/`):

| Step | The fact |
|---|---|
| Trade · Invited | `gc_invites.invited_on`; the email is a `gc_trade_messages` row of kind `invite` |
| Trade · Portal opened | half: `gc_companies.portal_opened_on` is their press on Got it, `gc_invites.status='opened'` per ask; no first-visit time on `gc_trade_portal_links` |
| Trade · Papers in | `person_contract_documents` keyed to the company: `w9` signed; `coi` with `expires_at` ahead (`gc_company_paper_states`, `src/lib/gc/companyPapers.ts`) |
| Trade · MSA signed | the same table, the `agreement` paper signed |
| Trade · Asked to quote | `gc_quotes.submitted_on`; `gc_invites.status='bid'` |
| Trade · Compared | `gc_trade_packages.carried_invite_id`, later `awarded_invite_id`; no lost mark on a quote (inferred) |
| Trade · Statement of work | `gc_sows.signed_on` |
| Trade · Draws | `gc_draws.approved_on`, `paid_on` |
| Trade · Closeout | the final draw's `waiver='unconditional'`, `waiver_on`; the upload `gc_trade_files.paper='unconditional_final'` |
| Customer · Master agreement (Once; repeat customers only, skipped for one job) | `person_contract_documents` keyed to the customer's company, the `agreement` paper signed |
| Customer · Asked us (Per job, as are the bid, the yes and the contract since v1.157) | `gc_projects.created_on` or the first `gc_plan_sets.issued_on` |
| Customer · Our bid | `gc_projects.our_bid_sent_on` |
| Customer · Said yes | half: a loss is `lost_on`; a win only moves `stage` and keeps no day |
| Customer · Contract signed | `gc_projects.owner_contract_signed_on`, `gc_owner_contract_sends.signed_on` |
| Customer · Start date | `gc_schedule_sends` (the letter), `gc_projects.start_date` |
| Customer · On site | `gc_projects.started_on` |
| Customer · Pay app | `gc_owner_pay_apps.sent_on`, `certified_on`, paid through its invoice |
| Customer · Closeout | `gc_projects.closed_on`; `gc_owner_acceptances.accepted_on` |
| Customer · Warranty | nothing; acceptance plus a year |
| Customer · Change orders | `gc_change_orders.status`, `answered_on` |
| Architect · Plans in | `gc_plan_sets.issued_on` |
| Architect · Questions | `gc_plan_questions.answered_on` (bidding), `gc_rfis.answered_on` (building) |
| Architect · Addenda | a `gc_plan_sets` row labelled Addendum N; sent by `gc_plan_set_sends.sent_at` |
| Architect · Submittals | `gc_submittal_rounds.answered_on` |
| Architect · Certify pay apps | `gc_owner_pay_apps.certified_on` |

Four facts to add in the real build, each a small column: a trade's first portal visit, a lost mark on a
quote we did not carry, the day a customer said yes, and the warranty year's end. Where the papers live
today: company papers in `person_contract_documents` and their sends in `gc_paper_sends` (msa, sow,
insurance, w9, waiver); portal uploads in `gc_trade_files`; every copy that went in `sent_documents`; the
job's Drive folder in Plans and Team only. The Get started checklist (`src/lib/gc/start.ts`), stage health
and the Board's ring (`ringStages.ts`) carry overlapping lists and are read, not replaced, until the flows
drive them.

**Storage**: one small table for what the office edits (a step's name, lane, order, whose move, nudge,
repeats, papers, the ids of its facts, and its history) and nothing for state, which is a read. Open for
the owner: whether a step can be skipped for a kind of company (a supplier with no MSA), in place of a
second flow.

### The flow suite, next cuts (2026-10-11, after the owner's "are there features we're missing?")

Five cuts, each a mock-up piece and a plan amendment, in the order they change the shape; the first three
land before the prototype builds pieces 1 to 3 above, since they change what a step box can be.

1. **The states of a step** (piece 6, a legend and two cards). A step is done, on now, next, and also
   **lapsed** (a done fact that stopped being true: insurance past `expires_at`, an MSA past its term, a
   quote withdrawn; the box goes amber, the person is back on it, the nudge restarts), **late** (a step with
   a day the app has, bid due, questions close, pay by, a promised day, read as *due Thu* or *late 2 days*,
   and the nudge fires off the day, not only off silence), **waiting on someone else's step** (Elena's pay
   app waits on Jonah's Certify; the card names the person and the step and links to their thread, and the
   nudge goes to the right person) and **off the flow** (a lost bid, a declined customer, a trade we stopped
   using: *off since, and why*, with a way back in; the facts are `lost_on`, `gc_mark_lost`,
   `bids.outcome`, and a new one for a trade). Drawn as piece 6 (v1.94): late is a day on an on-now step, not a
   state of its own; lapsed is orange with its reason beside the per-job step that is also on; waiting is a
   gray tag naming the person where *us* or *them* was, and the nudge goes to them; off the flow is the
   flow dimmed under a line that says since when and why, read from the bid's outcome, with *Put back on*;
   no new color and no new editor column. A person re-enters at the step the facts say. Decision for the owner: a person on two flows (a GC who also
   quotes as a sub), or two contacts.
2. **Everyone by step** (piece 7, v1.95; the shape since v1.108). One row per step in the flow's order, the lanes
   named, the count with late, lapsed and waiting in words under the step, and the people as chips that wrap,
   each the whole company, the job in the per-job lane and the day or how long, late first and tinted, off
   the flow a folded last row; a press opens the thread with the panel open on that step. It lives at the top of Trade partners and of Customers (the pick,
   B: a flow is per kind and so are those pages), never as a tab of Follow up (one queue, one count) nor a
   Flows tab of its own (a fourth place). Since v1.108 it is one row per step with chips that wrap, not columns,
   so a name reads once and nothing is cut (`by-step-mockups.html` A), and the *By company* tab is one row per company
   with the Once lane as a track (B). The Messages list gains a *by step ▾* chip beside All · Customers ·
   Trades.
3. **Their own view of it** (piece 8, v1.95). The trade's portal gets a first page, *Where you are with Click
   Construction*: the same list read from their side, their-move steps the only buttons (upload, sign, enter
   the quote) with why in a sentence, the our-move step we are on as *We are on it* with what to expect, the
   ones not reached yet as *Later* with when they come (v1.165), nothing of ours
   (no Compared, no nudges, no other companies), done steps keeping their day. An upload there finishes the
   step by itself, so the office asks less. Spanish by the portal's switch, the step names in both languages
   in the editor (`PORTAL_SPANISH.md`). The customer's and the architect's pages are drawn the same way (Accept the bid or Not this time; Certify the pay application, Review the submittal); whether a customer has a portal to put it on is the open item on which record a contact is. It builds third, after the card: it changes the most for
   the least.
4. **Time in step, and how it is going** (piece 9, v1.95). The card's first line gains what is usual, the
   median of the done ones over a year, with a bar that runs red past it (*no usual yet* under five done);
   the by-step column sorts by it. Settings → Flows gains a *How it is going* tab beside the editor: the
   per-job lane as a funnel (asked, quoted, carried, signed, with the fall-off and the ones that fell out),
   and one row per step (on it now, usual, longest now with its name, done this quarter, where it sticks,
   which is the fact last to turn true most often). The office's to read; nothing in it is money.
5. **The small things, folded into the pieces they belong to** (v1.95, each drawn in its piece): the seat that owns an our-move step (an
   editor column, so a nudge row lands on Rosa or Robert by the rule in *Who gets a new message*); a per-step
   choice between *ask me* and *the app sends the text* (the editor's nudge column; the automatic one is the
   owner's to turn on, since it sends mail); a gray event line in the thread when a fact turns true (*Tom's
   insurance came in · Papers in done*); a team note tied to a step, the way a message ties to a job; the
   per-job lane switching job, not only the default; *does not apply* on a step for one person, with a
   reason, beside the open *skip for a kind* question; and the phone layout for the panel and the card.

**The whole, weighed (v1.95).** Ten pieces read one list, and they stay one idea only while nothing but the
editor writes (the list), the facts are code, and the notes and *does not apply* are the person's; every
other piece is a view. The first build ships four states (done, on now, next, late) and draws lapsed,
waiting and off the flow as their facts land, with no color or column changing. A nudge row is a Follow up
row and never a second queue; the by-step board is not a queue and lives with the people. The editor's
*Ask for a fact that is missing* is the honest answer to the facts list being a gate. **The build order in
the prototype**, each a logged version: the marks and the press (1); the card with four states and the
notes (2, 6); the portal page (8); the editor with the picker, the seat, the how and the preview (3); the
by-step board at the top of Trade partners with the list's step filter (7); the Attach rows and the
Documents column (4); the Follow up row and the event lines (5); the usual and the report (9); the phone
sheet (10). Still the owner's: two flows per person or two contacts (leaning A); whether the app may send a
nudge itself, per step (off until then); whether the customer's portal gets the page.

### Bill day on a job: the trades' pay applications against the deadline (proposed 2026-10-11, the owner's ask)

The owner, looking at Elena's pay application card: while a job is being built, a person should see every
trade on the job and what each has sent in by the deadline, or in the days coming up to it, as one view.
The app already keeps the facts: our bill to the customer goes on **bill day, the 25th** (`billDay`,
`ownerBillingDay.ts`), built from the trades' draws (`gc_draws`: requested, approved, paid, sent back with
a note, `period_to`, the conditional waiver and `waiver_on`, `final`); a trade that has not sent its pay
application has a `payApp` promise on its row; and the owner's own application then goes to the architect
to certify and to the customer to pay (`gc_owner_pay_apps`). The Draws window on a project's card holds
the draws one trade at a time. What is missing is the view across the trades on one job, by the day.

**What goes on the page**, one job, one period:

1. **The deadline, up top**: our bill day, how many days to it, and the cut-off we ask the trades for (bill
   day less the days we need to check them, a setting). *Pay app 4 · period to Oct 25 · trades by Mon Oct 19
   · 6 days.*
2. **One row per trade on the job**, every trade with a signed statement of work, grouped by state and in
   this order: **sent back** (ours to re-check once it comes back; the note we sent), **not in** (late once
   the cut-off passes, with their promised day if they gave one, and quiet since), **in, waiting on us**
   (the amount asked, the lines we doubt), **approved** (the amount, perhaps less than asked), **nothing to
   bill this period** (no work this month, said by them or by us), and **done for the job** (final pay
   application in). A trade we do ourselves reads its percent from the Pipeline job and sits in its own
   line, since it sends nothing.
3. **On each row**: the company, the draw number, the amount asked and approved, the period it runs to,
   the conditional waiver (in, missing), the unconditional waiver still owed on the last draw, a back-charge
   waiting to come off, and whose move it is with how long. A press opens the trade's thread with the flow
   at Draws, or the draw itself in the Draws window.
4. **The total as it stands**: what the approved draws add up to against the owner's application we would
   send, and what is still missing from it, so the office knows whether bill day can go.
5. **The moves, from the row**: *Ask for it* (the step's line with the portal link), *Remind them* with the
   history, *Approve* and *Send back with a note* (the Draws window's own, reached from here), *Nothing this
   period* (recorded, never typed over a draw), and *Call in Quo*.
6. **The days coming up**: a strip of the next bill days with how many trades are in for each, so a person
   sees the month, not only today.

**The access points**, in the order a person meets them:

- **The customer's pay application card** (where the owner was): the card's round line, *Pay app 4 · with
  the architect*, gains a press, *the trades on this application*, which opens the page for that period.
- **The project's card on the Board**, beside Draws: *Bill day* with the count, *4 of 6 trades in · 2
  late*, red when the cut-off has passed with one missing.
- **Follow up**, as rows: a trade late on its pay application is a *Nudges from the flow* row already (the
  Draws step, at pay by); the page is the place those rows point at, and the section head links to it when
  more than one trade on a job is late, *3 trades late on Stone Oak Pharmacy · see them together*.
- **The job page**, *Papers on this job*: the pay applications are papers, so the table's rows for them link
  to the page.
- **Trade partners → By step**, the Draws row: a chip's hover names the period and the amount; a press on the
  row's head opens the page for the job the chips are on.
- **The trade's portal**: its own side of the same period, *Your pay application for October · send by Mon
  Oct 19*, with Enter a draw; nothing of the other trades.

**What it is not**: a second place to approve a draw (the Draws window stays the one place that writes a
draw), and not money the customer sees. **Open for the owner**: the cut-off, days before bill day, as a
setting or a fixed number; whether the page is one per job or one across every job being built, with the
job as a filter (the Board's bill day reads across jobs, so across jobs with a filter is the lean).
Drawn twice. `bill-day-mockup.html` (v1.117) is the first pass, a list of who is in. `bill-day-mockup-2.html`
(v1.118, the owner: not the best we can do) starts from the work instead, and is the shape to build:

- **It is half of a screen that exists.** The Money page's bill day already holds the owner's half (the
  application per job, the amber notes, the forecast that follows the schedule, the email two days before
  the 25th), so this is its *From the trades* tab beside *To the owner* and *Forecast*, never a tab of its own.
- **A cascade across the top**, since bill day is a chain: last period's payment, the trades' deadline, our
  checking days, bill day and who certifies, the owner's pay-by, the trades' pay day (net 30 from the owner's
  payment, per the MSA).
- **Gates under it**, *Can pay application 4 go?*: every trade in or said nothing this period; nothing sent
  back; every claim checked against the site; the conditional waivers in; last period's unconditional
  waivers in (nothing is paid to a trade until its is); no change order billed before it is signed; last
  period's certificate and payment in. Each gate names its blocker and carries one press to clear it. These
  are the Money page's amber notes as a list with buttons: one list, not two.
- **Expected on every row**, from the schedule's forecast, so still-to-come is a number and a trade asking
  for far more than the schedule expects stands out as a line to walk.
- **Changes beside waivers** on the row: a signed change order bills, an unsigned one is held out.
- **The lines opened** under a draw that waits on us: last, claimed, we see, what the schedule says, and this
  draw's money at what we see, with the photo and the stored-material invoice beside the line; Approve
  reads the corrected amount. The Draws window still writes the draw.
- **The superintendent's half**: the daily log, on the days between the cut-off and bill day, carries the
  claims to check as a phone list with the last draw and the schedule's number beside each, one tap per
  line that becomes *we see*, a photo to the log; percents and photos, never a dollar.
- **The one-press ask** to every trade not in, each its own text, and the app's own reminder three days
  before the cut-off, off until the owner turns *the app sends it* on for the Draws step.
- **A trade's habit** in the small words (*late once before*, *never late*), and **Closing out** as a group
  for the final application and the retainage release.
- **Access**: the six named above, with the page on Money's bill day and the daily log as the seventh; the
  money team reads amounts, as the Draws window is gated today.
- **Still the owner's**: the cut-off as a setting or fixed; whether the app may send the cut-off reminder;
  whether a superintendent's tap that matches the claim approves the line by itself (lean no).
  *How it reaches her* (v1.124): the daily log on her phone on the checking days, a text from the company number
  on the first of them, the office's *Ask Wendi to walk it* for today, her role showing percents and photos and
  never a dollar, and her taps read back by the gate.

**The superintendent's list, the criteria** (the owner's question, 2026-10-11). *Who*: the superintendent
assigned to the job and the project manager, never everyone with the role; percents, quantities and photos,
never a dollar. *When*: only in the checking window, the cut-off to two days before bill day; only draws that
are in, a sent-back draw re-entering when it comes back; as the daily log's list that week, with one text on
the first checking day. *What*: one line per claimed line in walking order by where it is on site, not by
trade; the last draw, the claim and the schedule's number beside each; stored material as yes or no on site;
a change order's line as work to confirm, marked unsigned. *A tap*: is *we see* with who and when, re-tappable
until the office approves, read-only after; below the claim it requires a photo or a note, which the send-back
note is written from; it never approves, and the office can override it with the override kept; every line
tapped clears the *checked against the site* gate by itself. *The site*: taps queue without signal; big
targets, one screen per draw. *Open*: a whole-draw *matches* press against a tap per line (lean per line).

## The customer's portal (shape B, picked 2026-10-11, `customer-portal-mockups.html`)

The page a customer opens from the link in our emails and texts, built in the prototype at v1.162 behind *See their
page* on a customer. On main the customer's portal already carries bills with pay by bank or card, the contract to
sign, change orders to sign or decline, Accept the work, a schedule in words and the papers; it lacks a thread, a
welcome, Spanish, photos, a weekly read, and the office never learns what was opened. Shape B puts the two together.

- **Home**: *Your move*, one orange card with the first thing we need from them in the flow's order (a decision, a
  paper of ours waiting on their signature, an open change order) and its button, or one line, *Nothing from you
  today. We are on …*; *Where you are*, the per-job lane from their side with a bar and three rows (the last done, the
  one on now, the next) that open to all; *This week*, one line from the daily log in customer words and three
  photos, every Friday; *Your people*, the office line, the project manager, the superintendent.
- **Money** (reshaped v1.163, `money-tab-mockups.html`, the owner's pick): the win first, *37% built · $445,000 of
  $1,302,450 invested · 3 of 3 paid on time* with a bar and *the sum is your contract plus the 2 changes you signed,
  nothing else* (month zero reads *Getting started* and teaches how paying works); then one card per pay
  application, the open one in orange with what it covers, its photos and where it stands, *After that* with the
  next application as a range from the schedule and its day, open change orders, then the paid ones newest first
  with the architect's certificate, the waivers, the day the trades were paid and a thank-you, older ones folded;
  *History*, folded, is the money timeline (contract, each payment with its thank-you, each change, the open one,
  the next); *The statement*, folded, is the six lines for the bookkeeper. *Paid on time* shows only when true; the
  page praises and never nags.
- **Schedule**: the milestones; *What moved* since the schedule went, one line per change with why.
- **Papers**: signed, each with its day and *read · a copy*; *Waiting on you* in orange with the buttons; *Comes
  later*, so the page never looks empty.
- **Messages**: the same thread this page holds, read from their side, texts and emails and portal writes in one
  list; a write box. A portal write lands in the thread as a *Portal* message, under Open, and on Follow up.
- **Español** at the top, every word of ours in both; the step names from the flow's own `es`.
- **What the office reads back**: a *portal* pill under the name in the thread header (opened when, read the
  contract, has not opened change order 2; gray *never opened*); the step card's So far, *Priya opened the change
  order Tue 9:14 AM. Not signed.* or *has not opened it yet*; Follow up's Needs you, a row for a customer who wrote
  on the page and a row for a paper sent two days ago and not signed, which says opened-and-left or never-opened
  since they are different nudges; Customers → By company, a *Portal* column with the last open in days.
- **Managing it from our side** (v1.164): the portal window shows the phone beside a side panel. *Show where each
  piece comes from* (Edit mode) tags every card with the page that feeds it, *the daily log · change ›*, *the
  application's customer line and photos · change ›*, *Settings → Flows · change ›*, and a press on the tag
  closes the window and opens that page; a computed piece (the header's sum, the history, the statement) says so
  and has nothing to type. *Ready for Priya?* is one row per piece with a green or orange dot: is there something
  to do, is this week's line fresh (older than seven days reads as stale), are photos marked, does every pay
  application say what it covers, is the next one sized, does every schedule move carry its why, are there two
  people to call, do the words read in both languages; each row ends in *fix ›* or *change ›* to the same page.
  It never checks our numbers; those come from the ledger. Where the words live: *Settings → Customer page*, every
  sentence of ours on the page in EN and ES and the switches per job (photos, the forecast, Spanish).
- **Kept out on purpose**: trade names, our costs, nudges, a live schedule chart, document markup, a chat with the
  superintendent, a log-in. The link is the key, as today.
- **Open**: whether Accept the work and the warranty year belong on Home as a last *Your move* or on Papers; whether
  the architect sees this page or a cousin of it; whether photos are opt-in per job, since some owners share the
  link with tenants.

## Contracts from clauses (drawn 2026-10-12, v1.178)

A contract is not a text. It is an ordered set of clauses, each with a scope, everyone or one trade, and its
own version. At send time the paper for this company on this job is the base clauses plus the trade's exhibit,
with the job's fields filled; the signed copy freezes the words and each clause's version, and the sign page
says which version and which exhibit it carries. The trade's exhibit lives on both papers: the standing rules on
the master agreement, the job's specifics on each statement of work, whose base reads as *The job* and whose
exhibits as *This trade*.

- **Settings → Contracts and clauses**: one card per contract paper (the master agreement, the statement of
  work, our contract, a change order, and any contract made in the flow editor) with its version and its
  clauses in two sections, everyone and the trade exhibits, each clause with its scope pill, its version and
  Edit; *+ a clause*; *preview per trade* assembles the paper for a chosen company.
- **Who may change a clause** (the owner, 2026-10-12): anyone in the office may edit one; the edit goes out
  once a controller or a dev approves it. An office edit becomes a proposal: the approvers get a push on their
  phones and an email with the change, and it sits on their Follow up under Needs you (*Rosa changed clause 2
  of the master agreement · waiting on your approval*, with Approve, Decline with a why, Open in Settings).
  Approved, it is the next version and the next paper sent carries it; declined, the editor gets a text with
  the why. A controller's or a dev's own edit publishes at once. A paper already signed keeps the words it was
  signed with. The roles are the app's own (`ROLE`: dev, controller, office, superintendent).
- **The flow editor's contract builder** gives each clause its scope and previews the sign page as a chosen
  company, with that trade's exhibit.
- **Built later**, after cut 4, as its own cut (`BUILD_PLAN.md` → *Cut 4c*); until then one master agreement
  document per trade in the Contract library's packets is the bridge.

## Residential customers and the Messages page (decided 2026-10-13, `customer-messages-prototype.html` v0.6)

The owner's ask of 2026-10-12: the same spine for the plumbing company's own customers, so a tech can text a
customer from the job with no misspelling and a customer's reply shows on every active job of theirs (a customer's
report that "communication from the office has been non existent"). Drawn in `customer-messages-prototype.html`
(seven screens, each a replica of the surface it changes) and `customer-messages-integrations-mockups.html`
(seventeen before-and-after cards). The owner's decisions, in order:

- **Orange is the customer's** in the job window (2026-10-12): a line the customer got, sent, pressed on their page
  or the app sent them is orange, deeper when it came from them; the team's notes lose the yellow there, since in
  that window they are the rule. The GC thread keeps its yellow notes. The reply box turns orange while what is
  written goes to the customer.
- **The quick replies are the GC strip and editor** (2026-10-12), with four additions for residential: blanks the app
  fills on the press (`{first}`, `{me}`, `{address}`, `{minutes}`, `{window}`, `{back day}`, `{link}`; one the app
  cannot fill stays lit and Send waits), a **phone** mark with an order and a short name, so Job Mode's lines are
  rows of the same editor, Spanish beside English, and steps per flow rather than per kind.
- **Two boxes, one inbox** (2026-10-12): bids@ for trade partners and the estimators' quotes, **team@clickplumbing.com**
  for customers. The person decides the area; the box decides the first guess for an unknown sender and the address a
  reply goes from. Open: team@ or office@, since office@ is already on the letterhead and the lien reply-to.
- **Messages in the header** for the office (2026-10-12), with a **New** lane on Follow up holding the three sorts,
  *Who is this?*, *Which job?* and *Who has it?* (mockup A of three; C, the sort desk, is the press behind Sort all).
- **The seventeen integrations** (2026-10-13): sixteen **Add**, history **No**. Against the lean: **candidates** (11)
  and **residential subs** (12) come in as kinds of contact. So Messages has seven kinds, customer · trade partner ·
  architect · lead · supply house · candidate · sub; lead, supply house, candidate and sub have no flow yet, supply
  house and candidate never count on Follow up, and the sub's flow (asked · said yes · on site · done · paid) is
  read from the sub sheet once its facts are stamps, the largest of the sixteen. The leans that moved while drawing
  stand: push waits fifteen minutes before the office hears, a setting; a Running late press asks once before it
  moves the dispatch board and tells the dispatcher.

- **Job activity in a person's thread** (2026-10-13): the thread shows the clock, the reports, the status changes and
  the bills from the jobs the person's lines are tied to, in time order with the lines, behind a **Job activity**
  switch on the thread's header kept per computer; a job of theirs with no line on it stays out. Both panels draw
  from one list of rows, the activity panel's registry with five kinds added (prototype screen 8). Open: the default
  (lean: on for the office, off on the tech's phone).

Decisions still the owner's, on the prototype's screen 5: the tech's door (lean: jobs dispatched to or clocked on,
this week and last, no money lines), free text for techs (lean: quick replies and *Something else* to the office),
who edits the phone's lines (lean: the office), who answers a reply (lean: the tech until 5 PM, then the office),
which reminders start on (lean: estimate and bill), and team@ against office@.

## How it would be built, once the shape is settled

The detailed plan is `BUILD_PLAN.md` (2026-10-11); the list below is the first sketch it grew from.

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
   With it, **files going out**: Documents' one list of a job's files for the Attach picker, sent copies that keep
   their files, the two landing places, and the Drive handler that hands out the app's own links to the big files
   (the open item *Documents, for files going out*).
8. Later: Job activity on the Pipeline, photos, the file agent.

The prototype's demo-only presses, never to be built: *They text back*, *their upload arrives*, *sign (demo)*, and the ten companies with no thread that stand on the boards so a page reads like a Tuesday.

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
- **v1.19, 2026-10-11**: whose move it is: the header's third line reads Our move or Their move
  with the count, and the two stamps Them and Us with the channel and time of each last word; the
  Follow up rows and the list carry the move word. An older email from Rosa to Priya seeds the Us stamp.
- **v1.20, 2026-10-11**: *We owe them*: the send window asks whether anything is still on us; the
  toolbar's *We owe them…* and *Settled*; the header reads *Our move · we owe …*; Follow up lists them
  under *We owe them*; events in the thread. Priya seeds one: the start date by Mon Oct 5.
- **v1.21, 2026-10-11**: the send window's question is one big tick row right above the Send button,
  the whole row a target (the owner: make it easy to click smoothly); the what-and-when boxes appear
  only once it is ticked, with the cursor in the first.
- **v1.22, 2026-10-11**: the tick row sits at the right, directly above Send as email or Send as text,
  with the box on its right edge in line with the button.
- **v1.23, 2026-10-11**: list fixes from the owner's screenshot: the right column is capped so a long
  move word never squashes the name; the list's move pill is the short form ("Our · we owe", the
  full words on hover); an email's snippet is its subject; a missed call's reads "no voicemail".
- **v1.24, 2026-10-11**: the people list collapses to a rail of faces (‹ beside the search), each
  with its move dot and a hover card; › opens it again; the choice is kept in the browser.
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
  the move line and the stamps start at the left edge (the owner: no need to push them over).
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
  green read as the move pill's). The wide block keeps its dates and (+6).
- **v1.52, 2026-10-11**: Settled's hover card lists the other options, each with its control drawn: send it to them
  (the send window's question settles it), We owe them… to change it, Snoozed, or leave it (the owner's ask). Open:
  the send window today keeps what we owe ticked and fixed while something is owed; it should offer 'this message
  settles it' so the first option is true.
- **v1.53, 2026-10-11**: the card is one list of every option, Settled among them, with the hovered one highlighted
  and marked *this one* (the owner's ask).
- **v1.54, 2026-10-11**: the owed card's words rewritten to `plainWords.ts`: one idea a sentence, none over 20
  words, no semicolons or colons, each row what it is then what you press then what happens (the owner: is that the
  best we can do? It was not; three rows were glued and two sentences ran long).
- **v1.55, 2026-10-11**: the owed card smoothed: each row is the control in one column, one plain line of what it does
  and a quiet line of what changes, the lit row soft with a small *this one* (the owner: simple language, a smoother
  presentation).
- **v1.56, 2026-10-11**: the owed pill is a press that opens the five ways as real presses, in the who-has-it picker's
  shape; Settled's hover card is three lines again (the owner's pick B: hover explains one control, a press offers the
  choices; the list on a hover card had read as a second place to decide).
- **v1.57, 2026-10-11**: the v1.55 card is back on Settled's hover, every way shown and Settled lit, beside the pill's
  press; and the send window's owed row is a real tick, *This message settles the start date*: ticked, the sent
  message clears what we owe, carries the ✓ settled chip and writes an event line (the owner's asks).
- **v1.58, 2026-10-11**: the Settled button is gone from the header and from Follow up's We owe them rows; the owed
  pill, with its press, is the one control for what we owe in both places, and the options card went with the button
  (the owner: remove it).
- **v1.59, 2026-10-11**: the owed picker's head carries who marked it and when and that it stays on Follow up until
  settled; the Leave it row is gone, since closing the menu is leaving it.
- **v1.60, 2026-10-11**: pressing the owed pill, in the header or on a Follow up row, goes to the reply box, where
  a strip above the box holds the four ways as buttons with their hover cards; the pop-up picker is gone (the
  owner: choose the options from the bottom).
- **v1.61, 2026-10-11**: the strip's head keeps the by-date in the text's weight and says who marked it small, *Rosa,
  last Saturday*, with the exact stamp on hover; Follow up's row says it the same way (the owner's ask).
- **v1.62, 2026-10-11**: what we owe as two blanks anyone fills (`owed-blanks-mockups.html`): the what from a list,
  the flow's our-move steps then the lane's usual asks then your own words; the day in words read back as a date; We
  owe them… opens the same strip empty with Mark it; a change writes an event line; the Change button and the old
  dialog are gone.
- **v1.63, 2026-10-11**: the empty strip is one line, Mark it at the right of the sentence and the hint gone (the
  owner: condense it).
- **v1.64, 2026-10-11**: the day box is chips first, the next days by name with their dates, a week and two weeks
  out, one press each; the typed box stays under them with its read-back and Enter (the owner: is that the best
  we can do?).
- **v1.65, 2026-10-11**: the typed-day box sits in the chips' row, filling the space beside the last chips, not on a
  row of its own (the owner's screenshot).
- **v1.180, 2026-10-12**: two more from the lift: a decision of ours never offers the customer's yes and no on their
  page's Your move; a trade's page lists a job only once we have asked them on it, so a bid they are not asked on
  never shows our pipeline (helper 8).
- **v1.179, 2026-10-12**: two bugs the helpers found while lifting: a decision step that is our move drew the
  customer's Accept and Not this time on the trade's page (Bill on Compared), now only when it is their move; a
  portal write set a state no contact has, so Needs you never showed it, now waiting (helpers 8 and 2).
- **v1.178b, 2026-10-12**: `BUILD_HELPERS.md`, the brief for the real build on main: the spec and the plan by
  `git show`, the rules from CLAUDE.md, wave 1 as nine kernel clusters with the prototype's functions to lift,
  how to prepare, go, block and finish, wave 2 named, the decisions already taken (the owner: "prepare to build
  it using all the helpers").
- **v1.178, 2026-10-12**: contracts from clauses: a clause has a scope and a version, the sign page assembles
  the base plus the trade's exhibit and names its version; Settings → Contracts and clauses holds the library
  with Edit, *+ a clause* and *preview per trade*; an office edit waits on a controller or a dev with a push,
  an email and a Needs you row, Approve or Decline with a why; the flow editor's builder gives each clause its
  scope and previews as a chosen company; Maria joins the team as the controller (the owner, 2026-10-12).
  *Contracts from clauses* above holds the shape.
- **v1.177b, 2026-10-12**: `BUILD_PLAN.md` brought up to v1.177: every cut gains what landed since v1.141, the
  kernels list grows by six, the decisions list marks the portal taken and adds the change order's seat and the
  over-usual rule, and a new section 9 gives the build order with rough sizes and what the office gets at the end
  of each cut (the owner: "I am just about ready to build it").
- **v1.177, 2026-10-12**: *Add a new paper* asks the kind first, one word for three things: something they give
  us (a name in both languages, a date it runs out), something we write and they sign (a contract: between whom,
  who signs and the order, the fields it draws from the job, the clauses in both languages seeded from the master
  agreement, the consent fixed, Preview the sign page, Save as draft or Publish v1), something we send to inform (a
  notice: subject, the words in both languages, what rides with it). A contract has a version and never a date; an
  upload has a date and never clauses (the owner, 2026-10-12: "I don't know where the papers end and contracts
  begin").
- **v1.176, 2026-10-12**: *Papers on this job* opens as a grid (`job-papers-mockups.html` B): a row per company,
  a column per paper in the flow's order, a dot per cell (done with its day, waiting, none yet, late or runs out
  soon in orange, lapsed in red, not yet on this job dashed), companies with something wrong first; the counts in
  the title as pills that filter; a *Before bid day* strip on a bid (the insurance that ran out, the late quotes,
  the compare over usual, the quotes due) and *Before bill day* on a billing job (the open gates), each line with
  its press; List keeps v1.175's rows. The flow editor's paper picker ends in *+ Add a new paper*: a window for its
  name in both languages, who provides it, whether it runs out; saving makes it a Documents row, a portal line,
  a fact the step reads and a grid column (the owner picked B and asked for the add, 2026-10-12).
- **v1.175, 2026-10-12**: *Papers on this job, by company* sets each company's title row on a light gray band
  across the card, so a company's papers start where the gray does; the rows' lines run edge to edge with it
  (the owner: do a better job identifying the titles).
- **v1.174, 2026-10-12**: By step's summary line becomes tiles (`by-step-summary-mockups.html` C): one per phase
  with the count big and a dot per company, gray fine, orange over usual or lapsed, red late; an Off the flow tile;
  a *Needs a hand today* tile counting the late and the lapsed with the pills, over usual as a watch. A tile jumps
  to the rows, a dot to that company's thread at the step, the hand tile to Follow up (the owner picked C,
  2026-10-12).
- **v1.173, 2026-10-12**: By step rebuilt on the six pieces of `by-step-review-mockup.html`: a summary line that
  adds up (getting set up, quoting on N bids, building, off, then late, lapsed, over usual, waiting, with a link to
  Follow up); empty steps fold to one line per run with the sentence that says what lands there; per-job chips group
  by job, the job named once with the day they share; days read against the step's usual, over usual in orange and
  counted; a press per row, the step's own nudge (Ask the 4 for papers, Remind the 1 late, Open the compare, Bill
  day); the job and the seat as pickers. Customers → By step takes the same (the owner, 2026-10-12).
- **v1.172, 2026-10-12**: Trade partners gains *By trade*: one row per trade, A to Z, the companies as chips with the
  step each is on, its job and how long or how late, late first and off the flow last; a company with no trade
  on its record sits under *No trade yet* (the owner, 2026-10-12).
- **v1.171, 2026-10-12**: every trade row on Money → Bill day carries *See their page* under the name, with the
  globe, opening that trade's portal window (the owner, 2026-10-12).
- **v1.170, 2026-10-12**: the draws bar's legend as four columns in the bar's order, the swatch and the count on
  top and the state with its detail under (`bill-day-legend-mockups.html` A; B's stress set in
  `bill-day-legend-b-stress.html` stays as the record of why not B: a thin segment has no room for its words). A
  press on a column jumps to its section (the owner, 2026-10-12).
- **v1.169, 2026-10-12**: Money → Bill day opens with a summary (`bill-day-summary-mockups.html`, the pick): the
  money river, one bar of the draws by state in dollars flowing into the owner's number with its parts, and the
  dates under it with today marked; beside it the 3 of 7 ring and *Today*, the first three open gates with their
  own presses. The six calendar cards fold behind *the dates in full* and the gate list behind *the gates*; the
  section pills and the tables stay (the owner, 2026-10-12: "a little overwhelmed").
- **v1.168, 2026-10-12**: a press on a round pill in a loop box opens the round's window: a change order with its
  facts, whether the customer opened it, the paper and Ask again; a pay application with what it covers, the
  certificate, the waivers and the trades on it; any other round with its words and its ask (the owner, 2026-10-12).
- **v1.167, 2026-10-12**: *See their page* on its own line under the flow panel and on the step card, with a small
  globe before it, the way a portal link reads (the owner, 2026-10-12).
- **v1.166, 2026-10-12**: the thread header in four calm rows: the name with *Customer: Helotes Dental Office ▾*
  (the chevron hides and shows the contact line, open by default), the phone and the email, then one status row
  that leads with the move strip and follows with the back pill and a short portal pill at the same size (*portal ·
  3 d ago · 1 unopened*, the facts on hover), then the stamps sentence; the jobs rail last (the owner, 2026-10-12:
  "this section feels a little chaotic").
- **v1.165, 2026-10-12**: the customer's list drops *With us*: the step we are on reads *We are on it* with what
  to expect (*You will have the start date by Mon Oct 5*), a step not reached yet reads *Later* with when it comes
  (*After your start date*, *Once a month, from the first month on site*), each step's when-line in both languages
  in the flow (the owner asked whether *with us* was the best use of words, 2026-10-12).
- **v1.164, 2026-10-12**: the portal window gains a side panel for the office: Edit mode tags every card with where
  it comes from and takes you there, and *Ready for Priya?* lists what is missing or stale with a fix link per
  row (the owner asked how we manage what goes in, 2026-10-12).
- **v1.163, 2026-10-11**: the Money tab reshaped to the pick, C's header over B's cards with D folded as
  History at the foot and the statement folded under it (the owner, 2026-10-11).
- **v1.162, 2026-10-11**: the customer's portal as shape B behind See their page: Home with Your move, Where you
  are, This week and Your people, then Money, Schedule, Papers and Messages, in both languages; a portal write lands
  in the thread as a Portal message; the office reads it back on the thread header's portal pill, the step card's So
  far, Follow up's Needs you and By company's Portal column (the owner picked B, 2026-10-11). *The customer's
  portal* above holds the shape.
- **v1.161, 2026-10-11**: the portal window is titled by kind, *Customer's portal*, *Trade partner's portal*,
  *Architect's portal*, not by the person's name; a section with no rows (a skipped master agreement) draws no
  heading (the owner, 2026-10-11).
- **v1.160, 2026-10-11**: change orders leave the Any time lane for Per job, drawn apart under Warranty behind a
  dashed line that reads *any time in the job*, with no arrow into them; the card never names them as what comes
  next (the owner, 2026-10-11).
- **v1.159, 2026-10-11**: the message window's first button is one slot: *Remove the highlight* while a highlight
  stands and nothing is selected, *Highlight the selected words* the moment words are selected; a highlight snaps to
  whole words (the owner, 2026-10-11).
- **v1.158, 2026-10-11**: within one day, a message tied to the same job as the one above it shows the job's number
  alone; the name shows once per day and per change of job, and hover gives it back (the owner, 2026-10-11).
- **v1.157, 2026-10-11**: the customer's Once lane holds only the master agreement, which a one-job customer skips;
  the ask, the bid, the yes and the contract are per job, since each reads a column of the project (the owner,
  2026-10-11: "our bid is on a per-job basis").
- **v1.156, 2026-10-11**: the time shares the last line of a message when there is room and drops under it only when
  the words reach it, the way a phone's bubbles do; a card that ends in a file, a transcript or an offer keeps a line
  for it (the owner, 2026-10-11).
- **v1.155, 2026-10-11**: a step box's day and tags never break mid-word, so a done box is one line tall; the day had
  been wrapping to two lines beside the name (the owner, 2026-10-11: unnecessarily tall).
- **v1.154, 2026-10-11**: *Note* for *Note for the team*, on the kind button and the card; the yellow and the helper
  say the rest (the owner, 2026-10-11).
- **v1.153, 2026-10-11**: a note's top line says who wrote it and no more; *Note for the team* was there twice (the
  owner, 2026-10-11).
- **v1.152, 2026-10-11**: every message's time floats at the card's bottom right in light gray, *Sat, Sep 26 · 2:14 PM*,
  off the top line, which keeps the channel, who, and the job (the owner, 2026-10-11).
- **v1.151, 2026-10-11**: a done step's box carries its day at the right, *Aug 28*, in place of the paper mark, so the
  panel reads the history without opening a card (the owner, 2026-10-11).
- **v1.150, 2026-10-11**: the whole header pins with the name row and only the conversation scrolls; the facts, the
  move line and the jobs had scrolled away with it, which left a sliver of them showing mid-scroll (the owner,
  2026-10-11). The header is short enough to pin since the toolbar row and the state segment went.
- **v1.149, 2026-10-11**: the line under the box reads by kind: a text its characters and how many texts (and a word
  when it runs past two); an email the subject it will go with, from the first line and the job, and the word count;
  a note its words (the owner, 2026-10-11: texts counted on an email).
- **v1.148, 2026-10-11**: every file in the Attach picker has *preview*: the paper as it reads (our contract, a statement
  of work, the agreement drawn from their own words; a plan set or a schedule as its first page), the page count and
  size, Open in a tab, and Attach it from there (the owner, 2026-10-11).
- **v1.147, 2026-10-11**: the people list sorts by the newest conversation only; it had put the waiting threads first,
  so a snooze or a reply made a row jump with nothing saying why (the owner, 2026-10-11). The move pill says whose
  move it is; Follow up is the queue.
- **v1.146, 2026-10-11**: Open · Snoozed · Done leaves the thread header (the owner: no reason to press it). The app sets
  the state by itself, the move line already says it, and Follow up's row has the two presses; the thread keeps them
  behind ⋯ as *No reply needed*, *Remind me Monday* and *Reopen*. The who-has-it pill stays.
- **v1.145, 2026-10-11**: when narrow finds no line, on the strip or in Find a reply, a button adds the typed words as
  a quick reply: the editor opens on its add form with the words in it and its guess at who it is for and the step
  (the owner, 2026-10-11).
- **v1.144, 2026-10-11**: the strip's narrow box takes the room the pills left (the owner, 2026-10-11).
- **v1.143, 2026-10-11**: the group pills on the strip's head are gone, since the rows carry their titles; the head
  reads the count, *13 for trade partners* (the owner, 2026-10-11).
- **v1.142, 2026-10-11**: the quick replies strip draws each group as one row: the title with a colon at the left, the
  lines after it in a row that scrolls sideways past the title (the owner, 2026-10-11).
- **v1.141b, 2026-10-11**: `BUILD_PLAN.md`, the build plan for everything in the prototype (the owner: the edits are
  becoming cosmetic, the basis is right): what is reused from main, the tables, ten cuts in order with their kernels,
  SQL, edge functions and screens, the decisions still the owner's, what is left out, and what done means.
- **v1.141, 2026-10-11**: *⤢ Find* beside Edit on the quick replies strip opens Find a reply: their last message at the
  top in full, where they are in the flow in one sentence with a link to the step's card, a narrow box, and every
  line with room to read, the lines for the step they are on first and marked; a press fills the box and closes it
  (the owner, 2026-10-11: the strip is too tight to find the right line).
- **v1.140, 2026-10-11**: the *from the company number* line floats inside the box at its bottom right while the box
  is empty and goes as soon as a person types; the line under the box is gone (the owner, 2026-10-11).
- **v1.139, 2026-10-11**: the message window has one button for it, *Remove the highlight*, beside *Highlight the
  selected words*; with more than one highlight it takes the one the cursor is in, or all of them (the owner,
  2026-10-11: one button).
- **v1.138, 2026-10-11**: the thread's toolbar row is gone; a pair after the name on the name row holds ☎ (the call,
  grayed with no number on file) and ⋯ (the rarer things, with the demo's They text back inside), so the header loses
  a row (the owner's [☎ | ⋯], 2026-10-11). A highlight comes off with a press on the highlighted words themselves, in
  the thread or the window, and the window's list says Remove instead of × (the owner: no easy way to unhighlight).
- **v1.137, 2026-10-11**: the rail's lane names, Once, Per job, Any time, each on one line (the owner, 2026-10-11).
- **v1.136, 2026-10-11**: the people list's row is three full-width lines instead of two columns: the name with the
  time at its right, the company and trade with the move pill at their right, and the last message across the whole
  width; the old right column had squeezed the name and cut the last line short with room to spare (the owner,
  2026-10-11).
- **v1.135, 2026-10-11**: the reply box's last row is flipped: Tie to on the left, Attach and Send on the right (the
  owner, 2026-10-11).
- **v1.134, 2026-10-11**: the line under the box, *Send shows it to you the way they will see it, before it goes*, is
  gone from the page and lives on the Send button's hover card; the *from the company number* line moved down into
  its place, right-aligned, so nothing sits between the kinds and the box (the owner's marks, 2026-10-11).
- **v1.133, 2026-10-11**: a text bubble is filled the Text button's pale blue, with its blue edge, so the two read as one
  thing the way the yellow note and its button do; our own texts a shade deeper (the owner, 2026-10-11).
- **v1.132, 2026-10-11**: an email is white, plain like a letter, with no edge (the owner: not purple).
- **v1.131, 2026-10-11**: one color per channel (the owner, 2026-10-11): a text is blue, an email violet, a note yellow,
  on the kind buttons, the box and the thread's bubbles (a colored left edge and the channel word; our texts and
  emails on a tint of it); calls stay plain. The picked kind wears a thick orange ring, the one place orange means
  *picked*.
- **v1.130, 2026-10-11**: *Quick replies ▸* is a press at the right of the kinds row on a text or an email, the
  only way in and out of the strip; the folded strip's own line is gone, and the helper line sits under the kinds
  (the owner, 2026-10-11: just the word, up there).
- **v1.129, 2026-10-11**: the note box's rows tightened (the owner's marks): the helper reads *only the team sees it · closes
  the row* so it stays on the kinds row, and *Bring it back on a day…* sits on the send row beside Add the note; the
  day strip opens above the box as before.
- **v1.128, 2026-10-11**: a team note can carry a follow-up day (the owner, 2026-10-11). Under the note box, *↩ Bring it
  back on a day…* opens the owed strip's day chips and a typed day; with a day on it the note still closes the row,
  and that morning the row comes back to Follow up under a new first section, *Needs you*, with the note on it and
  Open the thread, Done with it, Another day. The note shows *↩ back Fri Oct 2* in the thread, the header carries the
  same pill with × to clear it, and the note stays either way. Rosa's note on Priya carries today in the demo.
- **v1.127, 2026-10-11**: Follow up's rows keep their who-has-it pill inside the card; the right column had the list's
  132 px cap, which cut *Nobody has it · Take it* off the edge, and the name line wraps its move pill under the name
  when the row is narrow (the owner, 2026-10-11).
- **v1.126, 2026-10-11**: the quick replies strip is folded by default to its one line, *Quick replies · 13 for trade
  partners ▸*; a press on the line opens it and a press on the open *Quick replies* label folds it, kept on this
  computer (the owner, 2026-10-11). Typing still folds an open strip until the box is empty.
- **v1.125, 2026-10-11**: the step card in plain words (the owner: not easy to follow; everything in simple English a
  person reads at a glance). The title is the step; under it one sentence says where it stands (*Greg's insurance
  certificate ran out Sep 30. We need a new one.* / *Greg's move. On it 4 days, usually 3.* / *Waiting on Jonah, 4
  days.* / *Done Sep 12.*). Then only the sections that apply, each a short heading: *What we need* (or *What we
  have*), one line per paper as its name, its state and date, and one button; *Until then*, what the lapse or the
  wait holds up in two sentences; *Next*, only when the next step is not done; *Reminder*, one sentence (*A call after
  5 quiet days. Greg wrote today, so not yet.*) with Remind now, Hold until Mon and see it; *So far*, the history as
  short lines and the notes. Gone: *Finished when*, the lane and move in the subtitle, *Both facts are the app's own*,
  *Nudge* as a word, *Whose move* as a paragraph, *How Greg got here*. *Skip for Greg* for *Does not apply to Greg*.
- **v1.124, 2026-10-11**: the superintendent's side. *Signed in as* on the header switches between Robert, the office,
  and Wendi, the superintendent on Stone Oak Pharmacy, whose nav is Daily log · Messages · A job. The daily log carries
  crews on site (counts), photos, and on a bill-day week *Claims to check*, the same list the office previews as her
  phone, drawn into the log from one source: walking order, a tap per line with who, a photo or a note under the claim,
  and "every claim is checked" when it is. The cascade's We check card says the app texts her on the first checking
  day, with *ask her today* (the text as she sees it, Send it now) and *see her side*; the *checked against the site*
  gate gains *Ask Wendi to walk it*. Her job page says where the claims are and shows no amounts.
- **v1.123, 2026-10-11**: the superintendent's list is in walking order by where a line is on site (Site, Yard, Level 1,
  Level 2, Roof), under a heading per place, not by trade; a tap under the claim opens a photo or a note on the spot and
  the line stays marked until one is kept; the send-back note is written from the walk's notes, the opened lines read
  them, and the *checked against the site* gate clears only when every line is tapped and every one under the claim
  has its photo or note.
- **v1.122b, 2026-10-11**: the plan's Bill day section gains the criteria for the superintendent's list: who, when, what
  is on it, what a tap does and does not do, and what the site needs. No prototype change.
- **v1.122, 2026-10-11**: Bill day in the prototype, as `bill-day-mockup-2.html`: a Money page with From the trades (To the
  owner and Forecast named as main's), the job filter, the section strip, the cascade, the seven gates read from the
  draws with a press each, the groups as bars with one column layout, Expected per row, waivers and changes, the
  lines opened under a draw waiting on us with claimed, we see, the schedule and this draw's money, Approve at what
  we see, Send back with a note, Nothing this period recorded with who said it, Ask for it and Ask all in one press
  (each its own text in the thread), Remind them on a sent-back draw, Our own crew, the total line with Send faint
  until bill day; Wendi's phone list on the cascade's checking days, one tap per line that becomes we see. The
  access points: the pay application round line on a customer's card, Follow up's section head when more than one
  trade on a job is not in, the job page's Bill day line, the Draws row on Trade partners by step, and the trade's
  portal naming the period and the day. Tejas Power is on Stone Oak Pharmacy too.
- **v1.121, 2026-10-11**: a strip of the bill-day page's sections under its tabs, each a pill with its count and tint
  joined with arrows in the order a draw moves, Sent back → Not in → In, waiting on us → Approved → Closing out, then
  Our own crew; a press jumps to the section's bar (the owner, 2026-10-11).
- **v1.120, 2026-10-11**: every group on the bill-day page shares one column layout, so a trade's name reads whole in
  each group instead of each table sizing its own columns (the owner, 2026-10-11: Tejas Power wrapped word by word).
- **v1.119, 2026-10-11**: the bill-day page's section titles (Sent back, Not in, In waiting on us, Approved, Closing
  out, Our own crew) are bars across the page, bold at the body's size with the count and the note small after them,
  tinted red for Not in and amber for Sent back, instead of small gray caps that read smaller than the rows (the
  owner, 2026-10-11).
- **v1.118, 2026-10-11**: `bill-day-mockup-2.html`, Bill day's second pass (the owner: not the best we can do): the page
  as the Money screen's From the trades tab, the cascade, the seven gates with a press each, Expected from the
  schedule's forecast, changes beside waivers, the lines opened with claimed, we see and the schedule, the
  superintendent's phone list on the daily log, the one-press ask and the app's reminder, Closing out; the plan's
  section rewritten to this shape. No prototype change.
- **v1.117, 2026-10-11**: `bill-day-mockup.html`, Bill day drawn: across jobs with the job as a filter, the deadline
  card, as-it-stands, the days coming up, the trades grouped by state (sent back, not in, waiting on us, approved,
  our own crew), the total line with Send faint until bill day, and the six access points. No prototype change.
- **v1.116, 2026-10-11**: the plan's body catches up with the prototype (an audit of the two): Trade partners is a
  surface row, Customers names its three tabs, Follow up its four sections and the nudge row's buttons, the job page
  its papers table, the panel its title and its ‹, the editor its whole, the More menu its See their page, *done*
  for *settled* in Whose move it is, the offer's *just talk*, the pill without *by the rule*, the stamps' parentheses,
  the send window and the sign page under piece 2, the portal page for customers and architects, By step as rows
  and By company; the demo-only presses are named once. The More menu's stray *Their portal page* row, which went
  to Settings, is gone. The plan gains *Bill day on a job*, the trades' pay applications against the deadline
  (the owner's ask): what goes on the page and its access points.
- **v1.115, 2026-10-11**: the consent version and language come off the signer's side of the sign page; they are the
  office's bookkeeping and stay on the signed copy's audit line, as the app's kernel has it (the owner, 2026-10-11).
- **v1.114, 2026-10-11**: the sign page's consent is the app's own, `src/lib/esignConsent.ts` version 2, verbatim, in English
  and Spanish by the portal's switch: the one sentence (the same effect as ink, and paper from the office at no charge),
  How electronic signing works opening the two paragraphs (the statutes, this page and its PDF are your copy, you do
  not have to sign this way, withdrawing consent later, what you need), the Full disclosure link to the public page,
  and the separate checkbox as the affirmative consent; a line says what signing records (the name as typed, the
  time, the consent words by version and language, the signed PDF); the signed block carries the audit line with the
  statutes and the consent version (the owner, 2026-10-11: does this meet the criteria, and the paper disclosure).
  The prototype's earlier box had its own shorter words, which is the drift the kernel exists to stop.
- **v1.113, 2026-10-11**: a paper to sign, the four the owner asked for. (1) Send it on a paper we send (the MSA, the
  statement of work, our contract, a change order) opens the send window, the review before it goes: who it goes to,
  the sign-by day, the email as they see it with its Read and sign link, and the paper as they see it, the standard
  agreement unchanged; Send to sign files the copy, the thread shows it, the step waits on their signature. (2) Their
  sign page, what the link opens: the paper, the consent sentence with How electronic signing works, a typed
  signature and Sign; the portal's Sign button and the card's sign (demo) open it, and Sign makes the step green by
  itself, writes the event line and puts the signed copy on Documents. (3) The reminder: Remind them on the card opens
  the same window in reminder mode with the history in words, First sent Oct 2, today, no reminder yet, and the
  Follow up row carries the same words. (4) The customer's contract and a change order go the same way as the MSA.
- **v1.112, 2026-10-11**: a step box keeps its name on one line; when the day and the tag do not fit beside it they
  drop to a second line at the right, instead of the name breaking in two (the owner, 2026-10-11, the 280 px panel).
- **v1.111, 2026-10-11**: the panel's title is the flow's own name, *Customer flow*, *Trade partner flow*, *Architect
  flow*, the words of the editor's tabs, and *The flow* for a number nobody has named; the person's name is in the
  thread header beside it and is not said twice (the owner's pick, 2026-10-11). The rail's hover card says the same.
- **v1.110, 2026-10-11**: the panel's title is the person's name, *Elena's flow · customer*, and the card's history is
  *How Elena got here*; the demo had said *Her flow* for every customer, a pronoun guessed from a name (the owner,
  2026-10-11: why her?). The app never guesses a pronoun; a name is always there.
- **v1.109, 2026-10-11**: the customer's pay application step is named *Pay application*, not *Pay app sent · certified ·
  paid*, which wrapped the box to three lines beside its day and its tag (the owner, 2026-10-11); the three stages are
  the round's own words instead, *Pay app 3 · paid*, *Pay app 4 · with the architect*, and change orders say *signed*.
  A box's day and tag may drop under a long name rather than squeeze it.
- **v1.108, 2026-10-11**: Everyone by step is `by-step-mockups.html` A, one row per step with the people as chips that
  wrap, each the whole company, the job and the day, late first and tinted, the lanes named, off the flow folded as the
  last row; the List tab is B, By company: one row per company with the Once lane as a track, the step on now in
  words and one line per job. Customers has Threads · By step · By company. The column board went. The Messages
  list's by-step picker sits on top of everything instead of under the list's edge (the owner, 2026-10-11).
- **v1.107, 2026-10-11**: `by-step-mockups.html`, three shapes for Everyone by step that say a name once and cut
  nothing (the owner: no duplicate names, no hidden information): A one row per step with the people as chips that
  wrap, B one row per company with the Once lane as a track, C the columns one lane at a time; the pick is A with B
  as the List tab. No prototype change.
- **v1.106, 2026-10-11**: beside every nudge in the editor, and on the step card's nudge line, *⌕ see it* opens what the
  nudge looks like when it goes, for a person on the step now (or a sample one): a text as the bubble on their phone
  with the carriers' line, an email as the letter from the seat, a call as the Follow up row with what to say; the
  words are the step's line in Quick replies, with Edit quick replies there (the owner, 2026-10-11). The portal page's
  frame got its own class; it had taken the send preview's.
- **v1.105, 2026-10-11**: the quick replies head in a thread narrower than 640 px is two rows, Quick replies with the
  narrow box and Edit on the first, the group pills on their own line under it, instead of three rows with the box
  alone on the last (the owner: narrow belongs beside Quick replies in this viewport).
- **v1.104, 2026-10-11**: the proof pass (the owner: the panel fell off the page). The flow panel scrolls with the page,
  whole, while the thread stays pinned, instead of sticking with a height that ran past the window; on a phone the
  panel is never drawn, the rail and the sheet are; the editor's table scrolls inside its card and the who-moves card
  drops below it when the window is under about 1,200 px; the How it is going funnel and the job's papers fold on a
  phone; "A certificate uploaded", not "A insurance"; a step waiting on someone else reads so in the portal. Every
  view was screenshotted at 1440, 1180, 900 and 375 px and read for broken words and overflow.
- **v1.103, 2026-10-11**: the phone: at 375 px the panel is never drawn, the rail's mark or the thread's step opens the
  step card as a sheet from the bottom with the same sections; the by-step board scrolls sideways.
- **v1.102, 2026-10-11**: time in step and How it is going: the card's first line reads the usual (the step's median) with
  a bar that runs red past it; Settings → Flows gains a How it is going tab, the funnel of the per-job lane and one row
  per step (on it now, usual, longest now with its name, done this quarter, where it sticks).
- **v1.101, 2026-10-11**: the nudge is a Follow up row: *Nudges from the flow* under We owe them, one row per step on now
  with their move that is quiet past its count of days or past its day, folded with a lapsed step of the same person,
  with the step, what we wait on and the channel the flow asked for (Call in Quo · Text instead · Hold); a person's
  step that waits on someone else's makes the row for that person (Jonah's certificate); the hard-coded Late on their
  word section went. A fact turning true writes the gray event line and clears the row.
- **v1.100, 2026-10-11**: the papers read the flow back: while the box holds a step's line (Ask for it, Nudge now, a
  quick reply on a step) the Attach picker's first rows are that step's papers, starred (the form, their portal link);
  the job page gains *Papers on this job, by company*, each paper with its state, the step it finishes and where the
  person is, with the step card's own buttons, for the steps done, on now and next.
- **v1.99, 2026-10-11**: Everyone by step: Trade partners is a page (By step · List · Asks) with one column per step in
  the flow's order, the lanes a gap apart, the count with late, lapsed and waiting in words, faces longest first, a
  company once per job in the per-job lane, off the flow folded at the end; Customers gains the same board behind a
  By step button; the Messages list gains a *by step ▾* chip. Ten companies with no thread stand on the board so it
  reads like a Tuesday; a press on one says so.
- **v1.98, 2026-10-11**: Settings → Flows is the editor: the name and its Spanish name, the facts as chips with × and a
  picker in groups (in use on which step, picked, Ask for a fact that is missing), and · or on a fork, whose move with
  the seat on an our-move step, the nudge as days · how · ask me or the app sends it, repeats, the papers as chips, the
  usual, up and down, Remove (who is on it, they land on the next step), + a step in a lane; every edit opens a *Before
  you save · who moves* card that tries it on everyone (Tom Riddle · Papers in → MSA signed) with Save and Put it
  back; a History tab with every change and the Removed steps with Put it back.
- **v1.97, 2026-10-11**: their own view of it: *See their page* (the panel, the step card, More ▾) opens the portal's
  first page as a phone: *Where you are with Click Construction*, their-move steps the only buttons with why in a
  sentence, our-move steps as *with us* and what unlocks them, done steps with their day, one section per job they
  are on, nothing of ours; Español switches it, the step names from the editor's Spanish column.
- **v1.96, 2026-10-11**: the flow suite's pieces 1, 2 and 6 in the prototype. The flows carry facts from a list in code
  (FACTS, one line each with the column it reads), the papers a step turns on, the seat on our-move steps, the nudge as
  days, how and who sends it, and a usual; a person's papers live on PAPERS and the state is a read: done, on now,
  next, late (a day on the step or the round), lapsed (a done fact that is not true now: Greg's insurance), waiting on
  someone else (Elena's pay app on Jonah's certificate), skipped, and off the flow (Marcus Bell, a new customer whose bid
  was lost). The panel's boxes carry a paper mark (○ ✓ ↗ !), a day, the lapsed reason or the person waited on, and the
  per-job caption picks the job; a press on a box or a rail mark opens the step card: the facts read live with Open,
  Ask for it (fills the box with the step's line and the portal link), Send it (an email with the paper, filed) or
  File a paper we were handed (a fact, never a bare mark); What it holds up; After this with Send now; the nudge with
  Nudge now and Hold until Mon; the history, team notes on the step, Does not apply; a loop's card one line per
  round; the off card. A fact turning true (the demo's upload) finishes the step by itself, moves the next one on and
  writes the gray event line.
- **v1.95, 2026-10-11**: `flow-suite-mockups.html` pieces 7 to 10 and cut 5 folded in. Everyone by step (7): one column per
  step with counts, faces and how long, late tinted, off the flow folded, three homes drawn and B picked, the top
  of Trade partners and of Customers, with a by-step filter chip on the Messages list. Their own view (8): the
  trade's portal page, their-move steps as buttons, ours as "with us", Spanish by the portal's switch. Time in
  step and the report (9): the usual on the card's first line, a How it is going tab beside the editor with the
  funnel and one row per step. The phone (10): the rail's mark opens the card as a sheet. Cut 5 into its pieces:
  the per-job lane switches job (1); a team note on a step and Does not apply (2); the seat on our-move steps,
  ask me or the app sends it, Ask for a fact that is missing (3); the event line when a fact turns true (5). The
  whole weighed at the end: one read, four states first, the nudge is a Follow up row and never a second queue,
  the portal page third in the build order. No prototype change.
- **v1.94, 2026-10-11**: `flow-suite-mockups.html` piece 6, the states of a step: the legend (done, on now, next, late,
  lapsed, waiting on someone else, off the flow, no new color), the lapsed card (Greg's insurance ran out while he
  quotes), the waiting card (Elena's pay app waiting on Jonah's certificate), the off-the-flow panel and card (a
  declined bid), and the two-flows decision drawn both ways, leaning A. No prototype change.
- **v1.93b, 2026-10-11**: the plan's *The flow suite, next cuts*: five cuts from the owner's "are there features we're
  missing?" (the states of a step, Everyone by step, their own view, time in step and the report, the small
  things), the order, and the three decisions that are the owner's. No prototype change.
- **v1.93, 2026-10-11**: `flow-suite-mockups.html`, the flow suite as five pieces (paper marks on the steps, the
  step card, the editor with its fact picker and preview, the papers reading the flow back, the nudge as a
  Follow up row) with the sweep of which stamp finishes each step; the plan gains *The flow suite*. No
  prototype change.
- **v1.92, 2026-10-11**: the link wording follows the Drive handler: a big file stays in the job's Drive folder and
  goes as our link to it, the portal page when the thing has one, and the email note says the link is ours, not
  Drive's; a file from this computer says it goes into Team only on the way out.
- **v1.91, 2026-10-11**: attachments going out: Attach beside the box, the job's files first, then this computer,
  then a photo; on an email the file, or a link when over the limit; on a text a photo as the picture and anything else
  as a link to their portal or the file; the preview shows it and the sent message keeps each with how it went (the
  owner's go).
- **v1.90, 2026-10-11**: the who-has-it pill reads *Rosa has this* alone; since-when moves to its hover card, in
  words then the stamp (the owner's ask).
- **v1.89, 2026-10-11**: *After this sends:* (the owner's words).
- **v1.88, 2026-10-11**: the question, the presses and the meaning run as one line of text, the meaning in the lit
  side's colour and wrapping on from the presses rather than standing alone (the owner's ask).
- **v1.87, 2026-10-11**: the whose-move question and its two presses share one line, the question cut to *After this
  goes:* (the owner's ask).
- **v1.86, 2026-10-11**: the opt-out line is the app's own bubble under the text, labelled with its reason, on a first
  text or the first after 30 quiet days; *Leave it off this time* holds it back on the silence reason only, with
  *Put it back*, and the sent text records the line or the hold (the owner's pick of three ways).
- **v1.85, 2026-10-11**: the email tab's note on where each part comes from sits under the buttons, at the bottom of
  the window (the owner's ask).
- **v1.84, 2026-10-11**: the Subject line in the send window has a *change* that replaces the made subject for this
  one email; the inbox row follows and the sent email keeps it (the owner's ask).
- **v1.83, 2026-10-11**: the send window's tick is a two-press choice, *After this goes, whose move is it? Their move ·
  Our move*, with a line under it saying what that means; the tick rows are gone (the owner: our move and their move,
  a proper refresh).
- **v1.82, 2026-10-11**: the owed item's words read as a filled blank, the strip's own look without the caret,
  wherever they are dropped into a sentence: the send window's tick and the strip's Send button (the owner: make it
  clear it is a filled-in word).
- **v1.81, 2026-10-11**: the email's greeting has a *change* that sets what the contact goes by, on their record,
  read by every greeting and by the owed strip's and the stamps' words (the owner's ask). The contact's record gains
  a goes-by name.
- **v1.80, 2026-10-11**: the reply line reads *Email back, text, or call* (the owner's words); the signature keeps
  *cell* before the sender's number.
- **v1.79, 2026-10-11**: the send window's To line, on the email and the text, is a press that adds or changes the
  contact's email or number on their record, with a Save and an event line; the no-email and no-number warnings point
  at it (the owner's go). Our side stays fixed.
- **v1.78, 2026-10-11**: the email's signature is the sender's name, title and own cell from their account; the
  company number stays in the letterhead only, and the reply line says what to do instead of repeating it (the owner:
  it looked duplicate). Our From and the company number are not set per email: one number and one mailbox for
  everyone (the owner, 2026-10-05); the contact's email and number are theirs to fix on their record.
- **v1.77, 2026-10-11**: the quick replies fold to one row once the box has words, a press showing them again, the
  cleared box showing them by itself (the owner's ask).
- **v1.76, 2026-10-11**: the words box in the add row and the edit row wraps and grows with its words (the owner's
  ask).
- **v1.75, 2026-10-11**: an opened line and its editor read as one block in the accent tint with a rule down the left,
  so the open area is a different colour from the rows around it (the owner's ask).
- **v1.74, 2026-10-11**: the two tag pickers stack beside the line, in the add row and the edit row, and the window's
  sentence under its title is gone (the owner's asks).
- **v1.73, 2026-10-11**: the quick replies window's table in groups, who it is for then the step in the flow's order,
  the most used first in each, the group's tags on its head row; the last two columns one line each, so a row is one
  line; the search lights the words in the table too (the owner: sorted better).
- **v1.72, 2026-10-11**: the words typed in the quick replies' narrow box are lit in each matching line (the owner's
  ask).
- **v1.71, 2026-10-11**: the quick replies' groups as pills in the strip's head with their counts, a press scrolling
  the box to the group and the pill for the group in view lit; the hint sentence leaves the head (the owner's ask).
- **v1.70, 2026-10-11**: the words are **Our move** and **Their move**, not court: the pill, the list's and Follow up's
  short forms, the flow panel's On now line, the hover cards and the send window's tick (the owner: not the court).
  *No move* when nothing is waiting. The plan's section is *Whose move it is*.
- **v1.69, 2026-10-11**: the thread as a window (`thread-regions-mockups.html` B, the second step of D): the card takes
  the window's height, the name row with its corner pins at the top and the reply box at the bottom, each with a soft
  shadow, and the rest of the header scrolls away with the conversation; the thread opens at its newest line; the
  people list keeps the window's height too, so only the conversation scrolls on Messages. The More menu pins to the
  window, since the scroll area would clip it.
- **v1.68, 2026-10-11**: the conversation sits in a tinted well between the header and the reply box, the message cards
  white on it (`thread-regions-mockups.html` A, the first step of the owner's pick D).
- **v1.67, 2026-10-11**: quick replies sorted (`quick-replies-mockups.html` C): each line for a kind of person and
  a flow step, the strip in three groups with the step they are on first and your most used first in each, whole
  lines, a filter box past ten lines; the window (`quick-replies-editor-mockups.html`): the whole list with use
  counts, a row opened in place with its history of versions and who used it, Remove with a Removed tab, Add with
  the tags guessed from the words (the owner's go).
- **v1.66, 2026-10-11**: the word is **Done**, not settled, everywhere a person reads it: the strip's *Mark it done,
  with a team note*, the *Marking it done* banner and *Done, with this note* / *Not done yet*, the *✓ done: the start
  date* chip, the send window's *This message gets the start date done*, the event lines and the hover cards
  (the owner: settle is not our department's word). The plan's own prose keeps *settled* where it names the record's
  field, `settled_at`, and the earlier log lines stand as written.
