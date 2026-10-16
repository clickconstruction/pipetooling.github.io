---
name: "A word about the tech: the office's lines about each tech, one in every On my way text"
number: 113
group: gated
status: designed 2026-10-16 (first pass, then a second pass; both below); waiting on the five calls before PR 2
summary: >
  The office writes a few short lines about each tech, in the tech's own voice, and the On my way
  text carries one of them: "Dana, this is Luis with Click Plumbing. I am on my way, about 20
  minutes out. I have two kids and coach Little League on Saturdays." Every visit says a different
  one, and a customer never hears the same fact twice while an unheard one is left. The line is a
  new blank, {about me}, that the office places in the On my way line (or any team line) in the
  quick replies editor. The tech reads the lines in Settings → Your account and can turn any one
  off. The office writes them on the person's desk.
next: Grace's five calls under "The calls"; then PR 2 (the migration, the blank and the kernel).
size: M (one migration: a table, a column on messages, two functions, one seed; one blank; one kernel; the sheet's swap link; the desk's block; the Settings block; two guides)
blocker: the five calls (the voice, whether a tech may write, the rotation, where the office edits, day one)
opinion: build it as the second pass draws it — first person, the office writes, the tech vetoes, the thread remembers what the customer heard.
mockup: to-dos/tech-about-lines/mockup.html
---

# A word about the tech

## The ask

Grace, 2026-10-16, the morning after On my way shipped (punch list #112, v2.5573):

> I think it would be really smart for us to add a short bio for techs that they can set in their
> settings with ad-libs, so on every visit what is told to customers is a little different.
>
> I see this looking like: "XYZ is on the way to you. He/she is a father of 2, his favorite sports
> team is the ABC, and has been in the business for 12 years" — but where each of those lines can
> be set by office staff and looked at by a tech in their settings, and are a part of the On my
> way message.

The owner's ask behind #112 is the parent: pre-configured lines that keep a tech from misspelling
or saying the wrong thing, with a preview before the send. This adds the one thing a canned text
lacks: a person on the other end.

## What is already there

- **The On my way text** is the office's line with blanks the app fills: *{first}, this is {me}
  with Click Plumbing. I am on my way, about {minutes} minutes out.* The blanks table is
  `src/lib/quickReplies/blanks.ts` (`{first}`, `{me}`, `{address}`, `{job}`, `{minutes}`,
  `{window}`, `{back day}`, `{back time}`, `{day}`, `{link}`, `{amount}`); a blank the app cannot
  fill is the tech's to type, and Send waits while one is open. `jobModeText.ts` is the one kernel
  both sides use: the phone shows the preview with it, and `quo-send`'s tech path
  (`_shared/quoTechSend.ts`, `src/lib/quo/techSend.ts`) makes the text again from the line and the
  record, so **what the tech saw is what goes and no free text leaves the phone**. A typed blank
  holds 40 characters at most.
- **The office's editor** is the quick replies window (Messages → the reply box → Quick replies →
  Edit; the guide *edit the quick replies*). A line has English and Spanish (`text_es`), a place
  on the phone, a name for the button, and since v2.5573 a **Big button on Job Mode** press. The
  editor's chip row names the blanks.
- **A tech's Settings** is one tab, *Your account* (My Profile: name, email, phone; password; push;
  location). Primaries and helpers see no Phone and texts tab and no quick replies editor.
- **The office's person surface** is the person's desk (People → Users → Open desk, v2.4336–4348)
  and the row's *Edit name, title & phone*.
- **The customer's language**: `customerLang` picks Spanish when the customer reads it, and a line
  without Spanish goes out in English.
- **The thread remembers the line**: `messages.quick_reply_id` ties every sent text to the line it
  came from. Nothing ties it to a fact about the tech yet. Neither `users` nor `people` has a
  photo column.

## The decision

**A new blank, `{about me}`, filled from the office's lines about the sender.** The office places
it where it wants, in the On my way line or any team line for customers; the migration adds it to
the end of the On my way press line once, so day one works, and the office moves or removes it in
the editor. It is the first **optional** blank: with nothing to say it vanishes with its sentence,
and it never stops a send. The chip reads *a word about you*.

**The lines are the office's, in the tech's voice.** A table, `user_about_lines`: the user, the
English, the Spanish, a place, who added it and when, when it was removed, and when the tech
turned it off. The office writes each line as the tech would say it in a text that already says
*this is Luis*: **first person** — *I have two kids and coach Little League on Saturdays.* — so
there is no he or she to get wrong. `{me}` is allowed for an office that prefers the third person
(*Luis has twelve years in the trade.*). **120 characters at most**, so the text stays inside two
SMS segments; the editor counts down.

