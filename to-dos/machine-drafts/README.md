---
name: "The machine drafts, a person presses: a voice note to a field report, a thread summary on the job window, Quo's missed-call auto-reply"
number: 186
group: gated
status: proposed 2026-10-26 from the holistic look's lens 11 · three items, a decision row each · waiting on the owner's yes or no per item
summary: >
  The app's rule for automation is that the machine drafts and a person presses: the robots bid
  blind, the flows' nudges wait on Today's sends, Who is this? guesses and the office picks. The
  owner chose to take the drafting further and named three places. A tech talks for thirty
  seconds on the job and the field report's fields fill as a draft the tech reads and saves. The
  job window opens on three stamped lines that say where the job stands with the customer, what
  they are waiting on and what we promised. A missed call gets a text back, which Quo already
  offers on its own number. Each item has its plan, its cost per use, its critique and a
  recommendation, so the owner can say yes or no to each on its own.
next: The owner says yes or no to each of the three. A yes starts that item's own build at its first PR.
size: 1 · M as three PRs (S · M · S) · 2 · S as two PRs (S · S) · 3 · XS, a switch in Quo and one PR of ours
blocker: A model key in Vault for 1 and 2 (the repo holds none today). For 3, a try of Quo's auto-reply on the company number.
opinion: 1 add, the structured draft over the keyboard's own dictation first · 2 add, rule-built first and the model behind a press · 3 not ours to build, switch Quo's on and file its text
mockup: to-dos/machine-drafts/mockup.html
---

# The machine drafts, a person presses (#186)

## The ask

The owner, 2026-10-26, in the holistic look at the user experience, picked lens 11: *the drafting can
go further*, with three additions to weigh. His ask, in his words: *"help me come up with a plan and
mockup for each of these items and present them to me such that I can decide what we should add
and not."*

This is a proposal. Nothing here is built until the owner picks. Each item below is its own build
when picked, with its own PRs, and the decision rows at the end take a yes or a no each.

## The rule, in one paragraph

The app already drafts in four places, and in every one a person presses before anything is a record.
The robot estimators bid blind through `twin-mcp` and are scored against the human number. The flows'
nudges draft each reminder, and a step set to **Offers** puts the text on the Dashboard's **Today's
sends** for the office to press, while **Sends** lets the morning run `messages-nudge-dispatch` send it.
Messages' **Who is this?** guesses who a new sender is, with why, and the office presses one guess
(`src/lib/followUp/newLane.ts`, `customerLink.ts`). A quick reply fills the line and a person sends it.
The three items below keep that shape: the machine reads what the app holds, writes a draft where the
person already works, says what it read and when, and nothing is written as a record until the person
presses the button that already exists. A draft a person did not press is thrown away, not kept.

## One key for two of the three

