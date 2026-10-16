---
name: "The tech's introduction: a short resume that rides the first On my way a tech sends a customer"
number: 113
group: gated
status: designed 2026-10-16 (a first pass, Grace's correction, a second pass; all below); waiting on the five calls before PR 2
summary: >
  The office writes a short introduction for each tech, like the resume handed over with a plumber
  or an electrician: years in the trade, the license, what they are best at, a personal line. The
  first time a tech presses On my way to a customer who has never heard from them, the On my way
  text goes as today and the introduction follows it as a second text. Every later On my way from
  that tech to that customer is just the line. A different tech on the same customer gets their own
  introduction the first time. The tech reads their introduction in Settings → Your account and can
  turn a line off; the office writes it on the person's desk.
next: Grace's five calls under "The calls"; then PR 2 (the table, the memory column, the introduction send).
size: M (one migration: a table, a column on messages, two functions; one send kind in quo-send's tech path; one kernel; the sheet's second bubble; the desk's block; the Settings block; two guides)
blocker: the five calls (one text or two, what counts as introduced, the voice, whether a tech may write, where the office edits)
opinion: build it as the second pass draws it — the introduction is its own text, sent once per tech per customer, in the company's words about the tech.
mockup: to-dos/tech-about-lines/mockup.html
---

# The tech's introduction

## The ask

Grace, 2026-10-16, the morning after On my way shipped (punch list #112, v2.5573):

> I think it would be really smart for us to add a short bio for techs that they can set in their
> settings, so what is told to customers is a little different. "XYZ is on the way to you. He/she is
> a father of 2, his favorite sports team is the ABC, and has been in the business for 12 years" —
> where each of those lines can be set by office staff and looked at by a tech in their settings,
> and are a part of the On my way message.

And on the first mock-up, which rotated one fact into every On my way:

> It is meant to be that initial resume we hand over with a plumber or electrician or technician
> that shows, like a resume, who they are, so the person feels comfortable right off the bat. It is
> not meant to be something that is sent every time. It really should only accompany the first
> message. To be personable, every time a new person that has not already sent a message to that
> customer submits I'm on my way, it could give them a short resume. And then every additional
> message about that person is just "Abraham is on his way."

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
- **The customer's language**: `customerLang` picks Spanish when the customer reads it.
- Neither `users` nor `people` has a photo column, and `{link}` (the customer's page) is off the
  phone until the field can make it.

## The decision

**The introduction is a short resume the office writes for each tech.** A table,
`user_about_lines`: the user, the English, the Spanish, a place, who added it and when, when it
was removed, and when the tech turned it off. The office writes it the way a resume reads when you
hand it over, **in the company's words about the tech, in the third person**, each line a full
sentence with the pronoun written in, since the office knows the person: *Luis has been a plumber
for twelve years and holds a Texas journeyman license. Water heaters and repipes are his
specialty. Off the clock he coaches Little League in Seguin.* The desk's **Add a line** offers six
prompts shaped like a resume (years in the trade, license, best at, family, off the clock,
hometown) that only start the sentence. The app opens the text with *A little about Luis:* and
joins the lines in order. **320 characters at most for the whole introduction**, two text
segments; the editor counts down on the whole, not the line.

**It rides the first On my way a tech sends a customer, as a second text.** When the tech presses
**On my way, text Dana**, the clock-in happens, the On my way line goes exactly as the office wrote
it, and then, when Dana has never had this tech's introduction, the introduction goes as its own
text right after. Two bubbles on her phone: the line, then the card. Every later On my way from
Luis to Dana is the line alone. When Michael takes the next visit, Dana gets Michael's
introduction with his first On my way. The I'm here text and the Message the customer lines never
carry it: by then they have met, or the line is about something else.

**What counts as introduced is the thread's memory.** Every introduction sent is a `messages`
row with `introduces_user_id` set to the tech it introduces. The phone and the server ask the same
question, *is there a line in this customer's thread that introduces Luis?*, before offering or
sending. So a tech whose first text to a customer was *Running late* still introduces themself on
their first On my way; an office text to the customer does not count as Luis; and a customer Luis
served two years ago is not introduced twice (call 2 asks whether a long gap should re-introduce).

**The sheet, the first time.** Under the On my way bubble a second block: *Dana hears from you for
the first time. This goes right after:* and the introduction in its own orange bubble, with one
quiet link, **Not this time**. The *What happens* rows gain a third: *Then texts your introduction,
since Dana has not heard from you before.* The press clocks first, texts the line second, the
introduction third; an introduction that fails leaves the first two standing and says so. Every
later press draws the sheet as today.

**The tech reads and vetoes.** Settings → Your account gains **Your introduction**: the text as a
customer gets it, then each line with **Say it** / **Don't say this**. A line turned off leaves the
introduction, and the desk shows the office *Luis turned this off*. The tech does not write or
edit a line: the voice is the company's (call 4).

**The office writes on the person's desk.** A block, **Luis's introduction**: the lines in order
with the Spanish beside each, *No Spanish yet* where it is missing, the preview as a customer
reads it, the count left, remove, and **Add a line** with the prompts. The office team
(`GC_OFFICE_TEAM`) writes; the tech reads their own; `quo-send` reads as the service role. A
Spanish-reading customer gets the Spanish lines only; with none written, no introduction goes
rather than an English one.

## The calls

Grace's, before PR 2. The recommendation is first in each.

1. **One text or two.** The introduction as its own text right after the On my way line, or one
   longer text with the introduction under a blank line. Two reads like a card handed over after
   the greeting, keeps the On my way line exactly the office's words, and lets the line go even
   when the introduction cannot.
2. **What counts as introduced.** A line in the customer's thread that introduces this tech (so a
   tech whose first text was *Running late* still introduces themself on their first On my way), or
   any earlier text from this tech to this customer, your literal words. And whether a tech is
   introduced again after a long gap with no texts to that customer: never, or after a year.
3. **The voice.** The company's words about the tech, third person, opened by *A little about
   Luis:*, like a resume, or the tech's first person (*A little about me: I have…*). Third person
   matches the handover and your example; the office writes the pronoun in, so there is nothing to
   guess.
4. **May a tech write?** Turn a line off only (the office writes), or suggest a line the office
   approves, or write freely. The veto keeps the company's voice and ships smallest; a suggestion
   door is one later cut.
5. **Where the office edits.** The person's desk, or a card on Settings → Phone and texts listing
   every tech. The desk is where the office already shapes who a person is, one person at a time.

## Alternatives weighed

- **A. One fact rotated into every On my way** (the first mock-up). Rejected by Grace: the
  introduction is a handover, not a running feature; a customer who knows the tech needs no fact.
- **B. The introduction inside the On my way line through a new blank.** Rejected: it ties the
  resume to one line's wording, needs the first optional blank in the fill system, and makes the
  line longer every first time. A second text leaves the line and the blanks untouched.
- **C. One bio field, free text, appended whole.** Rejected: no Spanish beside each line, no veto
  on a line, no count the office can see; lines give the office and the tech the same handles.
- **D. The tech writes their own introduction in Settings.** Rejected for now: the voice customers
  hear is the company's. The tech reads every line and can turn one off (call 4).
- **E. Fields the app composes** (years, license, specialty) into sentences. Rejected: stiff
  grammar and the pronoun problem; the office writes a better sentence than a template fills.
- **F. The office's lines about each tech, joined into one introduction, sent as a second text the
  first time a tech texts On my way to a customer, remembered in the thread, vetoed in Settings.**
  Picked.
- **G. A link to a "Meet Luis" page with a photo** (Housecall Pro's way). Not now: `{link}` is off
  the phone and there is no photo column. The first follow-on once the On my way customer-page
  card exists (#112's last follow-on): the introduction then ends with the link.

## Is this the best we can do? The second pass

The first pass after Grace's correction kept the resume inside the On my way text through a blank
and asked "has this tech texted this customer?" Read back against the customer who gets the text,
the tech it introduces, and the office that writes it, six things changed:

1. **Inside the line became a second text.** The On my way line goes exactly as the office wrote
   it every time; the introduction follows it as its own bubble the first time, like a card after
   the greeting. The fill system and the editor are untouched, and the thread shows *Luis's
   introduction* as its own line.
2. **"Has texted before" became "has been introduced".** A tech whose first text was *Running
   late* still gets introduced on their first On my way; an office text does not count as the
   tech; the memory is one column on the message, read the same way on the phone and the server.
3. **First person became the company's third person.** A resume is handed over by someone else.
   *A little about Luis: he has been a plumber for twelve years…* is the handover's frame; the
   office writes the pronoun in, so there is nothing for the app to guess.
4. **Prompts for facts became prompts shaped like a resume.** Years in the trade, license, best at,
   then the personal lines: what makes a customer comfortable before the truck pulls up.
5. **A cap per line became a cap on the whole.** The introduction is one text, 320 characters,
   two segments; the desk counts down on the whole and the tech's switches change the count.
6. **Nothing on the sheet became a second bubble and one link.** The tech reads what Dana gets
   before it goes, and **Not this time** holds the introduction for a customer who clearly knows
   them, while the line still goes.

## Where it plugs in

- `src/lib/aboutLines/` (new, pure, tested) — `introductionText(lines, first, lang)` (the opener,
  the live lines not turned off, Spanish only for a Spanish reader, null with none),
  `INTRODUCTION_CAP = 320`, `introduced(tail, userId)` (a line with `introduces_user_id`), the
  desk's, the sheet's and the Settings block's words.
- `src/lib/quo/techSend.ts` and `supabase/functions/_shared/quoTechSend.ts` — a second request
  kind, `{ from: 'job_mode', kind: 'introduction', customerId, contactId, jobId }`: the same
  who-may check (a tech on the job, or the office), the sender's lines read as the service role,
  the customer's language, refused in words when there is nothing to send (*Nothing to introduce
  yet*) or the thread already has it (*They have your introduction*); the send is the reply box's
  (`sendText`), the row gets `introduces_user_id` and the job. `npm run gen:edge-kernels` after.
- `src/components/jobMode/OnMyWaySheet.tsx` — the second bubble, the third *What happens* row, the
  **Not this time** link, the introduction send after the line's; `jobModeOnMyWayIo.ts` loads the
  sender's lines and reads `introduces_user_id` on the tail the sheet already loads (one more
  column). `MessageCustomerSheet.tsx` and `ImHereSheet.tsx` are untouched.
- The person's desk — a new `PersonDeskAboutSection` after the Field section: **<name>'s
  introduction**, over `edit_about_line(p_user_id, p_id, p_text, p_text_es, p_position,
  p_remove)`; refusals in words through the same caller check `quick_reply_caller` uses (signed
  out, training, a twin, off the office team).
- `src/components/settings/SettingsAccountTab.tsx` — **Your introduction**, over
  `about_line_say(p_id, p_say)` (the row's owner only).
- Migration: `user_about_lines` (RLS: the office team reads and writes, a user reads their own and
  updates only `off_by_user_at`; the three fence calls), `messages.introduces_user_id uuid`
  (nullable, indexed with `contact_id`), the two functions. No seed, no change to any quick reply.
- `src/components/gc/messages/` — the thread draws an introduction line with a small *introduction*
  mark, so the office sees it went.
- Guides: a new one for the office, *write a tech's introduction*; a section in *clock in and out
  with Job Mode* (**Your introduction goes with your first On my way**) and a line in the Settings
  basics guide.

## The PR train

1. **This to-do** (the plan and the mock-up), then Grace's five calls.
2. **The ground**: the migration, the kernel and its tests, the introduction kind in the tech path
   and its SQL bed, the thread's mark. Nothing on a phone changes until a tech has lines.
3. **The screens**: the sheet's second bubble and link; the desk's block; the Settings block; the
   guides; the release note.
4. **The types** after the push.

Follow-ons, each its own PR when asked: a *Suggest a line* door for the tech (call 4); a photo and
a **Meet Luis** card on the customer's page, linked from the introduction (after #112's
customer-page follow-on); a re-introduction after a long gap if call 2 wants one.

## How to verify

Live, as a primary or helper in Job Mode on a phone, with a test job whose customer is the owner's
own number, after the office wrote three lines for that tech (one without Spanish):

1. Press **On my way** on a customer the tech never texted. Under the orange box: *Dana hears from
   you for the first time* and the introduction. Press **On my way, text Dana**: the owner's phone
   gets two texts, the line then the introduction; the thread shows both, the second marked
   *introduction*.
2. Clock out and press **On my way** on the same job again: no second bubble, one text.
3. Sign in as a second tech on the same job and press **On my way**: that tech's introduction,
   once.
4. Press **Not this time** on a fresh customer: one text; the next press offers the introduction
   again, since none went.
5. In Settings → Your account as the tech, turn one line off: the preview shortens; the desk reads
   *… turned this off*.
6. Switch the customer to Spanish: the introduction is the Spanish lines only; with none written,
   no second text and the sheet says so under *What happens*.
7. Negative: a tech with no lines sees the sheet as today; the office adds a line that takes the
   introduction past 320 characters and the desk refuses it with the count.
