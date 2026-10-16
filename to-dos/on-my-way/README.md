---
name: "On my way and I'm here: one press that clocks the drive and texts the customer"
number: 112
group: close
status: BUILT and LIVE 2026-10-16 — the plan #5772, the build #5773 (v2.5573), migration 20261016020000 on prod with its two seeded lines, the types regen PR; left: the owner's live walk
summary: >
  Job Mode's big green button becomes On my way. One press clocks the tech in on the next job as
  on the way and texts the customer the office's On my way line, with the minutes guessed from the
  drive, after the tech reads the text in the same orange box Message the customer uses. While the
  tech is on the way the button reads I'm here: one press stamps the arrival on the clock session
  and, when the customer can be texted, offers the I'm here line first. The two stamps on the
  session, travel_started_at and arrived_at, give the office an honest drive time per visit for
  the first time. The office owns both lines in the quick replies editor, where a new Big button
  picker says which line each press sends.
next: The owner's live walk on his phone with a test job whose customer is his own number (On my way, the text, I'm here), then the follow-ons below as asked; delete the folder after the walk.
size: M (one migration with two small functions, one kernel, two sheets, the card's wiring, the editor's picker, two guides)
blocker: none
opinion: build it as drawn; the sheet is the message sheet the owner already loves, pointed at the day's main press.
mockup: to-dos/on-my-way/mockup.html
---

# On my way and I'm here

## The ask

The owner, 2026-10-16, with a screenshot of Housecall Pro's job screen (an **Appointment** card,
then an **Assigned** card with two round buttons, **On my way** and **Start my time**):

> We have a great tool in place in Messages where a user can text a customer and see a preview
> before it is sent. I love this. I think we can extend this tool to technicians where they could
> send notices they are on their way and pre-configured messages that reduce the risk of them
> misspelling or saying the wrong thing.
>
> In Housecall Pro this button is offered on their dashboard, where they can click the button and
> it will both change their clock session to traveling to the customer as well as text the customer
> they are on their way. For us, we can build this with a confirmation modal that shows the text
> before it is sent and maybe even offer the tech the tools to modify it. I think that the tech
> should also be offered a button for "I'm here" for the customer, that could switch their focus
> away from travel and that they are on site.
>
> Can you think deeply and holistically about how we could offer this, perhaps we only offer it in
> Job Mode?

## What is already there

- **Message the customer** on Job Mode (v2.5449, on since v2.5505): a quiet door under the big
  buttons. The sheet lists the lines the office put on the phone, fills each for this job, shows it
  in the customer's orange box, and sends through `quo-send`'s tech path, which makes the text from
  the line and the record so no free text leaves the phone. Its **On my way** line already exists:
  *Dana, this is Luis with Click Plumbing. I am on my way, about {minutes} minutes out.* The tech
  types the minutes.
- **The clock** knows nothing of travel. A `clock_sessions` row has the clock-in and clock-out
  instants and a location for each, and nothing between. The Job Summary's *Travel on Days* waits
  on exactly this (`to-dos/job-summary-follow-ups.md`, item 4): no per-session start of the drive,
  so no honest windshield figure.
- **The card's advance** is the green button: **Start First Job** before the first clock-in,
  **Next Job** after, **Switch to Scheduled Job** off schedule. Each opens *Where to next?*, a
  modal with a notes box and the day's still-open jobs, and clocks the tech out of one job and in
  on the next through `applyUpdateFocusDirect`.
- **The drive** has a kernel: `jobTravelEstimate.ts` (straight line × 1.3 at 35 mph, the Day
  view's gaps) and a routed answer in the `driving-distance` edge function (the Routes API, cached
  30 days), which only office roles and estimators may call today. The job's point comes from
  `address_geocodes`, which only the map's roles read today.

## The decision

**Job Mode only.** The press is the field's; the office clocks in from the strip and texts from the
thread.

**The big green button becomes On my way.** Wherever the card offers an advance to a scheduled job
today (Start First Job, Next Job, Switch to Scheduled Job, a tap on a rail row), the press is
**On my way** and opens one sheet, full screen on a phone like Message the customer:

1. **Where to** — the day's still-open jobs, the suggested next one picked, exactly as *Where to
   next?* listed them. One candidate reads as a line, not a list.
