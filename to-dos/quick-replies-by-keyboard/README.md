---
name: "Quick replies by keyboard, and a starter set for the office"
number: 126
group: gated
status: BUILDING 2026-10-19 — the owner picked A with C; the / list shipped as v2.5637 with the guide's door, and a shortcut per line as v2.5638 (migration 20261019040000); left: the starter lines, on the owner's words
summary: >
  The office sends the same few messages to customers every day. The app already holds them as
  quick replies: the strip above every reply box, Find a reply, the editor, and blanks that fill
  the customer's name, the window or the bill's pay page. Three things keep it from feeling like
  hotkeys. No key reaches a line, it ships with only two customer lines, and its guide points at
  GC projects. This to-do draws a / shortcut in the reply box, a one-word shortcut per line, and
  eleven starter lines placed so that no automatic send changes.
next: The owner sends the starter lines' words; then PR 4 seeds them in one migration, after a read of what the office has already saved.
size: XS (the starter lines) left
blocker: The owner's words for the starter lines.
opinion: seed the eight any-time lines with their shortcuts as soon as the words come, and the three step lines once the morning run can fill blanks
mockup: to-dos/quick-replies-by-keyboard/mockup.html
---

# Quick replies by keyboard, and a starter set (#126)

## Where it stands

The owner picked **A with C** on 2026-10-19 and asked for the starter lines' words to come separately. Built: the guide's door with the / list (PR 1 and 2 of the plan, v2.5637) and a shortcut per line (PR 3, v2.5638, migration `20261019040000_quick_replies_shortcut.sql`). B was not picked. Left: PR 4, the starter lines, with the owner's words and a shortcut each.

## The ask, in the owner's words

> I think that there are a certain number of common communications that will be had between the
> office staff and the customer. Do we currently have an easy way to pull from these hotkeys? If
> this makes sense, could you help me figure out what we might call these like macros and how we
> could offer them to our office staff?

Then, after the answer: *Draw the / shortcut and the starter quick replies as a to-do with
mock-ups for my pick before anything is built.*

## What exists today

- **The strip.** Every reply box the office writes to a customer in carries **Quick replies**
  above it: the thread on the Messages page, the job window's Text and Email, and the Pipeline
  row's customer sheet (`reply/ReplyBox.tsx`, `reply/QuickRepliesStrip.tsx`). It is folded to one
  press until opened, except on a job's box since v2.5629, which opens on the lines for the job's
  stage under **For this stage**. A press fills the box and nothing sends.
- **Find a reply** (`reply/FindReplyWindow.tsx`) shows their last message, where they are in the
  flow, a narrow box and every line with room to read. Its only key is Escape.
- **The editor** (`reply/QuickRepliesEditor.tsx`) is open to the whole office team. A line says
  who it is for and may sit on a flow step. It can be the team's or **Just for me**, and keeps a
  history and a count of presses, so the most used come first.
- **Blanks** (`quickReplies/blanks.ts`, v2.5389): `{first}`, `{me}`, `{address}`, `{job}`,
  `{minutes}`, `{window}`, `{back day}`, `{back time}`, `{day}`, `{tech}`, `{link}`, `{amount}` and,
  since v2.5628, `{bill}`, the pay page of the job's newest bill through Stripe. `{thing}` and
  `{found}` are the person's to type before it sends.
- **The phone** (v2.5450, v2.5573): six lines can be big buttons on a tech's Job Mode, each with
  a name (`quick_replies.phone_name`) and its Spanish words (`text_es`).
- **What ships**: two customer lines, **On my way** and **I'm here**
  (`20261016020000_on_my_way.sql`). Everything else is what the office has typed in since.
- **The Reply book** on the Bid Board is a second library: wording an estimator copies into an
  outside email, signed with the copier's name (guide *reuse a reply the team has already
  written*). It is not reached from the reply box.

**What keeps it from feeling like hotkeys:** no key opens a line; a new office hire finds two
lines; and the guide *edit the quick replies* says to open a thread from **GC projects**, files
itself under Bids & Estimating, and has no word for *macro*, *template* or *canned*.

### A step's line is also what the app sends

A line on a step is not only a chip. `stepLine` in `quickReplies/kernel.ts` picks the team's most
used line on a step, and two things send that line:

- **Tell the customer** (v2.5593, v2.5627): a booking, an estimate, and a Pipeline move to
  Working, Ready to Bill or Billed. With no team line on the step it sends the app's own words
  (`tellCustomer.ts` → `DEFAULT_LINES`).
