---
name: "The job window on a phone"
number: 355
group: waiting
status: asked 2026-11-14 · measured on the dev server at 375 px the same day · drawn three ways · the owner's *is this the best we can do?* the same day · pass 2 reads nineteen days of presses on the window from prod and redraws the top from them · waiting on the owner's three picks before the first PR
summary: >
  The owner opened a job on his iPhone and did not like how it reads: the tab row wraps onto two
  lines, the top is eight small icons, and the Job tab runs six and a half screens before the bar.
  Measured at 375 px, the only presses a thumb lands on without care are the bar's three and Paint a
  map; everything else is 20 to 31 px. Three directions, each built on the last: A tidies the top
  (one tab strip that scrolls, a title with a quiet line, three named 44 px presses with the rest
  under More, money and job accounts folded to one line each); B puts the job on one screen in the
  order a phone needs (Where, Photos, Who, What's happening, the thread) with the rest folded under counted headings;
  C gives the phone its own window shaped by role. Pass 2 read nineteen days of presses on the
  window from prod: the crew's bar is the live part, six of the eight icons were never pressed, and
  no office role pressed the window's chrome at all. So the name comes first with ⋯ and ✕ fixed at
  the right, every door goes behind ⋯, C waits, and three questions are left for the owner.
next: The owner's three picks (in the mock-up and below). Then A as one PR, with its release note, fragment, the tabs added to the press count and the guide's phone section rewritten.
size: L as a train (S for A · M for B · L for C); the first step is S
blocker: The owner's three picks.
opinion: build A now — one day, nothing below the top moves, it answers his first complaint, and it starts counting the tabs; then B, which is the one that makes the window easy to follow
mockup: job-window-phone-directions.html
---

# The job window on a phone (#355)

## The ask, in the owner's words

2026-11-14, from a screenshot of the job window on his iPhone: "I don't love a lot of things,
including how the top line wraps into two and throughout it it's not easy to follow and the
buttons aren't easy to press."

The same day, on pass 1: "Is this the best we can do?"

On pass 2: "I still want to see the phone number and I want to see the email so that a user can
quickly identify if they're calling the right person or if they're seeing the right email." So the
Who section never hides them behind a bare Call or Email press: the number is the Call press and
the address is the Email press, each written out.

Also on pass 2, the section's name: *the thread* was renamed *Communication with customer* on his
word and put back on his next: "Actually, I don't like the new name. Bring it back." It stays
**the thread**.

Also on pass 2: "As a user scrolls down, I would like for the header to scroll up and away out of
the page so the user can see more." So the title row and the tab strip are part of the page that
scrolls, not a fixed band: a flick gives the whole screen to the job, a small ✕ floats at the
corner the whole way down, and a scroll back up brings the tabs back. The bar at the foot stays.

Also on pass 2: "I don't like how the titles blend in the way they do. I think where, who, now
should all be more defined as titles or sections." So Where, Who, What's happening, the thread and More on this
job are sections with a title of their own, in the body's own type and weight with a band between
them, not the small grey labels pass 2 drew.

Also on pass 2: "No target yet is unclear. What kind of target are we referring to?" It is the
job's **target in hours** (punch list #255, v2.6585, `JobTargetLine` over `jobTargetWords` in
`src/lib/jobs/jobTarget.ts`): how many hours the job should take, set by the leader or the office
with a reason, else read from the labor budget, and the crew's hours are counted against it. The
live line says *No target yet* when there is none, and the owner himself could not tell what it
meant, so the mock-up now reads **Hours target · none yet** with *How many hours the job should
take* under it and the press **Set the hours**, and PR A renames the live line's empty words the
same way (the kernel's `head`, `detail` and `press`, on every screen, since the words are the same
on a desk).

Also on pass 2: "Instead of share with a supply house, should we say request job account from
supply house?", then "Or supply house colon request job account.", and last "Instead of supply house
colon request job account, make it 'add job account'." The press requests a job account at a supply
house, and the packet is the request. The ⋯ sheet's row reads **Add job account**, with the quiet
word *none yet*, or *Ferguson · Nov 3* once one has gone out. PR A renames the live press the same
way wherever it is named: the icon's label and tip on the Job tab, the window's own title, the
legend's row, the Dispatch errand's *Open Share with supply house* press, and the guide's title
(*add a job account at a supply house*, with the old slug kept in `helpGuideFormerSlugs.ts`). The press count keeps its old row's
name until then, so the before and after can be told apart.