Items 1 and 2 need a language model. The repo holds no model key in any edge function today: the robots
are Claude sessions calling `twin-mcp`, and nothing in `supabase/functions/` calls a model. The same
finding came out of the supply-house bill capture proposal (#179). So the first PR of whichever item is
picked first makes the door both share, on the shape `quo-config` gave the Quo key (v2.5718):

- **`model-config`**, an edge function: `status` (a key is held, from Vault or the environment, its last
  four characters, when and by whom), `set` (the key into Vault), `forget`. Owner or dev, a real account,
  not read-only. The RPCs are `model_secret_set` / `model_secret_get` / `model_secret_status` on the
  pattern of `quo_secret_*` (migration `20261021020000_quo_config.sql`), one secret name per provider.
- **A card on Settings**, *Model keys*, beside the Quo connection card: the provider, the last four
  characters, *Saved Oct 27 by Robert*, a field to paste a new one. Never the key itself.
- The model: Anthropic's default for new code is **Claude Opus 5.5**, $4 a million tokens in and $20 out.
  Claude Sonnet 5.5 is $2 and $10. Claude Haiku 5.5 is $0.10 and $0.50. Each item's section gives the
  cost per use at all three, and the owner's pick is a decision row. The key is one `ANTHROPIC_API_KEY`
  whichever model is used.
- Speech to text is a second provider, since Claude's API takes text, pictures and PDFs and not audio.
  Item 1 names the options. Its key is a second Vault secret behind the same card.

Every call from an edge function says what it is for in one system line, sends only the rows the item
names, and writes nothing. The draft comes back to the screen and lives in the form's state until the
press.

---

## 1 · A voice note to a field report

### Today

Marco finishes the rough-in on *Whitfield (1104)* and files a Status Report before he drives off.

1. **Leave Report** on the Dashboard's Job Mode card (`DashboardJobModeCard.tsx`), or the clock-out
   modal, or **＋ Report** on the job window (v2.5688). One tap.
2. **New report** opens (`NewReportModal.tsx`). Report type is a row of chips, **Status** first. The job
   is filled from the one he is clocked into. One tap if the type is right.
3. **Notes**, a long text box. He types with his thumbs, or taps the keyboard's microphone and dictates.
   Most notes are one line.
4. **How complete is the job?** On a job with two or more priced lines this is the lines list
   (`ReportLinesProgressField.tsx`, #130, v2.5663): Rough In, Top Out, Trim Set, each row opening to
   the chips 25 · 50 · 75 · 100 and a slider. One tap to open a line, one to pick, per line. Four lines
   is eight taps.
5. **Save report**. The row goes to `reports` (`field_values` keyed by the field's label, the template's
   id, the job), the lines' percents to the job through `propagateReportPctToJob`, the feed and the
   Pipeline's percent follow.

So a careful report is ten to twelve taps and a paragraph typed on a phone, after a day's work. What
gets filed is one line and a fifty.

The Status Report has two fields today, Notes and the percent. The template rows are
`report_templates` and `report_template_fields` (`long_text`, `percent_0_100`, `signature_png`), and
the office can add a field. There is no field for the parts used or the next step. The phone session's
camera-first report (`to-dos/phone-first/`, in flight the same day as this one) is the screen this item
lands on, and it may reshape the form. Whatever shape it takes, the draft below fills the fields the
form has.

### The draft

**What the machine reads.** The words Marco said, as text. The job's lines in plan order with each line's
last recorded percent (`useJobLineProgress`'s rows). The template's fields with their labels and kinds.
The job's last report, so *same as yesterday* means something. Nothing else: no customer data beyond the
job's name and address, no money.

**What it writes as a draft.** One object, `ReportDraft`, in the form's state and nowhere else:

- **Notes**: three short lines in the office's words. What was done. The parts used. The next step.
  Each from what he said and nothing he did not say.
- **The lines**: a percent per line he named, with the words it came from under it. A line he did not
  name is left as it was, never guessed.
- **What you said**: the transcript as spoken, under a fold, so the draft can be checked against it.

If the phone session's report adds fields for the parts and the next step, the draft fills those
fields and Notes keeps only what was done.

**Where it shows.** On the report form itself. A **Talk it through** button sits at the top of the form,
over Report type. A press records. A second press, or a pause of three seconds, stops it. The fields fill
in a moment, each marked *Drafted from your voice note*, in blue until he touches it. The lines list
opens on the lines he named with their numbers set. The fold *What you said* sits under Notes.

**What he presses.** The same **Save report**. He reads the draft first, because it is his report with
his name on it. A touch on any field keeps his words and drops the mark.

**What is never written without the press.** The report row. The job's percent. The lines' percents.
The audio, which is not kept at all: it goes from the phone to the transcription and is gone. The
transcript, which lives in the form until Save and then only inside Notes if he leaves it there. A
draft he walks away from is lost, as an unsaved form is today.

### Where it plugs in

| What | Exists | New |
|---|---|---|
| The form | `src/components/NewReportModal.tsx`, `AdditionalReportModal.tsx`: `fieldValues` keyed by label, `lineProgress.setPick(fixtureId, pct)`, `Save report` | the **Talk it through** button over Report type, the drafted marks on the fields, the *What you said* fold |
| The lines | `src/components/ReportLinesProgressField.tsx`, `src/lib/reports/lineProgressReport.ts`, `src/hooks/useJobLineProgress.ts` | the draft's percents poured into `picks`, marked drafted |
| The rows | `reports`, `report_templates`, `report_template_fields`, `propagateReportPctToJob` | nothing |
| Speech | the keyboard's microphone, today | `src/lib/reports/voiceNote.ts` (pure: the recorder's states, the browser's speech result into one transcript, the fallbacks) and `src/hooks/useVoiceNote.ts` (MediaRecorder or the browser's `SpeechRecognition`) |
| The draft | — | `src/lib/reports/voiceDraft.ts` (pure: the prompt's inputs from the lines and the fields, the draft's shape, `applyDraft` onto `fieldValues` and `picks`, what a touch clears) with its tests; the edge function `report-draft` (takes the transcript or the audio and the job's lines, answers the draft, writes nothing) |
| The key | — | `model-config`, above |
| No signal | `OfflineRetryPanel`, #163's queue once built | nothing of its own: see below |

### What it needs

**Speech to text, two ways.**

| | On the phone, free | A transcription model |
|---|---|---|
| How | The keyboard's microphone types into Notes today. Or the browser's own `SpeechRecognition`: Safari on an iPhone since 14.5, Chrome on Android. | The phone records thirty seconds with `MediaRecorder` and posts it to `report-draft`, which sends it to the provider. |
| Cost | $0 | AssemblyAI about $0.0025 a minute, OpenAI's gpt-4o-mini-transcribe $0.003, Whisper and gpt-4o-transcribe $0.006, Deepgram Nova-3 $0.0043 to $0.0077. A thirty-second note is a fifth of a cent to a third of a cent. The figures are third-party comparisons read 2026-10-26, so confirm on the provider's page. |
| Even | Uneven. The browser's speech stops on a pause, drops words in wind, sends the audio to Apple or Google anyway, and the language is picked before it starts. The keyboard's dictation is better on an iPhone and runs on the device for English and Spanish. | Even. Punctuation, names, the language found on its own, Spanish and English in one note. |
| Signal | The keyboard's dictation works with none on an iPhone. The browser's needs one. | Needs one. |
| Key | None | A second secret in Vault behind the Model keys card |

**A plain transcript as a note, or a structured draft.**

| | A. The transcript into Notes | B. The structured draft |
|---|---|---|
| What fills | Notes, as spoken | Notes in three lines, the lines' percents, the parts and the next step |
| What it needs | Speech to text only | Speech to text and the language model |
| Cost per note | $0 to a third of a cent | plus the draft: about 1,200 tokens in and 200 out. Claude Opus 5.5 about a cent. Sonnet 5.5 half a cent. Haiku 5.5 a fiftieth of a cent. |
| What the tech checks | That the words are his | That the percents are the lines he meant |
| Risk | A paragraph of speech in Notes reads like speech | A percent on the wrong line. The draft shows the words it came from under each number, and a line he did not name stays untouched. |

**The rest.** No webhook. No migration for the draft. One setting, the Model keys card. The `report-draft`
function is deployed by hand like every edge function, and `docs/EDGE_FUNCTIONS.md` gets its section.

### No signal, and in Spanish

**No signal.** The structured draft needs the server, so there is none. The button says so: *No signal.
Use the keyboard's microphone and the report waits to send.* The keyboard's dictation still types into
Notes on an iPhone, he sets the lines by hand, and Save report goes into #163's queue when that is built
(*Offline in the field*, the bar at the top). Today it shows the Retry panel. The draft never waits in
the queue to be made later, because then nobody would be there to read it before Save.

**In Spanish.** The transcription model finds the language on its own, and the browser's speech is set
to Spanish by the phone's own language. The draft writes Notes in English, since the report is the
office's record, and keeps the Spanish under *Lo que dijiste* so the tech can check it against his own
words. The lines' percents are numbers and need no language. A decision row asks whether Notes should
carry both.

### The plan

1. **PR 1 · S · the button and the transcript.** `voiceNote.ts` with its tests, `useVoiceNote`, the
   **Talk it through** button over Report type, the recording states, the transcript into Notes with
   the *What you said* fold. The browser's own speech first, so nothing is deployed and no key is
   needed. On a phone without it the button reads *Use the keyboard's microphone*. A guide,
   *talk a field report through*.
2. **PR 2 · M · the draft.** `model-config` with its migration and the Model keys card, `voiceDraft.ts`
   with its tests, the `report-draft` function, the drafted marks on the fields, the lines' percents
   poured in with their words, the no-signal line. The transcript now comes from the transcription
   model when a key is held, the browser's when not.
3. **PR 3 · S · the phone session's form.** When the camera-first report lands, the button moves to
   its top and the draft fills its fields. If that report lands first, PR 1 builds on it instead.

### Is this the best we can do?

- **The keyboard already does half of this for free.** A tech can dictate into Notes today with no
  build. PR 1 adds a button that does what the microphone key does, with a fold. The honest first step
  may be a guide that says *tap the microphone on your keyboard*, and a count after two weeks of how
  many Notes are longer than one line.
- **The value is in the percents, not the words.** Report by line (#130) found techs filing a fifty for
  the job when they meant the stage. A draft that hears *rough-in is done, top-out tomorrow* and sets
  Rough In to 100 and leaves Top Out alone is what moves the money screens. That is PR 2, and it is the
  one to judge.
- **A draft a tech saves without reading is a report nobody wrote.** The marks in blue and the words
  under each number are there so the reading is quick, not skipped. Procore's daily log drafts from
  photos and voice notes the same way and still asks for the save.
- **Two providers for one button.** Speech to text is not Claude's, so the item carries two keys. The
  browser's speech avoids the second key and is worse. A decision row carries it.
- **Not built, by design:** a voice note kept as audio on the report. The thread keeps Quo's recordings
  because the customer said them. A tech's note is a draft, and the report is the record.

**Recommendation: add.** PR 1 first with the browser's speech, PR 2 with the transcription model and the
draft on Claude Opus 5.5 at low effort, on the phone session's form when it lands.

---

## 2 · A thread summary at the top of the job window

### Today

Rosa opens *Whitfield (1104)* from the Pipeline. The job window's Job tab (`DetailJobModal.tsx`) shows
the name, the customer, the speech bubble beside her name, the activity header with its pills and
**＋ Report**, the percent readout, then the feed: notes, reports, clock sessions, events and the
customer's lines in orange. The customer's box under the feed opens on the lines for the job's stage
(v2.5629). The bubble opens the customer's door with the thread's last three lines (v2.5632,
`customerDoor.ts`'s `lastLinesOnJob`) and *Waiting on us: Dana wrote last, yesterday.*

To know where the job stands with Dana, Rosa reads down the feed: the last text each way, the call on
Friday where she said she would pick the fixture by Thursday, the note where Rosa promised a start date,
the stage move. On a job with forty lines that is a scroll and a read, every time, by everyone who opens
the window.

### The draft

**What the machine reads.** The thread's lines tied to the job through `contact_jobs` (`useJobMessages`,
the same read the feed makes) and the job's own events from the feed (`jobActivityEvent.ts`: reports,
stage moves, schedule blocks, promises). Nothing from other jobs.

**What it writes as a draft.** Three lines and a stamp, drawn at the top of the Job tab under the header
row, above the activity pills:

- **Where it stands:** *Dana wrote last, yesterday 4:12 PM, a text. Rough In is at 100 since the crew's
  report Oct 24.*
- **They are waiting on:** *her fixture pick by Thu Oct 29, her word on the call Oct 24.*
- **We promised:** *a start Mon Nov 2, Rosa's note Oct 24.*
- The stamp: ***Read 8:10 AM from 41 lines and 12 events.***

**Where it shows.** The card is the first thing in the Job tab. It folds to one line with a chevron and
stays folded on your browser if you fold it. Two small presses on it: **Read again** and **Keep as a note**.

**What she presses.** Nothing, to read it. **Keep as a note** writes the three lines and the stamp as a
team note on Dana's thread tied to the job, through the reply box's note path, with Rosa's name on it.
That is the only write, and it is hers.

**What is never written without the press.** The summary itself. It is never a message, never a note,
never a row, unless **Keep as a note** is pressed. A kept summary is a note like any note, with the
stamp inside it so a reader knows what it read and when.

### Two ways to make it

| | A. Rule-built, from the facts the app holds | B. Model-written, from the lines |
|---|---|---|
| Where it stands | the last line each way (`stamps.ts`'s `lastIn` / `lastOut`), the step on now and whose move (`flows/now.ts`'s `flowNowOf`), the newest report's percent | the model reads the lines and events and writes it |
| They are waiting on | the open promise with its day (`message_promises`, `written`), what we owe them (`contact_owed`) | the same, in prose, with a reason it read |
| We promised | the `said` day on a logged call, a note's day to come back (`back_on`), the next nudge due (`nudges.ts`) | the same |
| Cost per open | $0 | About 3,300 tokens in and 120 out. Claude Opus 5.5 about 1.6 cents. Sonnet 5.5 about 0.8. Haiku 5.5 about 0.04. |
| When nothing is written down | *Nothing written down yet. The last word was hers, yesterday.* | a guess from the lines, which may be wrong |
| Every word traceable to a line | yes, each line is a door to the line it came from | the stamp says what it read, not which line each word came from |
| Reads the words themselves | no, only the days and facts a person wrote down | yes, so a promise nobody wrote down still shows |
| Needs | nothing: a pure kernel over reads the window already makes | `model-config`, the `thread-summary` function, a table to keep it |

**When it is made again.** A is made on every open and costs nothing. B needs a rule:

| | On open | On a new line | By press |
|---|---|---|---|
| Cost | every open pays, about 1.6 cents at Opus 5.5, about $19 a month at forty opens a day | once per new line on the thread, which is far fewer than opens | $0 until pressed |
| Freshness | always fresh | fresh unless an event changed with no line | as fresh as the last press, with the stamp saying so |
| The pick | no | **yes**: made again only when the thread has a line or an event newer than the stamp, kept in `job_thread_summaries` so an open that changed nothing reads the kept one | and **Read again** on the card for anyone who wants a fresh one now |

Prompt caching cuts the cost of B further: the thread's older lines are the same bytes on every call
and are read from the cache at a tenth of the price. The figures above are without it.

### Where it plugs in

| What | Exists | New |
|---|---|---|
| The window | `src/components/jobs/DetailJobModal.tsx`: the header row, the activity header, `JobCustomerBox`, `JobCustomerSheet` | `JobThreadSummary.tsx`, the card at the top of the Job tab, folded per browser as Show is |
| The reads | `useJobMessages` (the thread through `contact_jobs`), the feed's events, `lastLinesOnJob` | nothing new: the card reads what the window already loaded |
| The facts | `lib/messages/stamps.ts`, `owed.ts`, `promises.ts`, `lib/flows/now.ts`, `nudges.ts`, `customerDoor.ts`'s `lastWordWords` | `src/lib/jobs/threadSummary.ts` (pure: the three lines from the facts, the stamp's counts, staleness against the newest line, the note's body for Keep as a note) with its tests |
| Keep as a note | the reply box's note path, `messages` channel `note`, direction `team` | nothing |
| The model way | — | the edge function `thread-summary` (reads the job's lines as the caller, answers three lines, never writes), the table `job_thread_summaries` (job, made at, lines read, events read, the three lines, the model, who asked), one migration with the three fences, `model-config` |

### What it needs

A: nothing. No key, no function, no migration, no setting. B: the Model keys card, one edge function,
one migration, and a decision on when it is made again. No webhook.

### The plan

1. **PR 1 · S · the rule-built card.** `threadSummary.ts` with its tests, the card with its stamp, the
   fold per browser, **Keep as a note**. Every line a door to the line it came from. Guide: *see where
   a job stands with the customer*.
2. **PR 2 · S · the model behind Read again.** `model-config` if item 1 did not make it, the
   `thread-summary` function, the table and its migration, **Read again with the model** on the card
   next to the rule-built lines, made again only on a newer line. The rule-built lines stay above the
   model's, so a wrong sentence has the facts beside it.

### Is this the best we can do?

- **The facts are already written down.** A promise, a heard day, what we owe: the app keeps each as a
  row because a person pressed *Write down their word*. A rule that reads those rows is right every time
  and costs nothing. A model that reads the lines can find a promise nobody wrote down, and can also
  find one that was not made.
- **Three lines are an opinion.** *Where it stands* is a judgment. The rule-built card gives the facts
  and lets Rosa judge. The model gives the judgment and the stamp. The owner should say which he wants
  on top.
- **The bubble already says half of it.** *Waiting on us: Dana wrote last, yesterday* is on the
  customer's door since v2.5632. The card moves that sentence to the top of the window and adds the
  promise each way. The smallest version of this item is PR 1 alone.
- **A kept note goes stale the moment it is kept.** The stamp inside it is the guard. The card itself
  never goes stale because it is made again from the rows on every open.
- **Not built, by design:** a summary on the Pipeline's row or in the feed's list. The window is where
  the reading happens, and one card per open is enough.

**Recommendation: add.** PR 1 now. PR 2 only if the owner wants prose on top of the facts, on Claude
Opus 5.5 made again on a newer line, the cheaper models a decision row.

---

## 3 · Quo's missed-call auto-reply

**The owner picked B on 2026-10-26 and parked it the same day** (*"don't do PR4 yet, move it to the punchlist"*). It is its own to-do now, #195, [`to-dos/missed-call-text/`](../missed-call-text/README.md), with B's plan and drawing. What follows is the comparison the pick was made from.

### Today

Dana calls the company number at 4:11 PM on a Friday. Nobody picks up. Quo posts `call.missed` and,
if she left one, `call.voicemail.completed`, and `quo-webhook` writes one line on her thread: *rang
everyone · no voicemail* or the voicemail's words. The line is hers, so it lands in Follow up: the
**New** lane with **Call back** when nobody has named the number, else **Needs a reply**. The office sees
it when the office looks. Dana hears nothing until someone calls back.

Settings → Phone and texts holds the seats, the two inboxes, the **Office hours**
(`messages_office_hours_v1`, v2.5709), the **Send texts** switch (`messages_texts_on_v1`) and the reply
push. The call tasks, **Call in Quo** and the logged call are #152 and v2.5710. The app sends no text on
its own but the morning run's reminders and the answers to HELP and STOP.

### What Quo offers (read on 2026-10-26, public pages only)

Quo's own pages, read for this proposal: the auto-replies product pages, the missed-call blog, the
business hours guide, the Sona guide, the pricing blog and the webhook payload docs.

1. **Auto-replies on a missed call.** Set per phone number: Settings › Phone numbers › the number ›
   Automations › Auto-replies, on the web and desktop apps only. Four missed-call cases: with or without
   a voicemail, during or after business hours. Two more triggers: a new voicemail and an incoming text.
   One auto-reply to the same number every three hours, and none when the contact answered our own text
   within minutes. The pricing page lists auto-replies on the Starter plan. The instant-response product
   page says to start a Business trial for them, so confirm on the plan.
2. **Business hours, per number.** Settings › Phone numbers › Enable business hours, a time zone, every
   day or weekdays or custom, one block a day. After hours a call goes to voicemail, an audio message or
   a forward. Texts are delivered at any hour. These hours are Quo's and the app's Office hours are the
   app's, so the two are set by hand to match.
3. **Sona, Quo's AI agent.** Put in the call flow after Ring users, so it takes the missed calls, or after
   the business hours check, so it takes the after-hours ones. It answers from a knowledge base the
   office writes, takes the caller's name and reason and any fields the office adds, and transfers. After
   the call: a summary, a recording and a transcript. Ten calls a month are included on Starter, Business
   and Scale, then $1 a call by the support page, or tiers by the pricing page: $25 a month for 40 calls
   at $0.75 over, $49 for 100, $99 for 250, $199 for 600. The two pages disagree, so confirm. A 7-day
   trial with unlimited calls. Stripe billing and an admin seat to set it up.
4. **What the webhook says.** `message.delivered` carries the text, the number, the user and the phone
   number, and no field that marks an auto-reply. `call.missed` is minimal and fires on incoming calls
   only. `call.completed` has a status, and `ai-handled` is Sona's.
5. **What the app already does with each.** A text Quo sends with no line of ours under its id is
   written whole by `mergeSent` (`events.ts`), named *‹seat holder› · from the company number* when Quo
   names a user, else *Quo's app · from the company number*. The trigger `messages_move_state` reads any
   line with direction `out` as our reply: it clears Needs a reply and starts Waiting on them. A call
   with status `ai-handled` already reads *Quo's assistant answered* (`callWho`), and the summary,
   transcript and recording merge onto the line as Quo sends them.

### Three ways

#### A · Quo's own auto-reply, switched on in Quo. The app files the text it sends.

The owner opens Quo on the web, picks the company number, turns on the four missed-call auto-replies
with the office's words, and sets Quo's business hours to the app's Office hours. Done in ten minutes.
Nothing to deploy for the reply itself.

- **What it costs.** Nothing beyond the plan. One text from the company number per missed call.
- **What the customer gets.** A text from the company number within seconds: *Sorry we missed your call.
  This is Click Plumbing. Text us here or we call you back in the morning.* One in three hours, however
  many times she calls.
- **What the office sees in Messages.** The missed call on the New lane with Call back, as today, and
  under it Quo's text as a line of ours. Two things are wrong until one PR fixes them: the line is named
  after whichever user Quo puts on the event, and the trigger reads it as our reply, so Dana's missed
  call leaves Needs a reply and the row starts counting Waiting on them. The PR: `mergeSent` names a text
  with no write of ours under its id that lands within two minutes of a missed call or voicemail from the
  same number *Quo's auto-reply · from the company number*, flags it `auto`, and the trigger skips a line
  flagged `auto`. One migration: `messages.auto`, default false, and the trigger's one clause. Whom Quo
  names on the event is to be tried, since the docs type the user as always present.
- **What it does not honor.** The app's Send texts switch, since Quo sends it. A prospect's *May we text?*,
  since Quo does not know it. STOP is Quo's own, which it honors.

#### B · The app sends the reply through `quo-send` on the missed-call event

`quo-webhook` already plans an answer on a text (HELP, the stop confirmation). A `missed` or `voicemail`
reading would plan one more: purpose `missed`, the words from a new **Missed calls** card on Settings →
Phone and texts (`app_settings.messages_missed_call_reply_v1`: the switch, the line in office hours, the
line after, the voicemail variants), picked against the app's Office hours.

- **What it costs.** One text through Quo, as a reply costs. The build: S, one PR with the migration
  above, the card, the kernel's purpose and gates, the webhook's plan.
- **What the customer gets.** The same text, a few seconds later than Quo's, since it waits on the
  webhook.
- **What the office sees.** The same row, and under it *The app · from the company number* with the
  words, flagged `auto` so nothing clears. The Settings card with the words and the switch.
- **What it honors, that A cannot.** The Send texts switch (the purpose gates on it), a prospect's *May we
  text?* (`textRefusal`), the box's STOP, the walk kit, our own numbers, a text of ours to that number in
  the last three hours (the same cap as Quo's), the daily cap, and one set of hours. It also works on the
  bids number once that box has one.
- **The cost of that.** We rebuild what Quo gives on the plan. Our reply goes only while the webhook is
  up and the switch is on. Every rule above is ours to test, and a wrong one texts a customer.

#### C · Sona answers the call

Sona goes in the call flow after Ring users, or only after hours. Dana hears a voice that says it is an
AI assistant, answers hours and services from the knowledge base, takes her name, the address and what
is wrong, and says the office will call. The call lands on her thread as *Quo's assistant answered ·
1:40* with Sona's summary and next steps, the transcript and the recording, exactly as `events.ts`
writes an `ai-handled` call today. Nothing to build on our side.

- **What it costs.** Ten calls a month on the plan, then Quo's per-call price above. How many calls the
  company misses a month is the number to read first: the thread's `missed` and `voicemail` lines over
  the last thirty days, which the owner's seat can count on Messages.
- **What the office sees.** The call in Needs a reply with a summary that already names what she wants,
  so the call back is shorter. The *Write down their word* line under it offers her day if she gave one.
- **What it does not do.** Say anything in Spanish that Quo has not published. Set up itself: the
  greeting, the knowledge base and the fields are the office's to write in Quo.

### Side by side

| | A · Quo's own | B · The app's own | C · Sona |
|---|---|---|---|
| The customer hears | a text in seconds | a text in seconds, after the webhook | a voice that takes a message |
| In and after hours | Quo's hours | the app's Office hours | Quo's call flow |
| Honors Send texts and May we text? | no | yes | n/a, a call |
| The thread's line | Quo's auto-reply, after one PR | The app, flagged auto | Quo's assistant answered, today |
| Clears Needs a reply wrongly | yes, until the PR | no | no |
| Cost per missed call | $0 | $0 | $0 for the first ten a month, then about $0.45 to $1 |
| To build | XS, one PR | S, one PR | nothing |
| To set up | ten minutes in Quo | the card's words | the greeting, the knowledge base, the fields, the flow |

### The plan

1. **The owner switches A on in Quo** and sets Quo's business hours to match Office hours. The words are
   the office's. That day the app shows the text as *‹seat holder›* and clears Needs a reply, which the
   PR below fixes, so switch it on the day the PR lands.
2. **PR 1 · XS · name the auto-reply and keep it from counting.** The migration (`messages.auto` and the
   trigger's clause), `mergeSent`'s rule with its test, the New lane row's quiet line *Quo texted back
   at 4:12 PM*, the fragment and the release note. The webhook's `_shared` copy of `events.ts` is a
   mirrored kernel, so `npm run check:edge-drift` turns red for it until the function is deployed.
3. **Try Sona after hours for a month** on the free calls, once the missed-call count is read. Nothing
   to build. If the count says the plan's ten are not enough, that is Quo's price list, not ours.
4. **B is not built.** It is here so the choice is on the page.

### Is this the best we can do?

- **The comparison already made this call.** The 2026-10-24 trade comparison's buy-or-build answer was
  to integrate Quo's missed-call auto-replies and Sona rather than build our own. This item agrees and
  adds the one PR that makes the thread honest about it.
- **One switch in two places.** A sends whether or not the app's Send texts is on. The owner turned
  texts on knowingly, and Quo's auto-reply is a second door with its own switch in Quo. The Phone and
  texts page should say so in one line under Send texts, so nobody is surprised.
- **A caller who said not to text.** Quo honors STOP. The app's *May we text?* on a prospect is ours and
  Quo cannot read it, so a cold prospect who called and was told no texts may get one. The count of
  such people is small, and the fix is B, which costs the whole rebuild. The honest answer is to say
  it, not build around it.
- **Two sets of hours.** The office sets them twice. A later small cut could show Quo's hours on the
  Office hours card through `quo-config`'s directory read, if Quo's API exposes them. It does not today.
- **Not built, by design:** the app's own reply (B), and an answer that reads the voicemail and texts
  back what it heard, which is a model drafting a customer text that nobody presses. That crosses the
  rule.

**Recommendation: not ours to build.** Switch Quo's on and file its text, one XS PR. Try Sona after
hours on the free calls.

---

## Decisions for the owner

One row per item. A yes starts that item's build at its first PR. The sub-choices are taken as
recommended unless the owner says otherwise.

| # | Item | Add · Later · Not | The sub-choices |
|---|---|---|---|
| 1 | A voice note to a field report | **add**, recommended | the browser's speech first then a transcription model, or the model from the start · Notes in English with the Spanish under a fold, or both in Notes · Claude Opus 5.5 at a cent a note, or Haiku 5.5 at a fiftieth |
| 2 | A thread summary on the job window | **add**, recommended, PR 1 | rule-built only, or the model behind Read again · made again on a newer line, or on every open · Opus 5.5 at 1.6 cents, Sonnet 5.5 at 0.8, Haiku 5.5 at 0.04 |
| 3 | Quo's missed-call auto-reply | recommended not ours to build (A); **the owner picked B** on 2026-10-26 and parked it, now #195 (`to-dos/missed-call-text/`) | A, B or C · Sona after hours on the free calls, or not yet · the words of the reply, the office's |

Shared: the Model keys card and `model-config` come with whichever of 1 or 2 is picked first.

## How to verify

- **1.** As a tech on a ZZ test job with four priced lines and no Order row, on a phone: press Leave
  Report, Talk it through, say *rough-in is done, we set the tub, top-out tomorrow, used two 3/4 PEX
  couplings*. Rough In reads 100 drafted, Top Out and the rest untouched, Notes three lines, the fold
  holds the words. Touch Notes, the mark drops. Save report, the feed shows the report and the job's
  percent moved by the lines' shares. Airplane mode on: the button says to use the keyboard's microphone
  and nothing is drafted. The same in Spanish.
- **2.** As the dev on a ZZ test job with a written promise each way: open the window, the card reads
  the three lines with the stamp's counts matching the feed and the thread. Press each line, the feed
  scrolls to the line it came from. Keep as a note, the thread gets a team note with the stamp inside
  and nothing else is written. Fold it, open the window again, it stays folded.
- **3.** On a ZZ contact's number, a dev's own phone: call the company number, let it ring out. Quo's
  text arrives. The thread shows the missed call and under it *Quo's auto-reply · from the company
  number*, Needs a reply still holds the row, Waiting on them does not start. Call again within three
  hours, no second text. Nothing is pressed on a real customer.

## Where it stands

Proposed 2026-10-26. The mock-up beside this file, `mockup.html`, draws the before beside the after for
each item: items 1 and 3 at phone width, item 2 at desktop width, every person and number made up. The
phone session's camera-first report (`to-dos/phone-first/`) is the screen item 1 lands on, and that
session is told so in the shared notes. Nothing is built.
