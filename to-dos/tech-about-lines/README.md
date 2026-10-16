---
name: "The tech's bio: a short resume that rides the first On my way a tech sends a customer"
number: 114
group: ready
status: Grace took every recommendation 2026-10-16; building on branch claude/messaging-customers-on-my-way-605c82 — PR 2 the ground (v2.5587, migration 20261016030000) built the same day; PR 3 the send next
summary: >
  The office writes a short bio for each tech, like the resume handed over with a plumber or an
  electrician: years in the trade, the license, what they are best at, a personal line. The first
  time a tech presses On my way to a customer who has never heard from them, the On my way text
  goes as today and the bio follows it as a second text. Every later On my way from that tech to
  that customer is just the line. A different tech on the same customer gets their own bio the
  first time. On the sheet the tech reads the bio before it goes, holds it with Not this time, or
  presses Edit bio to pick which lines go for this customer. In Settings → Your account the tech
  sets their usual picks with Say it / Don't say this; the office writes the lines on the person's
  desk.
next: PR 3 (the bio kind in quo-send's tech path, the sheet's bubble and Edit bio window, the thread's mark), then the push and the types, then the live walk on the owner's phone.
size: M (one migration: a table, a column on messages, two functions; one send kind in quo-send's tech path; one kernel; the sheet's second bubble and the Edit bio window; the desk's block; the Settings block; two guides)
blocker: none. The five calls are made: two texts, a line in the thread that introduces the tech and never again, the company's third person, pick lines only, the person's desk
opinion: build it as drawn — the bio is its own text, sent once per tech per customer, in the company's words about the tech, with the tech picking the lines for this customer.
mockup: to-dos/tech-about-lines/mockup.html
---

# The tech's bio

## The ask

Grace, 2026-10-16, the morning after On my way shipped (punch list #112, v2.5573):

> I think it would be really smart for us to add a short bio for techs that they can set in their
> settings, so what is told to customers is a little different. "XYZ is on the way to you. He/she is
> a father of 2, his favorite sports team is the ABC, and has been in the business for 12 years" —
> where each of those lines can be set by office staff and looked at by a tech in their settings,
> and are a part of the On my way message.

On the first mock-up, which rotated one fact into every On my way:

> It is meant to be that initial resume we hand over with a plumber or electrician or technician
> that shows, like a resume, who they are, so the person feels comfortable right off the bat. It is
> not meant to be something that is sent every time. It really should only accompany the first
> message. To be personable, every time a new person that has not already sent a message to that
> customer submits I'm on my way, it could give them a short resume. And then every additional
> message about that person is just "Abraham is on his way."

And on the second, with the bio as a second text:

> I like the Say it / Don't say it options in Settings. I think we can take it a little farther.
> Move Not this time to the left and, where Not this time is, put a button that says Edit bio that
> pulls up an additional modal on top, that allows the user to select which of his lines go in for
> this customer.

## What is already there

- **The On my way text** is the office's line with blanks the app fills (*{first}, this is {me}
  with Click Plumbing. I am on my way, about {minutes} minutes out.*). `quo-send`'s tech path
  (`_shared/quoTechSend.ts`, `src/lib/quo/techSend.ts`) makes the text again from the line and the
  record, so what the tech saw is what goes and no free text leaves the phone. The office rewords
  the line in the quick replies editor; it can already read *{me} with Click Plumbing is on the
  way* if the owner prefers the company's voice.
- **The thread remembers who sent what.** Every text out is a `messages` row with `who_user_id`
  (the sender), `contact_id` (the customer's own thread), `jobs_ledger_id` and `quick_reply_id`
  (the line it came from). A tech reads a contact's lines on a job they are on
  (`messages_tech_read`), so the phone can read the same memory the server does.
- **A tech's Settings** is one tab, *Your account* (My Profile: name, email, phone; password; push;
  location). Primaries and helpers see no Phone and texts tab and no quick replies editor.
- **The office's person surface** is the person's desk (People → Users → Open desk, v2.4336–4348;
  `src/components/personDesk/sections/`) and the row's *Edit name, title & phone*.
- **A window on top of a sheet** has its rules: it registers with `useModalStackEntry`, stops its
  backdrop click, and Esc closes only the top layer (`check:nested-windows`,
  `check:backdrop-click`, `check:dialog-role`).
- **The customer's language**: `customerLang` picks Spanish when the customer reads it.
- Neither `users` nor `people` has a photo column, and `{link}` (the customer's page) is off the
  phone until the field can make it.

## The decision

**The bio is a short resume the office writes for each tech.** A table, `user_bio_lines`: the
user, the English, the Spanish, a place, who added it and when, when it was removed, and when the
tech turned it off. The office writes it the way a resume reads when you hand it over, **in the
company's words about the tech, in the third person**, each line a full sentence with the pronoun
written in, since the office knows the person: *Luis has been a plumber for twelve years and holds
a Texas journeyman license. Water heaters and repipes are his specialty. Off the clock he coaches
Little League in Seguin.* The desk's **Add a line** offers six prompts shaped like a resume (years
in the trade, license, best at, family, off the clock, hometown) that only start the sentence. The
app opens the text with *A little about Luis:* and joins the lines in order. **320 characters at
most for the whole bio**, two text segments; the editor counts down on the whole, not the line.

**It rides the first On my way a tech sends a customer, as a second text.** When the tech presses
**On my way, text Dana**, the clock-in happens, the On my way line goes exactly as the office wrote
it, and then, when Dana has never had this tech's bio, the bio goes as its own text right after.
Two bubbles on her phone: the line, then the card. Every later On my way from Luis to Dana is the
line alone. When Michael takes the next visit, Dana gets Michael's bio with his first On my way.
The I'm here text and the Message the customer lines never carry it: by then they have met, or the
line is about something else.

**What counts as introduced is the thread's memory.** Every bio sent is a `messages` row with
`introduces_user_id` set to the tech it introduces. The phone and the server ask the same question,
*is there a line in this customer's thread that introduces Luis?*, before offering or sending. So
a tech whose first text to a customer was *Running late* still introduces themself on their first
On my way; an office text to the customer does not count as Luis; and a customer Luis served two
years ago is not introduced twice (call 2 asks whether a long gap should re-introduce).

**The sheet, the first time.** Under the On my way bubble a second block: *Dana hears from you for
the first time. This goes right after:* and the bio in its own orange bubble. Under it one row with
two ends: **Not this time** on the left, a quiet link that holds the bio for a customer who clearly
knows the tech, and **Edit bio** on the right, a button. The *What happens* rows gain a third:
*Then texts your bio, 3 of 4 lines, since Dana has not heard from you before.* The press clocks
first, texts the line second, the bio third; a bio that fails leaves the first two standing and
says so. Every later press draws the sheet as today.

**Edit bio is a window on top of the sheet.** *Your bio for Dana*: the bio as Dana gets it with the
ticks as they stand, the count left of 320, then every live line with a tick box, in the office's
order, each pre-ticked from the tech's usual picks in Settings. The tech ticks a line off for this
customer, or on, and the preview and the count follow. **Use these** closes the window with the
pick; **Back** leaves it as it was. A line turned off in Settings shows unticked here and can be
ticked on for this one customer, which changes nothing in Settings; a quiet line under the list
says *Your usual picks are in Settings → Your account.* The phone sends the picked lines' ids
with the bio's request, never their words; the server checks each id is the sender's own live line
and composes in the office's order. No tick at all is the same as Not this time.

**The tech's usual picks are in Settings.** Settings → Your account gains **Your bio**: the text
as a customer gets it, then each line with **Say it** / **Don't say this**. A line turned off
leaves the bio by default, and the desk shows the office *Luis turned this off*. The tech does not
write or edit a line: the voice is the company's (call 4).

**The office writes on the person's desk.** A block, **Luis's bio**: the lines in order with the
Spanish beside each, *No Spanish yet* where it is missing, the preview as a customer reads it, the
count left, remove, and **Add a line** with the prompts. The office team (`GC_OFFICE_TEAM`)
writes; the tech reads their own; `quo-send` reads as the service role. A Spanish-reading
customer gets the Spanish lines only; with none written, no bio goes rather than an English one.

## The calls

Grace's, before PR 2. The recommendation is first in each.

1. **One text or two.** The bio as its own text right after the On my way line, or one longer
   text with the bio under a blank line. Two reads like a card handed over after the greeting,
   keeps the On my way line exactly the office's words, and lets the line go even when the bio
   cannot.
2. **What counts as introduced.** A line in the customer's thread that introduces this tech (so a
   tech whose first text was *Running late* still introduces themself on their first On my way), or
   any earlier text from this tech to this customer, your literal words. And whether a tech is
   introduced again after a long gap with no texts to that customer: never, or after a year.
3. **The voice.** The company's words about the tech, third person, opened by *A little about
   Luis:*, like a resume, or the tech's first person (*A little about me: I have…*). Third person
   matches the handover and your example; the office writes the pronoun in, so there is nothing to
   guess.
4. **May a tech write?** Pick lines only (the office writes; Settings holds the usual picks, Edit
   bio the picks for this customer), or suggest a line the office approves, or write freely. The
   pick keeps the company's voice and ships smallest; a suggestion door is one later cut.
5. **Where the office edits.** The person's desk, or a card on Settings → Phone and texts listing
   every tech. The desk is where the office already shapes who a person is, one person at a time.

## Alternatives weighed

- **A. One fact rotated into every On my way** (the first mock-up). Rejected by Grace: the bio is
  a handover, not a running feature; a customer who knows the tech needs no fact.
- **B. The bio inside the On my way line through a new blank.** Rejected: it ties the resume to
  one line's wording, needs the first optional blank in the fill system, and makes the line longer
  every first time. A second text leaves the line and the blanks untouched.
- **C. One bio field, free text, appended whole.** Rejected: no Spanish beside each line, no pick
  on a line, no count the office can see; lines give the office and the tech the same handles.
- **D. The tech writes their own bio in Settings.** Rejected for now: the voice customers hear is
  the company's. The tech picks lines instead, in Settings and for each customer (call 4).
- **E. Fields the app composes** (years, license, specialty) into sentences. Rejected: stiff
  grammar and the pronoun problem; the office writes a better sentence than a template fills.
- **F. Edit bio as ticks in place on the sheet**, with no window. Rejected: the sheet is already
  the destination, the minutes and the acts; a list of tick boxes in the middle buries the one
  press the day turns on. A window on top is read once and closed.
- **G. The office's lines about each tech, joined into one bio, sent as a second text the first
  time a tech texts On my way to a customer, remembered in the thread, the usual picks in Settings
  and the picks for this customer in Edit bio.** Picked.
- **H. A link to a "Meet Luis" page with a photo** (Housecall Pro's way). Not now: `{link}` is off
  the phone and there is no photo column. The first follow-on once the On my way customer-page
  card exists (#112's last follow-on): the bio then ends with the link.

## Is this the best we can do? The second pass

The first pass after Grace's correction kept the resume inside the On my way text through a blank
and asked "has this tech texted this customer?" Read back against the customer who gets the text,
the tech it introduces, and the office that writes it, these changed, and Grace's Edit bio added
the last two:

1. **Inside the line became a second text.** The On my way line goes exactly as the office wrote
   it every time; the bio follows it as its own bubble the first time, like a card after the
   greeting. The fill system and the editor are untouched, and the thread shows *Luis's bio* as
   its own line.
2. **"Has texted before" became "has been introduced".** A tech whose first text was *Running
   late* still gets introduced on their first On my way; an office text does not count as the
   tech; the memory is one column on the message, read the same way on the phone and the server.
3. **First person became the company's third person.** A resume is handed over by someone else.
   *A little about Luis: he has been a plumber for twelve years…* is the handover's frame; the
   office writes the pronoun in, so there is nothing for the app to guess.
4. **Prompts for facts became prompts shaped like a resume.** Years in the trade, license, best at,
   then the personal lines: what makes a customer comfortable before the truck pulls up.
5. **A cap per line became a cap on the whole.** The bio is one text, 320 characters, two
   segments; the desk counts down on the whole and the tech's picks change the count.
6. **Nothing on the sheet became the bio read before it goes.** The tech sees what Dana gets, and
   **Not this time** holds the bio for a customer who clearly knows them, while the line still goes.
7. **One fixed card became a pick for this customer.** Grace's Edit bio: a window on top of the
   sheet where the tech ticks which lines go this time. The Settings switches become the usual
   picks, so the window opens with the tech's defaults and a change there is for this one
   customer only; the preview and the count follow the ticks; the *What happens* row says how many
   lines go.
8. **The pick rides as ids.** The phone never sends the bio's words. Edit bio sends the picked
   lines' ids, the server checks each is the sender's own live line and composes in the office's
   order, so what the tech read is what goes, as every text from the phone.

## Where it plugs in

- `src/lib/bio/` (new, pure, tested) — `bioText(lines, picked, first, lang)` (the opener, the
  picked lines in the office's order, Spanish only for a Spanish reader, null with none),
  `BIO_CAP = 320`, `usualPicks(lines)` (the live lines not turned off, the window's starting ticks),
  `introduced(tail, userId)` (a line with `introduces_user_id`), the desk's, the sheet's, the
  window's and the Settings block's words.
- `src/lib/quo/techSend.ts` and `supabase/functions/_shared/quoTechSend.ts` — a second request
  kind, `{ from: 'job_mode', kind: 'bio', customerId, contactId, jobId, lineIds }`: the same
  who-may check (a tech on the job, or the office), the sender's lines read as the service role,
  each id checked to be the sender's own live line (*That line is not yours to send.*), the
  customer's language, refused in words when nothing is left to send (*Nothing to say yet*) or the
  thread already has it (*They have your bio*); the send is the reply box's (`sendText`), the row
  gets `introduces_user_id` and the job. `npm run gen:edge-kernels` after.
- `src/components/jobMode/OnMyWaySheet.tsx` — the second bubble, the two-ended row (**Not this
  time** left, **Edit bio** right), the third *What happens* row, the bio send after the line's
  with the picked ids; `jobModeOnMyWayIo.ts` loads the sender's lines and reads
  `introduces_user_id` on the tail the sheet already loads (one more column).
- `src/components/jobMode/BioPickWindow.tsx` (new) — the window on top of the sheet: the preview,
  the count, the tick list, **Back** and **Use these**; registered with `useModalStackEntry`,
  stops its backdrop click, `role="dialog"`; one render smoke at 375 px (open from the sheet, tick
  a line off, the preview and the row change, Use these).
- `MessageCustomerSheet.tsx` and `ImHereSheet.tsx` are untouched.
- The person's desk — a new `PersonDeskBioSection` after the Field section: **<name>'s bio**,
  over `edit_bio_line(p_user_id, p_id, p_text, p_text_es, p_position, p_remove)`; refusals in
  words through the same caller check `quick_reply_caller` uses (signed out, training, a twin, off
  the office team).
- `src/components/settings/SettingsAccountTab.tsx` — **Your bio**, over `bio_line_say(p_id,
  p_say)` (the row's owner only).
- Migration: `user_bio_lines` (RLS: the office team reads and writes, a user reads their own and
  updates only `off_by_user_at`; the three fence calls), `messages.introduces_user_id uuid`
  (nullable, indexed with `contact_id`), the two functions. No seed, no change to any quick reply.
- `src/components/gc/messages/` — the thread draws a bio line with a small *bio* mark, so the
  office sees it went.
- Guides: a new one for the office, *write a tech's bio*; a section in *clock in and out with Job
  Mode* (**Your bio goes with your first On my way**, with Edit bio) and a line in the Settings
  basics guide.

## The PR train

1. **This to-do** (the plan and the mock-up), then Grace's five calls.
2. **The ground**: the migration, the kernel and its tests, the bio kind in the tech path with the
   ids check and its SQL bed, the thread's mark. Nothing on a phone changes until a tech has lines.
3. **The screens**: the sheet's second bubble, the row and the Edit bio window; the desk's block;
   the Settings block; the guides; the release note.
4. **The types** after the push.

Follow-ons, each its own PR when asked: a *Suggest a line* door for the tech (call 4); *Save as my
usual picks* inside Edit bio; a photo and a **Meet Luis** card on the customer's page, linked from
the bio (after #112's customer-page follow-on); a re-introduction after a long gap if call 2 wants
one.

## How to verify

Live, as a primary or helper in Job Mode on a phone, with a test job whose customer is the owner's
own number, after the office wrote four lines for that tech (one without Spanish) and the tech
turned one off in Settings:

1. Press **On my way** on a customer the tech never texted. Under the orange box: *Dana hears from
   you for the first time* and the bio with three lines; the row reads *3 of 4 lines*. Press **On
   my way, text Dana**: the owner's phone gets two texts, the line then the bio; the thread shows
   both, the second marked *bio*.
2. Clock out and press **On my way** on the same job again: no second bubble, one text.
3. Sign in as a second tech on the same job and press **On my way**: that tech's bio, once.
4. Press **Edit bio** on a fresh customer: the window opens on top with three ticks, the fourth
   unticked. Tick the fourth on and one off; the preview and the count follow. **Use these**: the
   sheet's bubble and the row read the pick; Esc on the window closes only the window. Send: the
   text is the pick, in the office's order. Settings still shows the fourth line off.
5. Press **Not this time** on a fresh customer: one text; the next press offers the bio again,
   since none went. Untick every line in Edit bio: the sheet says no bio will go, the same as Not
   this time.
6. Switch the customer to Spanish: the bio is the Spanish lines only; with none written, no second
   text and the sheet says so under *What happens*.
7. Negative: a tech with no lines sees the sheet as today; the office adds a line that takes the
   bio past 320 characters and the desk refuses it with the count.