Also on pass 2: "Instead of write up a change, make the words make change order." The press opens the
Quick Estimate write-up on this job, which is the change order, and the guide already calls it one
(*write up a change order from the field*). The ⋯ sheet's row reads **Make change order**, and PR A
renames the live press the same way wherever it is named: the icon's label and tip on the Job tab,
the Settings switch *Write up a change from the field*, the field card's press under the day's list,
the legend's row and the guides' words for the press. The guide slug stays.

Also on pass 2: "Instead of send the paid-in-full email, it should say email the paid-in-full report."
The press sends the Customer paid report by hand, to yourself as a test or to one chosen person, and
on a part-paid job the same report carries a payment-progress banner. The ⋯ sheet's row reads
**Email the paid-in-full report**, and PR A renames the live press the same way: the envelope's label
and tip on the Job tab, the modal's title and the guide's words for the press.

Also on pass 2: "When a job has photos, I would like for them to be presented as a banner where a
user can add a photo as the first icon and then flip through the photos as additional icons." So
the photos strip (punch list #164, `JobPhotosStrip`: a *Photos · N* door, three thumbnails and a
*+ N* tile in a grid) becomes a **banner**: one row of 72 px tiles that flicks sideways, **Add a
photo** the first tile, then every photo newest first with its day on it. A tap on a photo opens
the viewer at that photo; the first tile opens the camera on a phone and the picker on a desk, the
same door `JobPhotosWindow` draws first. A sits it where the strip is today; B gives it a section of
its own, **Photos**, right after Where. A job with no photos draws the Add tile alone with *No
photos yet* beside it.

Also on pass 2: "What does the now section mean to represent?" and "I don't love this section only
because it does not feel intuitive to a user. How can we make it more intuitive to a user?" *Now*
was this card's own word, and its three cards each asked the reader to know what they were. So the
section is **What's happening**, and it is three labelled rows, each a plain label at the left and
its answer at the right: **Next on site** (the day, the hours on their own line, who is on it), **Waiting on** (what the
job waits for and from whom, in a sentence: *The office, to bill it. Nothing has happened for 6
days.*, which is the Pipeline row's line and the bar's press said the other way round), and **Hours**
(*No target set*, what the target is, and *Set the hours* as blue words at the end of the sentence). The label says what the answer is
before the eye reaches it, the way a form reads, and the Waiting on row names the person as well
as the gap. The crew's window (C) drops the Hours row, since the crew do not set it.

Also on pass 2, on the Next on site row: "I always want the eight a.m. to twelve p.m. to be on the
second line." So the row is three lines, never one that wraps where it likes: the day (*Saturday,
November 14*), then the hours on a line of their own (*8:00 AM – 12:00 PM*), then who is on it. The
kernel hands the three lines apart; the screen never joins them with a dot.

Also on pass 2: "Now I need your help to look at the thread section. I don't totally love how it
looks." Three things were off in the drawing: two titles in a row (*The thread*, then a card called
*Where it stands*); a feed that mixed the customer's text with a helper's Arrived stamp and an office
note, three shapes in three rows; and a summary that said the last word was Robert's while the feed
showed the customer's text from yesterday. So the section takes the shape of What's happening: three
labelled rows that are the live summary's own lines (`threadSummary.ts`: **Last word** *Theirs, by
text, yesterday · Nobody has answered yet*, **They promised**, **We owe them**), then the newest two
messages with the customer as bubbles, theirs at the left on amber and ours at the right, each with
who, the channel and when, then *Open the thread · 56 ›*. Crew stamps and office notes are not
messages; they stay under Work and time and the Activity door. Text and Email as bare presses are gone from here; Who already carries them beside the number and
the address, and the thread's acts are the rows' blue words and the bar (pass 2x below).