- **The morning run** (v2.5407, the flows' `nudge`): Approved a day after the estimate, and Paid
  on the bill's pay-by day, while the step is set to Offers or Sends. The run fills no blanks yet,
  so a line with a blank waits (#124's PR 4).

A job's strip also leads with the step's lines under **For this stage** (v2.5629). So a starter
line goes on a step only where it is that step's own message. Every other one sits on no step.

## The name

**Keep Quick replies.** It is already the name on the button, in the editor, in two guides and in
the Glossary. *Macro* is a tech word a new office hire may not know. In help-desk software a macro
also *does* things, such as sending and moving a ticket. The app has that part already as **Tell
the customer** on a move. Quick replies are the words; Tell the customer is the act.

The guide takes *macro*, *canned reply*, *template*, *saved reply*, *shortcut* and *hotkey* as
keywords, so Help's search finds it under any of them.

## Three ways to reach a line by keyboard

Each is drawn in the mock-up.

- **A. A / list in the box.** Typing `/` at the start of the box, or after a space or a line
  break, opens a short list under the box: the customer's lines, read as they would go, narrowed
  by the words typed after the `/`. **↑ ↓** pick, **Enter** or **Tab** fills, **Escape** closes,
  and a space straight after the `/` closes it too, so *1/2 inch* and *and/or* never open it. The
  pick replaces the `/` and what followed it; the rest of the box stays. A blank the app cannot
  fill is lit, and the box waits, as a press does today. A pick counts as a press.
- **B. A key that opens Find a reply.** **Ctrl + /** (**⌘ /** on a Mac) opens Find a reply with its
  narrow box ready to type in. Nothing new to learn on the screen, but the window covers the
  thread, and one more key to remember.
- **C. A shortcut per line.** Each line can carry one short word, `/bill`, `/late`, `/photo`, set
  in the editor. In the / list a shortcut that matches exactly comes first, so `/bill` then Enter
  sends the hand straight there. It needs A.

**Recommendation: A with C.** The list is where the person is already typing, and the shortcut
makes the common lines two keys. B costs little, so it can ride along for anyone who would
rather have the window. On a phone the `/` key sits on the second keyboard page, so the strip
stays the phone's way in. The list works there too and draws above the keyboard.

## The starter set

Eleven customer lines, for the steps the app has no words for and the everyday questions. Each
is the team's, in plain words, with blanks the app fills. **The wording is the owner's to set**
before any of it ships.

**Any time, on no step** (they change no automatic send):

| Shortcut | When | The words |
|---|---|---|
| `/gotit` | We can't answer yet | {first}, this is {me} with Click Plumbing. We got your message and will call you back today. |
| `/access` | Before the visit | {first}, is there a gate code, a pet or anything we should know before we come to {address}? |
| `/photo` | We need to see it | {first}, could you text us a photo of {thing}? It helps us bring the right parts. |
| `/late` | Running behind | {first}, we are running behind. The new window is {window}. Sorry for the wait. |
| `/back` | The next visit | {first}, we will be back {back day} at {back time} to finish {job}. |
| `/bill` | They ask for the bill | {first}, here is your bill for {job}. You can pay it here: {bill} |
| `/thanks` | They said yes | Thank you, {first}. We will get {job} on the schedule and text you the day. |
| `/paid` | The payment came in | Thank you, {first}. We got your payment for {job}. |

**On a step** (each is the step's own message):

| Shortcut | Step | The words |
|---|---|---|
| `/found` | What we found | {first}, {tech} found {found}. We will send you a price shortly. |
| `/estimate` | Approved (the reminder a day after the estimate) | {first}, did you get a chance to look at the estimate for {job}? You can open it here: {link} |
| `/remind` | Paid (the reminder on the pay-by day) | {first}, a reminder that {amount} for {job} is still open. You can pay it here: {bill} |

Booked, Working, Done and Billed get no starter line, so a booking or a move texts exactly what
it texts today. The repo cannot say which lines the office has saved since the app shipped, so
PR 4 reads prod first: a starter line that repeats a saved one is left out, and a step that
already has a team line keeps it. The **Review asked** step gets no line: there is no blank for a
review link yet, and that is its own small piece if the owner wants it.

**Spanish.** Every line has room for its Spanish words (`text_es`). The app's own words carry
theirs. The owner's call is whether the build drafts Spanish for a speaker's read or leaves them
empty until someone writes them.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The box | `reply/ReplyBox.tsx` (the textarea, `boxPlaceholder` in `messages/compose.ts`) | the / list under the textarea, the placeholder's *type / for a quick reply* |
| The matching | `qrGroups`, `qrMarks`, `qrOrder` in `quickReplies/kernel.ts`; `FilledLine` | `quickReplies/slash.ts`: the query from the text and the caret, the matches in order, the box's words after a pick |
| A press | `quick.press` through `quickRepliesIo.ts` (`quick_reply_uses`) | none: a pick is a press |
| Shortcuts | `phone_name` is a phone button's label, free text up to 60 characters | `quick_replies.shortcut`: one lowercase word, unique among a person's visible lines, set through `edit_quick_reply` |
| The starter lines | the insert pattern of `20261016020000_on_my_way.sql` (a team line with its `added` version, nothing inserted twice) | one migration with the lines the owner approves |
| The guide | `src/content/help/edit-the-quick-replies.md` | the Messages page as the door, the Office category, the keywords, a **Type / in the box** section |

## The plan

1. **The guide's door** (XS, words only): *edit the quick replies* opens from the Messages page
   and the job's box, sits under Office, and takes the keywords above.
2. **The / list** (S): `slash.ts` with its tests, the list in `ReplyBox`, a smoke for open,
   narrow, pick, Escape and the *1/2 inch* case. The guide gains its section.
3. **A shortcut per line** (XS): the column and its check, the editor's field, the list's
   exact match first. If the owner picks A alone, this PR is dropped.
4. **The starter lines** (XS): one migration, the owner's words, the eight any-time lines and the
   three step lines, after the owner has read them. B rides in PR 2 if the owner wants it.

## How to verify

- PR 2: on the dev server, open a customer's thread on the Messages page, type `/bi`, pick with
  Enter, and read the box filled with the bill's pay page; type `1/2 inch` and see no list; press
  Escape with the list open and see the `/` kept as typed. Nothing sends in any of these.
- PR 4: the strip on a Ready to Bill job still leads with the app's Done words; a Pipeline move
  to Billed with the step on Asks still offers the app's Billed words; the Paid step's line is
  `/remind` and the morning summary keeps it back while its blanks are unfilled.

## The owner's calls

1. **The shortcut**: A, A with C (the recommendation), or B.
2. **The starter lines**: their words, which of the eleven to keep, and whether *Click Plumbing*
   is the name to sign with.
3. **The three step lines**: seed them with the rest, or hold them until the morning run can
   fill blanks (#124's PR 4).
4. **Spanish**: drafted for a speaker's read, or left empty.
5. **The Reply book**: left as the estimators' copy-and-paste book, or folded into quick replies
   later.