**One fact a text, and a customer never hears the same one twice while an unheard one is left.**
The pick, from the tech's live lines the tech has not turned off (and that have Spanish, when the
customer reads Spanish): the first in order that this customer's thread has not carried yet
(`messages.about_line_id`, stamped on every text that carried one); when all have been heard, the
one heard longest ago. The rule reads only facts the phone and the server both hold, so the preview
is the text. The sheet shows the sentence marked in the orange box and offers two quiet links,
**Another fact** (the next in the rotation) and **Not this time**. The phone sends the line's id,
never its words; the server checks it is the sender's own live line, fills it, and stamps the
message.

**The tech holds a veto.** Settings → Your account gains **What customers hear about you**: the
lines, each with **Say it** / **Don't say this**. A line turned off is never sent, and the desk
shows the office *Luis turned this off*. The tech does not write or edit a line: the company's
voice stays the office's (call 2 below).

**The office writes on the person's desk.** A block, **What customers hear about Luis**: the lines
in order with the Spanish beside each, *No Spanish yet* where it is missing, *Luis turned this off*
where he did, remove, and **Add a line** with five prompts to pick from (years in the trade,
family, a team, a hobby, where you grew up) that only start the sentence. The office team
(`GC_OFFICE_TEAM`) writes; the tech reads their own; `quo-send` reads as the service role.

**Where it does not go.** The I'm here text: they are about to meet. The office's own sends from
the reply box fill `{about me}` from the office person's lines, which are usually none, so the
sentence vanishes — one rule, no special case.

## The calls

Grace's, before PR 2. The recommendation is first in each.

1. **The voice.** First person, written as the tech would say it (*I have two kids…*), or third
   person with `{me}` (*Luis has two kids…*). First person reads as one text from one person and
   has no pronoun to get wrong; the office may still write a line in the third person when it
   wants to.
2. **May a tech write?** Only turn a line off (the office writes), or also suggest a line the
   office approves, or write freely. The veto alone keeps the company's voice and ships smallest;
   a suggestion door is one later cut (a `proposed_at` on the row and an *Approve* on the desk).
3. **The rotation.** The thread's memory (never the same fact twice to one customer while an
   unheard one is left), or round robin per tech across all customers, or random each press. The
   thread's memory is what the customer notices; the other two repeat a fact on a three-visit job.
4. **Where the office edits.** The person's desk (one place per person, beside their title and
   phone), or a fold per tech inside the quick replies editor, or a card on Settings → Phone and
   texts. The desk is where the office already shapes who a person is.
5. **Day one.** The migration appends `{about me}` to the On my way press line, or the office adds
   it by hand after reading the guide. Appending means the first tech with lines is heard on the
   first press; the office can take it out in one edit.

## Alternatives weighed

- **A. One bio field on the user, appended whole.** Rejected: the same paragraph every visit, and
  a text that runs three segments.
- **B. A random fact on every press.** Rejected: a customer on a three-visit job hears the same
  fact twice while another waits; and unless the pick rides the request, the preview and the text
  can differ.
- **C. Kinds the app composes** (family, a team, years) into a sentence from a template. Rejected:
  the he/she problem and stiff grammar; the office writes a better sentence than a template fills.
- **D. The tech writes their own bio in Settings.** Rejected for now: the voice customers hear is
  the company's. The tech sees every line and can turn any one off instead (call 2).
- **E. A `{about me}` blank, the office's lines in the tech's voice, the pick by the thread's
  memory, the veto in Settings.** Picked.