Also on pass 2, on the photo banner: "Moving the photos five open all to the right hand side of the
photos title line is the right move." So the count and the door sit at the right end of the section's
title line, *Photos ····· 5 open all ›*, and the banner starts straight under it with no label row of
its own. In A, which has no section titles, the label line *Photos · 5* carries *open all ›* at its
right the same way.

Also on pass 2, on the three marks beside the customer's name (🌐 the customer's portal, ▲
Customer Files, 🖼 Customer Photos, the live window's link icons): "How can we make those easier to
click for someone on mobile?" A mark is hard to hit and harder to name, so each becomes a 44 px
press with its word, in one row under the number and the address: **Portal**, **Files**, **Photos**.
The rule is the window's already: blue when the link is set and it opens; grey with *set* when it is
missing and the press opens the add-a-link box for the roles that may, and is not drawn for the
roles that may not. The portal press is office-only, as the globe is. Photos and the banner's *open
all ›* open the same folder; one of them can go once the count says which is pressed.

Also on pass 2: "I would like to add a copy button to the right of the text button for a phone
number where a user can copy the phone number as well." So the number's row is the number (calls),
Text, then Copy, the same ⧉ square the address has, and the live window gains a *Copy the phone
number* press beside the number on every screen: the clipboard with a *Phone number copied* toast,
or the copy-from window when the app cannot reach the clipboard, as `copyEmail` does today.

Also on pass 2: "In the edit job modal I think we should show the street view banner." On a desk the
Street View banner is the window's shared header on every tab (v2.1676), the Edit tab included; on a
phone it waits behind a *street view ▸* link (`streetViewShown` in `DetailJobModal`), so the Edit
tab on his iPhone shows no picture of the house. So the banner draws on a phone as it does on a desk:
in A under the tab strip on every tab, Edit included, the address pinned on it, scrolling away with
the header; in B at the top of Where. The fold goes. The two places that open the Edit form alone,
without the window (the customer's Agreements card and Dispatch Mode's schedule), have no header and
no banner today; that stays as it is unless he asks.

Also on pass 2: "I think we should move the paint a map plus button to the center, instead of to the
left." So the *＋ Paint a map* press is centred, in A under the maps as today and in B under the Where
rows as a 40 px press rather than a quiet line, and PR A centres the live press's words under
`phonePane` (and drops its box, next note).

Also on pass 2: "Regarding their word, no day of theirs is written down, I don't think this has a lot
of context and could be better presented." The live card's second and third lines are *Their word*
(the customer's newest written promise whose day has not passed: a check by Friday, an answer by
Monday, a day given on the call) and *Our word* (the newest open thing we owe them: a call back, a
price, a date). Empty, they read *No day of theirs is written down* and *Nothing we owe is written
down*, which name the mechanism, not the meaning. So the rows are **They promised** · *Nothing yet*,
with *A day they give for a payment or an answer lands here, from the call or text it was said in*
under it, and **We owe them** · *Nothing open*, with *A call back, a price or a date we said we would
give*. Filled, they read *They promised · A check by Friday · said Tuesday on the call* and *We owe
them · A price for the trim change · marked Nov 11*. PR B renames `SUMMARY_WORDS.theirs` and `.ours`
and the two empty sentences in `threadSummary.ts`, on every screen, since the desk's card reads the
same lines.

Also on pass 2: "If we're going to offer that, I need to also offer a way for the user to hit a
button to update it." So each promise row carries its press, under its words, 44 px, the same door
Messages already has for it. **They promised** · *Write down their day*: opens the customer's thread at
their newest message with the day writer (the *A day was heard … say what it is* press of Follow up),
or, with no message to pin it to, the Log a call box, since a day said on the phone is written on the
call. Filled, the press reads *Change their day*. **We owe them** · *We owe them…*: opens the thread at
the reply box with the owed marker (*Mark it*), as the guide *keep track of what we owe someone*
shows; filled, the row's press reads *Change what we owe* and a second, *Mark it done*, which opens
the team-note box. Nothing new is written anywhere; the rows are doors to the writers Messages has.