2. **The text** — the office's On my way line filled for this customer in the orange box, under
   *This is what Dana gets.* The minutes come filled: the phone's GPS to the job's point, straight
   line × 1.3 at 35 mph, rounded **up** to the next five, so *about 20 minutes* arrives early, never
   late. A stepper (− 5 · number · + 5) and the field change it. No GPS, or the job's address never
   geocoded: the field is empty and Send waits, as the sheet does today.
3. **What happens** — two rows the press will do: *Clocks you in on 512 · Whitfield water heater as
   on the way.* and *Texts Dana from the company number. Her answer comes back to you.* When the
   text cannot go, the second row says why instead and nothing is promised: *No text: this job has
   no customer yet* · *No text: texts are off in Settings* · *No text: the office has no On my way
   line on the phone* · *No text: your role does not text from the phone*. A number the customer
   does not have is found on the send, and the clock-in stands when the text is refused.
4. **The footer** — the primary press says exactly what it will do: **On my way, text Dana**, or
   **On my way** alone when no text can go. A quiet second press, **Clock in, no text**, for the
   customer who does not want a text. **Start here instead** when the tech is already at the door:
   it clocks in as arrived, with no drive. **Done for the day** stays where the old modal had it,
   when a session is open and the tech may clock out.

The press clocks first, then texts: the session is the tech's pay, the text is a courtesy. The new
session carries `travel_started_at = now()` and the note *On my way to 512 · Whitfield water
heater, about 20 min*, so the office's strip reads true without the tech typing. When the phone
knows it is already at the job (under 150 m, the Day view's same-site rule) the sheet says *You are
already there* and the primary press becomes **I'm here**: a drive that is not one is never texted.
When the guessed arrival passes the end of the block's window, a quiet line says so and points at
**Running late** under Message the customer, which already slides the board.

**While on the way, the button reads I'm here.** The header says *On the way to 512 · left
10:12 · 14 min*. The press stamps `arrived_at = now()` on the open session with the phone's
location, and the header turns to *On site since 10:31 · 19 min drive*. When the customer can be
texted, a small sheet shows the office's I'm here line, *Dana, this is Luis with Click Plumbing. I am
here at 1208 Mesquite Ln.*, with **I'm here, text Dana** and **I'm here, no text**. When no text can
go, the stamp lands on the press and a toast says *You are on site. 19 min on the road.* The
arrival text is a choice each time: a homeowner at the door needs no text, a property manager
across town does.

**The office owns both lines.** `quick_replies.phone_press` marks one live team line as the On my
way line and one as the I'm here line (one each, a partial unique index). The editor's phone block
gains a **Big button on Job Mode** picker: none · On my way · I'm here. The migration marks the
first phone line that uses `{minutes}` as On my way and adds an I'm here line when none holds the
press, so day one works with no office step; the words stay the office's to change.

**The stamps are the data.** `travel_started_at` and `arrived_at` on `clock_sessions` (with
`arrived_lat`, `arrived_lng`, `arrived_location_source` beside the clock-in's) make every visit's
drive honest: the time from the press to the door. Nothing else about hours, approval or pay
changes; a session is still one row from clock-in to clock-out.

## Alternatives weighed

- **A. A quiet door beside Message the customer.** Rejected: it is the day's main press, and the
  owner's screenshot puts it big. A quiet door gets missed and the drive goes unmarked.
- **B. Housecall Pro's two round buttons, On my way and Start my time, with no sheet.** Rejected:
  here the drive is paid time, so the press must clock the tech in, and the owner asked for the
  preview. Two buttons would split one act.
- **C. Text on every Next Job with no sheet.** Rejected: no preview, the wrong minutes, and a text
  the tech never read.
- **D. The big button becomes On my way; one sheet does the destination, the preview and both
  acts; I'm here takes its place while on the way.** Picked.
- **E. A separate travel session, clocked out at the door and a work session clocked in.**
  Rejected: two rows a visit would break every hours, approval and payroll reader. Two instants on
  one row keep every reader as it is.

## Is this the best we can do? The second pass

The first draft was D as drawn above. Reading it back against the owner's three words, *deeply*,
*holistically* and *modify*, these changed:

1. **The minutes were typed.** Now the app guesses them from the phone and the job's point and the
   tech only corrects. The straight line rounds up, so the guess errs early. A routed guess through
   `driving-distance` is one gate change away and is the first follow-on.
2. **I'm here always texted.** Now the arrival stamp happens on every press, and the text is a
   choice on the sheet, since the stamp is the data and the text is a courtesy.
3. **The notes box stayed.** Now the app writes the note, *On my way to 512 · Whitfield water
   heater, about 20 min*, which is truer than what a tech types in a truck and reads right on the
   office's strip.
4. **The window was ignored.** Now a guessed arrival past the block's end gets one quiet line that
   points at Running late, which already exists and already slides the board.
5. **Every advance became a drive.** Now the same-site rule and **Start here instead** keep a text
   from going out for a drive that is not one.
6. **The lines were found by their words.** Now a column names which line each press sends, the
   editor shows it, and the migration seeds both, so nothing is hard-coded in the app and the
   office can reword either line.
7. **The stamps were the press's alone.** Now they are named as what unblocks *Travel on Days*,
   the office's *On the way / On site* line and the Day view's travel gaps, each a follow-on below.

## Where it plugs in

- `src/components/jobMode/DashboardJobModeCard.tsx` — the right button and the header; the sheets
  mount here. `jobModePickCurrentNext.ts` keeps its states; the leg (before · on the way · on
  site) comes from the open session's two stamps in a new kernel.
- `src/contexts/UpdateFocusOpenerBridgeContext.tsx` and `ClockInOutButton.tsx` — the clock-in
  takes `travel: 'on-the-way' | 'on-site'` and writes the stamp with the row.
- `src/lib/jobModeMessageCustomerIo.ts` — the send is the sheet's `send` with
  `fills: { minutes }`; `quo-send`'s tech path is untouched.
- `src/lib/quickReplies/` and `QuickRepliesEditorLine.tsx` — `phonePress` on the line and the
  picker; `set_quick_reply_press(uuid, text)` saves it.
- `address_geocodes` — the job's point, open to every signed-in user since v2.3131; the first cut
  gave it a definer, `address_point`, until the SQL bed showed the table was already open.
- `src/lib/jobTravelEstimate.ts` and `resolveClockPunchCoordinates.ts` — the guess and the phone's
  point, GPS only; an IP point is too coarse to text.

## The PR train

1. **This to-do** (the plan and the mock-up).
2. **The feature**: migration `20261016020000_on_my_way.sql` (the five columns, `phone_press`,
   `set_quick_reply_press`, the seeds), the kernel and its test, the two sheets, the card, the editor's
   picker, the two guides, the release note. The card reads the stamps fail-soft, so the client may
   deploy before the push.
3. **The types**: regenerate `database.ts` and the dev-mcp catalog after the push.

Follow-ons, each its own PR when asked:

- The office's strip and Who's where read the leg: *On the way to 512 · 14 min* / *On site since
  10:31*.
- Job activity's clock line says *drove 19 min, on site 10:31*.
- *Travel on Days* (`job-summary-follow-ups.md`, item 4) from `arrived_at − travel_started_at`.
- The routed guess: open `driving-distance` to the tech roles and read it when it answers in time.
- The customer's page says *Luis is on the way, about 20 min* while the leg is on the way.

## How to verify

Live, as a helper or primary in Job Mode on a phone, with a test job whose customer is the owner's
own number:

1. Before the first clock-in the green button reads **On my way**. Press it: the sheet shows the
   job, the text with the minutes filled, the two rows, and **On my way, text Dana**.
2. Press it. The header reads *On the way to … · left …*, the button reads **I'm here**, and the
   owner's phone gets the text. The office's thread shows the line in orange, tied to the job.
3. Press **I'm here**: the small sheet, then **I'm here, text Dana**. The header reads *On site
   since …* with the drive, the button is back to **Next Job** or **Wrap Up Day**.
4. In the office, the session's row shows the two stamps (People → Hours, the day editor), and the
   quick replies editor shows the picker on both lines.
5. Negative: a job with no customer reads *No text: this job has no customer yet* and clocks in
   alone; with texts off, the same shape with the switch's words.