- **F. A link to a "Meet Luis" page with a photo** (Housecall Pro's way). Not now: `{link}` is off
  the phone until the field can make the customer's page link, and there is no photo column. It is
  the first follow-on once the On my way customer-page card exists (#112's last follow-on).

## Is this the best we can do? The second pass

The first draft took Grace's picture as drawn: third-person lines (*he is a father of two*), the
office writing them in a settings card, a random one on every On my way. Read back against the
customer who gets the text, the tech it is about, and the rule that the preview is the text, these
changed:

1. **Third person became first person.** The text already says *this is Luis*; a third sentence
   about *he* breaks the voice and asks the office to get the pronoun right. First person has no
   pronoun. The office can still write the third person with `{me}`.
2. **Random became the thread's memory.** The customer is the one who hears a repeat. Reading
   which facts this thread already carried costs one column and makes the pick the same on the
   phone and the server.
3. **Office-only became the office writes, the tech vetoes.** The line is about the tech. One
   switch per line in Settings, and the desk says who turned what off.
4. **Baked into On my way became a blank the office places.** The office decides whether the fact
   rides at all, in which line, and where in the sentence; it reads in the chip row like every
   other blank.
5. **A required blank became the first optional one.** Every other blank stops the send until it is
   filled; this one vanishes with its sentence. A tech with no lines yet texts as today.
6. **No Spanish rule became skip the line.** A Spanish-reading customer never gets an English fact
   wedged into a Spanish text; the desk shows *No Spanish yet* so the office fills it.
7. **Fixed on the sheet became Another fact / Not this time.** The tech reads the fact as a
   sentence of their own and may pick a better one for this customer, or none, which is the
   owner's "offer the tech the tools to modify it" without free text.
8. **Unbounded became 120 characters.** One fact plus the On my way line stays inside two
   segments; the editor counts down.

## Where it plugs in

- `src/lib/quickReplies/blanks.ts` — `{about me}` in `BLANKS` (`from: 'you'`, words *a word about
  you*); `OPTIONAL_BLANKS = ['about me']`: `fillLine` drops an optional blank and the sentence it
  stands in when its fill is empty, and never lists it in `left`.
- `src/lib/jobModeText.ts` — `jobModeFills` takes the picked line's words and puts `about me`;
  `quo-send` fills the same way from the id the request names.
- `src/lib/aboutLines/` (new, pure, tested) — `pickAboutLine(lines, heard, lang)`: the rotation;
  `nextAfter` for Another fact; `aboutLineCap = 120`; the desk's and the Settings block's words.
- `src/lib/quo/techSend.ts` and `supabase/functions/_shared/quoTechSend.ts` — the request gains
  `aboutLineId: string | null`; the server reads the sender's live lines, refuses an id that is not
  theirs or is turned off (*That line is not yours to send.*), fills, stamps
  `messages.about_line_id`. `npm run gen:edge-kernels` after.
- `src/components/jobMode/OnMyWaySheet.tsx` and `MessageCustomerSheet.tsx` — the sentence marked in
  the orange box, **Another fact** / **Not this time** under it; `jobModeOnMyWayIo.ts` and
  `jobModeMessageCustomerIo.ts` load the sender's lines and the thread's `about_line_id`s (the
  tail the sheet already reads, one more column).
- `src/components/gc/messages/reply/QuickRepliesEditorLine.tsx` — the chip; nothing else.
- The person’s desk (People → Users → Open desk; `src/components/personDesk/sections/`, a new `PersonDeskAboutSection` after the Field section) — the block **What customers hear about
  <name>**, over `edit_about_line(p_user_id, p_id, p_text, p_text_es, p_position, p_remove)`;
  refusals in words through the same caller check `quick_reply_caller` uses (signed out, training,
  a twin, off the office team).
- `src/components/settings/SettingsAccountTab.tsx` — **What customers hear about you**, over
  `about_line_say(p_id, p_say)` (the row's owner only).
- Migration: `user_about_lines` (RLS: the office team reads and writes, a user reads their own and
  updates only `off_by_user_at`; the three fence calls), `messages.about_line_id uuid`, the two
  functions, the seed (`{about me}` appended to the On my way press line when it has none).
  `set_quick_reply_press` and the press column are untouched.
- Guides: a new one for the office, *say a word about a tech in the On my way text*; a section in
  *clock in and out with Job Mode* (**A word about you**) and one in the Settings basics.

## The PR train

1. **This to-do** (the plan and the mock-up), then Grace's five calls.
2. **The ground**: the migration, the optional blank, the fills on both sides, the request's
   `aboutLineId`, the kernel and its tests, the SQL bed. Nothing on a screen changes until a tech
   has lines; the seed puts the blank in the line, which vanishes with nothing to say.
3. **The screens**: the sheets' marked sentence and two links; the desk's block; the Settings
   block; the editor's chip; the guides; the release note.
4. **The types** after the push.

Follow-ons, each its own PR when asked: a *Suggest a line* door for the tech (call 2); a photo
and a **Meet Luis** card on the customer's page while the leg is on the way (after #112's
customer-page follow-on); which facts get a reply, on the desk.

## How to verify

Live, as a primary or helper in Job Mode on a phone, with a test job whose customer is the owner's
own number, after the office wrote three lines for that tech (one without Spanish):

1. Press **On my way**. The orange box ends with one of the lines, marked. Press **Another fact**:
   the next line. Press **Not this time**: the sentence is gone and the text ends at the minutes.
2. Send. The owner's phone gets the text with the fact; the thread shows the line with its
   `about_line_id`.
3. Clock out, press **On my way** on the same job again: a different fact is marked. Repeat until
   all three were sent; the fourth press marks the first again.
4. In Settings → Your account as the tech, turn one line off. The next press never offers it; the
   desk reads *… turned this off*.
5. Switch the customer to Spanish (their record). The line without Spanish is never offered; the
   others read in Spanish.
6. Remove `{about me}` from the On my way line in the editor: the text ends at the minutes, no
   links on the sheet. Put it back in the middle of the line: the fact reads where the office put
   it.
7. Negative: a tech with no lines reads the text as today, with no links; the office adds a line of
   121 characters and the editor refuses it.