Also on pass 2: "Set the hours should not be in a blue box, it should just be a blue text at the end
of 'against it' period." So the Hours row has no press box: *Set the hours* is blue words at the end of
its sentence, *… The crew's hours count against it. Set the hours*, the whole row the tap target at 44
px.

Also on pass 2: "Just like how we just changed Set the hours, let's also change this text and button.
Maybe we should offer more simplified text." So the two promise rows read the same way as Hours, one
short sentence with the door as blue words at its end: **They promised** · *Nothing yet* · *A day they
gave for a payment or an answer. Write it down*, and **We owe them** · *Nothing open* · *A call, a
price or a date we said we would give. Mark it*. Filled, the blue words read *Change it* on both, and
We owe them adds *Done* after it. The doors are the ones above.

Also on pass 2: "Should we make 'Theirs, by text, yesterday · Nobody has answered yet.' as well?"
Yes: **Last word** · *Theirs, by text, yesterday* · *Nobody has answered yet. Reply*, with *Reply* the
blue words that open the thread at the reply box on the last word's channel. The boxed *Reply by text*
and *Note* presses under the bubbles go: Reply lives on the row, and Note is on the bar at the foot of
every screen already. The thread's acts are then the three rows' blue words and the bar.

Also on pass 2: "Should we make the following actionable as well: 'Job total $56,000 · nothing billed
· accounts none yet'?" Yes, and the line held two different acts, so it is two rows. **Money** · *Job
total $56,000 · nothing billed yet. Bill it*, where *Bill it* is the job's next money move in blue, the
same verb the bar carries (`tabbedJobWindowBar`: Bill it, Send bill…, Mark paid, or nothing when no
money move is ready), and the row opens the Bill tab. **Job accounts** · *None yet. Add job account*,
the blue words opening the supply-house request, and the row the accounts sheet; with accounts it
reads *Ferguson · Nov 3. Add another*. A does the same to its two one-liners, since they are the same
rows one PR earlier.

Also on pass 2, from a crop of the title row: "Should we move this button here to offer more space
for the title and stage?", the ⋯ drawn under the ✕. Yes: the two 44 px presses stack at the right (the order swapped on his next note below), so the name and the status chip have the whole
first line and a long name wraps later. The floating ✕ on scroll is unchanged.

Also on pass 2, from a crop of What's happening: "Should we make these actionable as well?" Yes.
**Next on site** ends in *Open the calendar*, the job's calendar sheet where the block is moved or
another added (the ⋯ sheet's row, so the row keeps its `data-navtrack` name); with no block it reads
*Nothing scheduled. Open the calendar*. **Waiting on** ends in the job's next move itself, *Bill it*,
the bar's verb from `tabbedJobWindowBar`, so the sentence and the press agree; when the move is
someone else's (*The customer, to pay*) it ends in the nudge the Pipeline row offers, *Remind them*.
Every row of What's happening and the thread now ends the same way.

Also on pass 2, from a crop of Paint a map: "We should remove the border around this and push up the
words." So the dashed box goes: *＋ Paint a map* is centred blue words straight under the painted
maps, with the row above's gap closed, the same shape as every other act on the screen. The tap
target stays 40 px tall around the words.

Also on pass 2, from a crop of Waiting on: "What if we made the 'bill it' text in the top right
clickable, removing the need for the Bill it in the bottom left?" Yes: the verb is already in the
headline, so it is the door. The row reads **Waiting on** · *The office, to* **bill it** · *Nothing has
happened for 6 days.*, the blue words inside the sentence and nothing after it. The rule for the
rows: when the act is already a word of the headline, that word is the door; otherwise the door is
the blue words at the end. *The customer, to* **pay** then ends in *Remind them* at the end, since
paying is theirs and the nudge is ours.

Also on pass 2: "Let's move the ••• at the top right to the top right above the X and have the X
start its float just below it." So the stack is ⋯ on the name's line and ✕ under it on the quiet
line, and the floating ✕ on scroll sits where that ✕ was, one press down from the corner, so it
never covers the first line of whatever scrolls under it.

## What the phone draws today, measured

Measured on the dev server at the 375 × 812 preset on 2026-11-14, on the ZZ test job, signed in
as the dev. The window is `JobWindowModal` with `DetailJobModal` in pane mode as its Job tab
(`docs/JOBS_MODALS_ARCHITECTURE.md`).

| Part | Measured | The trouble |
|---|---|---|
| The tab row | Seven pills, the `?` and the `✕`, on two lines, 78 px tall; each pill 26 px tall | The second line is the first thing he named |
| The title block | 100 px: the name, the kind chip, the status chip; under it the number pill, *money story →* and six icons, then two more icons on a third line | Eight presses of 20 to 31 px, none named |
| The Job tab | 4,350 px before the bar, six and a half screens; the activity feed scrolls inside the scroll | Not easy to follow |
| Presses a thumb lands on | The bar's three (48 px), Paint a map (40 px), the photo tile | Everything else is under 32 px |

The order on the Job tab today: title and icons, the address, the painted maps, the photos strip,
the customer with phone and email pills, three money tiles, the job accounts chips, the scheduled
block, the target, Their journey, Where it stands, Questions on this job, the activity feed with
its filters and composer, the two dates, the status rail, plans and papers, the team, start and
last work, reports, schedule and recorded time, the costs card, specific work, job total, payments,
invoices.

## What people press on this window, read from prod (pass 2)

Every press on the window's icon row and its bar has been counted since 2026-10-26 (`ui_nav_clicks`,
v2.5904, `data-navtrack="job-window"`), on every screen size and every role; the tabs are not
counted. Read as the dev on 2026-11-14 through the dev seat, nineteen days:

| Press | Who | Presses |
|---|---|---|
| Arrived and Leaving | One superintendent, on his phone, from the Dashboard | 28 |
| Close job detail | Helpers, the superintendent, a sub (14 by one helper on one morning) | 25 |
| Leave report | The superintendent | 3 |
| Note | A sub, the dev account | 3 |
| Share job | The dev account | 3 |
| Open the job calendar | The dev account | 2 |
| Status ▾ | The dev account | 1 |
| Money story, Supply house, Send paid-in-full email (Email the paid-in-full report in A), Send as task, Write up a change (Make change order in A), the trade pill | Nobody | 0 |

So the crew's bar is the live part of the window; the icons are dead weight on a phone (six of
the eight were not pressed once, on any screen, by any role); and no office role pressed the
window's chrome at all in nineteen days, which says the office works it at a desk through the tabs
and the body, which the count does not see. The first PR adds the tabs to the count.

## What each part is for on a phone

| Part | Who reads it, and for what | Order | The press that matters |
|---|---|---|---|
| The tab strip | Everyone: which part of the job. The office moves between Job, Edit and Bill; a crew lead between Job, Materials and Documents | The frame | The tab, 40 px; the ✕ |
| Name, number, status | Everyone: the right job, and where it stands | 1 | None |
| The address and the painted map | The crew lead: where to drive and park. The office: which house | 2 (crew) · 3 (office) | Directions, the map row |
| The customer, with the number and the email written out | The crew lead: who to call at the gate, and that it is the right number. The office: who to text or email, and that it is the right address | 3 (crew) · 2 (office) | The number (calls) · Text · Copy · the address (emails) · Copy · Portal · Files · Photos |
| What's happening: Next on site, Waiting on, Hours | Everyone: when someone is next there, what the job waits on and from whom, how many hours it should take | 4 | Set the hours |
| Where it stands and the thread | The office: has the customer answered, what went out last | 5 (office) · folded (crew) | Note · Text · Email |
| Today's work: the open stage, its checklist, plans, materials on site | The crew lead: what to do and what is on site | 4 (crew) · folded (office) | The checklist, Materials on site |
| Money tiles and job accounts | The office, rarely on a phone; the Bill tab holds the work | Folded | One line that opens Bill |
| Photos, as a banner | Everyone: what the place looks like now, and the door to add the next one | After Where | Add a photo · a photo |
| Questions, Activity, Their journey | Everyone, when looking for something | Folded, with counts | The fold |
| Plans and papers, team, dates, reports, costs, specific work, payments, invoices | The desk's reads; a reference on a phone | Folded, last | The fold |
| The bar | The one press this person needs now | Always on screen | The office: the next verb. The crew: Arrived or Leaving |

## The three directions

The mock-up (`job-window-phone-directions.html`) draws the window as it is today and the three,
each a scrolling 375 px phone. Every name, address and number on it is invented.

**A · The top in the right order** (one PR, the first step). A title row like the desk's since
v2.6539 comes first: the name and the status, a quiet line with the number, the customer and the
kind, and two 44 px presses stacked at the right, ⋯ on the name's line and ✕ under it. The seven tabs run on one line that scrolls
sideways under it, 40 px tall, the active one kept in view, a fade at the edge. The title row and
the strip scroll away with the page; a small ✕ floats at the corner the whole way down, and a
scroll back up brings the tabs back. The icon row is gone: every door is a named 48 px row in the ⋯ sheet (Share and
Calendar first, since they are the two anyone pressed; Add job account with
*none yet*; money story; Email the paid-in-full report; send as a task; Make change order; the ? card last). The three money tiles
and the job accounts chips fold to one line each, each ending in its act as blue words (Bill it, Add job account). The Street View banner draws under the strip on every tab, Edit
included, as on a desk, and the *street view ▸* fold goes. The photos strip becomes the banner: Add a photo
first, then the photos, flicked sideways. The tabs join the press count. Nothing below
moves; the bar is as today.

**B · The job on one screen** (a second PR on A). The Job tab under 640 px reads Where (the
Street View banner first, then the address with a Directions press, the painted map), Who (the customer, then
the phone number and the email address written out, each a 44 px press that calls or emails, with
Text and Copy beside the number and Copy beside the address, then Portal, Files and Photos as presses with their words), What's happening (three labelled rows: Next on site, Waiting on and Hours, each a
plain label, its answer and its act in blue words), then the thread (Last word, They promised and We owe them as labelled rows, the two promise rows
each ending in the blue words that open its writer, the newest two
messages with the customer as bubbles, *Open the thread · 56 ›*; Reply is the Last word row's blue words and Note is the bar's). Each is a section with a title of its own, with a band between
them. Photos is a section of its own right after Where, the banner
under its title. The rest folds under More on this job, each with its count: Questions, Money, Plans
and papers, Work and time, Their journey. With every fold closed the scroll ends near
1,300 px. The desk is untouched.

**C · The crew lead's window** (not recommended now). A `JobWindowPhone` drawn from a kernel that
shapes it by role: the three tabs the role uses and a More ▾ sheet, and for a master tech on the
crew a Job tab that is Where, Who, Today's work (the open stage, its checklist, the plans, materials
on site), Questions, Notes and reports, the photo banner after Where, with no money and the crew's bar. The count says
why it waits: the crew who use the window on a phone today (the superintendent, helpers, a sub)
already get the plain read-only window with Arrived or Leaving · Leave report · Note on its bar,
and that bar is what they press; no master tech has pressed the tabbed window on a phone in
nineteen days. C waits for a master tech who works from a phone, or for the tab count after A.

## The questions for the owner

Pass 1 asked seven. The count answered three (the icons go behind ⋯, the bar stays, C waits) and
the desk's own title row answers one (the kind chip reads on the quiet line). Three are left; the
pick after each is the drawing's own.

1. **A as drawn?** The name first with ⋯ and ✕ at the right, the seven tabs on one line that
   scrolls under it, both scrolling away with the page under a floating ✕, every door in the ⋯
   sheet, money and job accounts as one line each, nothing below moved. *Yes, as the first PR.*
2. **The tabs that do not fit.** A scrolling strip hides the last tab or two until a thumb slides
   it; three tabs and a More ▾ hide them behind a press instead. *Scroll for now, count the tab
   presses for a month, then move the tabs nobody presses on a phone behind More ▾ in B.*
3. **B as the second PR?** Where · Who (the number and the email written out) · Now · the thread
   first, the newest three events shown, the rest folded under counted headings. *Yes, once A has been on phones for a week.*

## Where it plugs in

- `src/components/jobs/JobWindowModal.tsx`: the phone's tab strip (`tabButtonStyle`, the
  `.job-window-tabs` media rule that wraps it, v2.3231) and the `?` and `✕` on it. A draws the
  desk's title row (`!phone` today: name · status · quiet line) on the phone too, first, with ⋯
  and ✕ at its right, hides the pane's own title (`paneTitleHidden`), and has the strip scroll
  under it (`overflowX: auto`, the active tab scrolled into view on change, `data-navtrack` on
  the strip so each tab press is counted). Both move into `.job-window-body`'s scroll on a phone,
  with a floating ✕ over the corner and the strip drawn again at the top when the scroll turns
  upward (a `scroll` listener on the body, the strip `position: sticky` while scrolling up).
- `src/components/jobs/DetailJobModal.tsx`: the `streetViewShown` fold (the banner draws under
  `phonePane` as under a desk, on every tab since the pane is the shared header), the action row (dossier D5, the eight presses with
  `data-navtrack="job-window"`), the phone-pane tiles and `JobAccountsStrip` in the top band
  (D7). A hides the action row under `phonePane` and hands its doors to the window's ⋯ sheet
  (the same handlers and satellite states, which stay in the pane; the sheet's rows keep the
  `data-navtrack` names so the count continues), and folds the tiles and the strip to one line
  each. B reorders the top band and folds the body under `phonePane`.
- `src/components/photos/JobPhotosStrip.tsx` and `src/lib/photos/jobPhotos.ts`: `stripTiles` (three
  thumbnails and a *+ N* tile) becomes the banner's row kernel (Add a photo first, then every photo
  newest first, each with its day), drawn as one `overflowX: auto` row of 72 px tiles on every screen;
  the first tile reuses `JobPhotosWindow`'s add door (the camera for the field roles on a phone, the
  picker at a desk) and the viewer opens at the tapped photo. The *Photos · N* door is the count and *open all ›* at the right of the title line.
- `src/lib/jobs/jobWindowBar.ts`: `jobWindowTiles` stays; A adds a kernel for the one-line money
  words (*Job total $56,000 · nothing billed*) and the ⋯ sheet's rows (which doors, in which
  order, with which quiet word, by role). C adds the role's tabs and the role's bar there.
- `src/components/jobs/JobWindowActionBar.tsx`: unchanged by A and B; C's crew bar is
  `crewJobWindowBar` already drawn for the plain window (punch list #189).
- `src/lib/jobs/jobTarget.ts`: `jobTargetWords`'s empty case reads *No target yet* today; A makes it
  *Hours target · none yet*, *How many hours the job should take. The crew's hours are counted
  against it once it is set.* and **Set the hours**, with its test; the guide that names the line
  (punch list #255) follows.
- The guide `src/content/help/job-window-tabs.md`, *On a phone: the bar at the bottom*, is
  rewritten with A; `src/lib/jobs/jobWindowLegend.ts`'s phone row names the press row.
- No table, migration or edge function in any of the three.

## The plan

1. **A** (S): the title row first with ⋯ and ✕, the strip that scrolls, the ⋯ sheet, money and
   job accounts as one line each, the tabs counted; a kernel for the sheet's rows and the money
   line with tests; a render smoke at 375 px; the guide's phone section; release note and fragment.
2. **B** (M): the phone's top band in Where · Who · Now · the thread order, the folds with counts
   remembered per device (`localStorage`, as the Pipeline's Overview does); a kernel for the fold
   list and its counts; the guide.
3. **C** (L), only when a master tech works from a phone or the tab count says the office's
   phone use is real: `JobWindowPhone`, the role kernel for tabs and bar, the crew lead's Today's
   work.

## How to verify

Open any job from the Pipeline at the 375 px preset (Jobs → Pipeline, Mobile cards on), or on a
phone: the name is the first line with ⋯ and ✕ at its right, the tab row under it is one line
that slides, a flick down takes both off the screen and leaves a floating ✕, a flick up brings
the tabs back, the ⋯ sheet names every door, and the Job tab's first screen reads the address and
the customer. Then `ui_nav_clicks` on prod a week later shows rows named by the tabs. The
ZZ test job `ZZ TEST Riders Walk` has stages, a checklist, plans and an activity feed to scroll.
Then the same window on a desk at 760 px, unchanged.
