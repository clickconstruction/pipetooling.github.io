---
title: run the office day with Quickfill
category: Office
roles: dev, master_technician, assistant
keywords: quickfill, daily, mark up to date, office routine, sections, phone, round, due, rhythm, looked, focus, view, page, switch, groups with work, roller, one at a time, board, groups
order: 10
---
Quickfill is the office's daily runway. It is one page of review sections, each with a button that says "I've looked at this."

Working top to bottom keeps the whole operation reviewed on a rhythm. Nobody has to keep a mental checklist. The dashboard's chase-work nudges live here too, as their own stations. They are **GC weekly review** and **Job follow-ups**. GC means the general contractor. Each has its one-tap card and its own mark button. Lost bids with no reason sit on the **Needs you** station, where Fill them in walks them. The dashboard's **Needs you** card opens the round as the first station, **Today's lines**. It holds your lines first. What waits on the owner sits folded under it. The station's count is your lines only. On a clean day the cards hide but the rituals stay stampable.

On a desktop it's the heart icon in the header. On a phone, you open the ☰ menu on the left. **Quickfill** is the first entry.

## How marking works

Every section ends in three presses. The one that fits the count is lit:

:::example The three presses
{{button:green|Done · 0 open}} &nbsp;— lit when nothing is left. On a station with no count it reads Looked.

{{button:blue|Worked it · 50 left}} &nbsp;— lit when rows are left. It records the count and asks nothing more.

{{button:outline|Not sure what to do}} &nbsp;— always lit. It sends your question to the Dispatch inbox.
:::

Under a station's question sits its **Next line**. It names the first thing to do, like *Lean on TF Harper · $29,323 · 38 days*. The line comes from the station's own rows. A station with nothing to do shows no line.

Press the lit one when you are done with the station. While a station is still counting, Done and Worked it wait and say counting. Not sure opens one line. Say what is unclear, or send it as it is. Then press {{button:blue|Send the question}}. The station is marked, and the owner gets a request that names the station, its count and your words. A question that is already in the Dispatch inbox is not sent twice.

The press's color on the chips and the strip tells you how fresh the last look is:

:::example The freshness colors
{{chip:red|Warnings}} &nbsp;— never marked, or past due for a look

{{chip:yellow|Warnings}} &nbsp;— due for a look today

{{chip:green|Warnings}} &nbsp;— looked at, and not due again yet
:::

**Due** is measured against the section's own rhythm. A section the office looks at every day turns yellow the next day. One looked at weekly stays green for the week. The rhythm is the usual gap between its last few looks. Until a section has been marked three times there is no rhythm to read. Then the old rule stands: green for 12 hours, yellow to 30, red after. The phone's list uses the same rule, so the two always agree.

A press records who marked it, when, and what the press meant. It collapses the section into a green bar:

:::example A marked section
{{chip:green|Warnings — Marked up to date at 8:41 AM by Dana. Expands automatically in 12h.}} &nbsp; {{button:outline|Open now}}
:::

Sections re-expand on their own after 12 hours, so tomorrow's pass starts fresh. You use {{button:outline|Open now}} to peek inside a collapsed section. The history icon opens the station's mark history. It shows the last eight weeks as one cell a workday. Each cell holds how many items were open at that mark. A day you pressed Not sure is a grey cell with a question mark. Under the cells you read who marks it and the usual time.

A mark means someone checked this today. It is not the week's close. Four stations feed the weekly money close: **People Hours**, **Unassigned field time**, **Banking sorting** and **Supply Houses**. They carry a second, read-only chip beside the mark. It says what the close still owes for the previous complete Monday to Sunday week:

:::example A green mark that is not a closed week
{{chip:green|Supply Houses — Marked 8:41 AM by Dana · Reloads in 12h}} &nbsp; {{chip:yellow|Close week: $239 open}}
:::

Controllers and devs can tap the chip to open Moneyfill on that week. Moneyfill is the weekly money close page. The numbers are Moneyfill's own, so the two never disagree. The close itself is its own guide: *close the money week*. Everyone else sees a plain **Feeds the weekly close** label. Hover it for what the daily mark is and is not. {{chip:green|Close week: clear}} means every queue this station feeds is at zero for that week.

Marking a section also removes its chip from the **floating section bar** at the bottom of the screen. It stays gone for the rest of your visit. The bar shrinks toward empty as your pass progresses. The chips all come back the next time you open Quickfill. The sections themselves stay collapsed until their 12 hours are up. {{button:outline|Open now}} puts a section's chip back immediately.

The **Last marked** words in a section's header open the same mark history as the history icon. So do the *last look* words under the question on a phone and in Roller.

## Only the groups with work

On a desktop or tablet a small switch sits beside the title. It reads **Page**, **Focus** and **Roller**. Quickfill opens on Roller until you pick another view. Page is the whole page, every section open top to bottom. Focus keeps only the sections with work open. Every other section folds to one line.

:::example What folds in Focus
{{chip:gray|○ Warnings · 0 open · Last marked 12:01 PM}} {{button:green|Done · 0 open}} {{button:outline|Not sure what to do}} {{button:outline|Open now}}

{{chip:green|✓ Office Arriving · Marked 9:54 AM by Dana}} {{button:outline|Open now}}

{{chip:gray|› My Inbox · no mark}} {{button:outline|Open now}}
:::

A folded section is still on the page. A section at zero keeps its {{button:green|Done · 0 open}} on its line. So a clean day still gets its press. You press {{button:outline|Open now}} to open any folded section in place. A line under the search box counts the groups. It reads like ***13 groups with work · 7 at zero · 5 marked today · 3 doors***. Each folded run sits under its own small heading at the foot of the page.

The switch remembers your choice on this device. A link can open any view. The address ends in `?view=focus`, `?view=page` or `?view=roller`. On a phone nothing changes. The round is already one section at a time.

## One group at a time

The switch's third choice is **Roller**. Quickfill opens here unless you picked Page or Focus on this device before. The page shows one section at a time. The name and the count sit at the top, then the question, then the section at full width. At the foot you find {{button:outline|← Previous}}, {{button:outline|Skip}}, the three presses and {{button:outline|Next →}}. The lit press also says where it goes, like {{button:blue|Worked it · 12 left · next →}}. The left and right arrow keys move without marking.

:::example The strip under the name
{{chip:red|●}} {{chip:gray|●}} {{chip:gray|●}} {{chip:green|●}} … ***7 of 23 · 12 left with work*** &nbsp; ☐ Show the 5 marked today &nbsp; {{button:outline|Groups ▾}}
:::

A strip of dots sits under the name. There is one dot for every section in the round, in the freshness colours. You tap a dot to jump to that section. The words beside the dots say where you are and how many sections with work are left. The round is every section not yet marked today. Due sections come first. The three doors come last. Tick **Show the 5 marked today** to put the marked ones back in.

{{button:outline|Groups ▾}} opens the Board. The Board shows every section in the round as a card. Each card has the count, the question and when it was last looked at. You tap a card to go there.

The lit press marks the section for everyone and opens the next one. It is the same mark as the small press in a station's header, with the count it saw. When every section has been looked at the page shows the **close sheet**. It says what is clean, what was worked and is still open, and what you asked about. Each station on it is a door back in. The Dashboard shows the same sheet in two lines, under Needs you, as **The office's round**.

## On a phone: the round

On a phone Quickfill is a **list of its sections**, not the sections themselves. Each row is the section's name, its count, and when it was last looked at and by whom. The dot says where it stands: {{chip:red|due}}, {{chip:yellow|due today}}, {{chip:gray|not yet}} or {{chip:green|fresh}}. **Due is measured against that section's own rhythm**, how often it actually gets marked. A section you mark weekly is due a week after its last mark, not 30 hours after. The headline says how many are due. {{button:blue|Round · 6 ›}} opens the first.

You tap a row and the section opens as its own screen. The question it answers is on top, then its count and last look, then the section as you know it. At the bottom, {{button:outline|Skip}} moves on without marking. Under it the three presses sit one above the other. The lit one marks it for everyone and opens the next due section. It is the same mark as the small press in a station's header, with the count it saw. When nothing is due the round is done. Email counts its own mail, so its Looked saves the list it saw. **My Inbox**, **Schedule** and **Tomorrow's schedule** sit at the bottom as doors. **Office Leaving** joins the round from 3 p.m. Before that its row reads *after 3 p.m.* and the Roller skips it.

## Finding a section fast

A **search box** sits between the jump buttons and the first section. Typing filters the section list live by name. For example `bill` leaves only the billing sections on the page:

:::example Searching sections
Search sections… `bill` → shows **Jobs Billing**, **Billed Awaiting Payment**, and **Complete, no Total Bill**; everything else hides until you clear the search (✕ or Escape).
:::

The jump buttons above the box always show every section, and the floating section bar follows the search. The filter resets when you leave the page.

Every section also has its own web address. A link from somewhere else in the app can land right on it. So can one you paste to a teammate. The section opens and scrolls into view, even if it was marked fresh and collapsed. The address is the page plus the section's name after a `#`:

:::example Linking straight to a section
`/quickfill#supply-houses` opens Quickfill with **Supply Houses** expanded and on screen. `/quickfill#vehicle-odometers` does the same for **Vehicle check-ins** — that is where the link in People → Vehicles → Check-in settings goes.
:::

A link may name a section that isn't on your Quickfill. Your company may hide it, or your role may not see it. Then the page stays as it is. A small note says *That section isn't on your Quickfill.*

On a phone the jump buttons are a single row you flick sideways. A one-line tally sits under it, like ***3 of 19 fresh · 16 need a look · oldest 2d***. So the first section starts right under the search box. Every section header also carries the lit press in small, beside {{button:outline|Not sure what to do}}. The small press does the same thing as the three at the foot. A long list never stands between you and marking it. Email asks for a note first and keeps just its own button.

## What's on the page

The sections cover the office's recurring review surfaces. Among them:

- **Warnings** and **Office Arriving / Office Leaving** are start and end of day checks.
- **Assistant Dailys** are the office's shared daily duties. There is one set of boxes for the whole team each day. Whoever does a duty checks it off. The row shows who and when, and the list clears overnight. A box can read a station instead of asking for a tick. The Schedule, Email and Physical inbox rows read their stations. Each is done when its station is marked today, by anyone, and shows the live count. The time off row lists who is off in the next 14 days. Tick it when you have told the lead. It is done on its own when nobody is off. There is no assigning. If a box is open, it is anyone's to take.
- **Vehicle check-ins** lists vehicles due for an odometer reading. Assigned trucks are due weekly, motor-pool trucks monthly. Motor-pool rows say *walk out & check*, since there's nobody to call. Each row has the holder's name as a tap-to-call link and the last reading with its age. It also has a **Miles** box and the check-in questions as checkboxes. *Any lights on the dash?* comes out of the box. Check a box and a short note about what you saw is required. {{button:blue|Save}} writes the reading and puts the whole check-in on the vehicle's history. It also files a problem report for anything you checked. Unassigned vehicles are skipped. A dev can tune the cadence and questions from People → Vehicles → **⚙ Check-ins ›**.

:::example Saving a check-in
2019 Ford F250 · ☎ Malachi · **Miles: 231,400** · ☑ Any lights on the dash? → "ABS light came on yesterday" → {{button:blue|Save}} — the reading and the answer land on the truck's history, and an ABS-light problem report opens on the fleet board.
:::
- **People Hours** and **Unassigned field time** are time approval. People Hours is where you approve yesterday's and today's sessions. The clock strip's approve pill asks once: *"Approve … ? This adds the hours to payroll."* Then the hours are in payroll. Assistants approve here, same as on People → Hours. **Unassigned field time** is a count card. It says how many person-days in the window had paid field time with no job on it. The window is 3, 7, 14 or 30 days. It shows one line per week, like *Aug 30 – Sep 5 · 5 person-days · 9.2 h · 3 people*. Each line has {{button:outline|Open on Team board →}}. That lands on that week of Jobs → Team with **Only exceptions** ticked, so the fix is one tap away. See [read the Team board](?g=read-the-team-board). When the window is clear the card reads **All on a job**. Clock sessions from the last 7 days may have no job or bid. Then a **Match sessions to jobs** block still appears under the card. It is the same flow People → Hours opens from its {{button:outline|Match sessions}} button. Sessions spread out in columns grouped by person. Each has one-tap suggestions, a job search, and {{button:red|Reject}} for time that was never a job. That means a test punch or an errand. Reject asks first, and rejected time never reaches payroll. **Apply all** takes sessions with exactly one Dispatch match.
- **Jobs Cleanup** is two things in one station. First, **sub labor with no job**. Sub labor is work done by a subcontractor. It lists every sub labor sheet whose job number is blank or matches no job, newest first. Each row shows its contractor, date, address, total and what's due. {{button:blue|Link job}} opens that sheet in Edit Sub Labor with the Job search one tap away. The row disappears once the sheet is linked. Second, **Today's Money Opportunities**. These are the same cards as Jobs → Pipeline. They are bill the finished work, chase the 90+ tail, and allocate deposits. They are also bills with no bill line, statement rounds, and who to call about payment. Every button lands on the Pipeline with that exact list or filter open. The "N open" count is sheets + cards. When both are empty the section says the pipeline is clean.
- **Jobs Billing** and **Billed Awaiting Payment** are the billing loop. See the billing guide.
- **Complete, no Total Bill** lists jobs marked **100% complete** whose **Total Bill** is empty or $0. The percent is the latest field report %, or the Edit Job **% complete** field when no report has one. The jobs are listed right in the section. Each job shows when work **started**, its **clock sessions** and hours. Hover for every work date. {{button:outline-blue|Job Detail}} opens the Job Detail modal. {{button:red|Edit job}} opens Edit Job to set the Job Total. {{button:outline|Activity ▾}} expands the same activity history you see in Job Detail. It uses the same 100% rule as the Job Summary **%** column. A paid invoice on a job with no Total Bill still counts as complete here. That is exactly what the section is for. It also uses the same minimum-HCP cutoff as Jobs Billing. HCP is the job's HouseCall Pro number.
- **Missing bill dates** lists bills that are billed or paid but have no bill date. Without a date their payments can't teach the pay-speed math. That math is the clock behind the question of when this customer will pay. Each row shows the customer, address, HCP number, amount, and a clue chip. {{chip:gray|paid 08/24}} means the money landed then, and the bill usually went out a bit before. You figure out the real date and tap **＋ add date**. You type it as six digits, MM/DD/YY, and the slashes fill themselves in. Then {{button:blue|Save}}, and the row clears on the spot. **Open job ›** lands on the job's Bill tab for the ones that need digging. Only bills that still matter appear. History older than the No Count Date is left alone.
- **Property kinds** lists every unpaid job whose property is not yet marked residential or commercial. One row per property. The address opens Google Maps. Pick Residential or Commercial and every job at that address follows. See [mark property kinds from Quickfill](/help/mark-property-kinds-from-quickfill).
- **Percent complete** lists every open job whose ticked stages or paid money disagree with its % done. One card per job, with the Pipeline's stage bar and one sentence that says what disagrees. The knob on the bar holds the number the facts suggest. Drag it, press a stage chip, or type a number. Press Save, or Dismiss for one week. See [fix a job's percent done in Quickfill](/help/fix-a-jobs-percent-done-in-quickfill).
- **Dispatch inbox** holds field requests. That includes Turnaway alerts with their {{button:outline-amber|Create trip charge}} button.
- **Schedule** asks *Are there any obvious schedule conflicts?* and **Tomorrow's Schedule** asks *Who is on what job tomorrow?*
- **Email** counts the mail that sits in Gmail, once the owner turns it on. Each inbox it counts has a row per label, such as Inbox, Follow Up and Next Actions. A row shows how many threads sit there and how old the oldest is. A thread older than the limit shows by name, with the day it came and {{button:outline|Open →}} into Gmail. A line says what came and what cleared since the last look. {{button:amber|Looked · 4 open}} saves the list as the mark's note. The Email station's history adds four weeks of bars for each label. A bar is red when the oldest thread sat too long. Under the bars, each of the last 14 days says who looked and what sat, including the days nobody looked. A shared inbox shows to the office. Your own inbox shows to you and to the lead. See [choose which mail quickfill counts](/help/choose-which-mail-quickfill-counts). Until the app counts an inbox you can see, the station keeps its three boxes to type in.
- **Texts** reads the day's texts from Messages. The first band is **Needs a reply**, every text nobody has answered, the one waiting longest first. Each row has {{button:blue|Reply}} and {{button:blue|☎ Call}}. Reply opens the thread on Messages, under their text. **Answer all** on that band opens the reply desk on Messages. The second band is **Not delivered**, our texts from today and yesterday that never reached a phone. Those rows are red, with {{button:blue|☎ Call them}} and {{button:outline|Send it as an email}}. The third band is **Went out today**, every text we sent today with Quo's mark. Press **Show** to open it. The count is the first two bands. On a clean day the station reads one line, *Nothing on texts is waiting on us.* **Anything else?** holds one line for a text the app cannot see. The Mark writes its note from the rows. The history then says who was still waiting at each look. See [answer everyone waiting on us from one page](/help/answer-everyone-waiting-on-us-from-one-page).
- **Physical inbox** is the tray on the office desk as a deck of papers. Each paper is typed once and leaves on one press. The count is the paper nobody has decided on. See [clear the physical inbox](/help/clear-the-physical-inbox).
- **Prospects**, **Supply Houses**, **Banking sorting**, and more.
- **Unreachable Prospects** only appears when at least one prospect is flagged can't-reach. At zero it disappears from the page entirely. Working the last one out of the list is the goal.
- **My Inbox** is yours alone. It holds the same Due Today and Overdue tasks as the Dashboard's My Inbox card. It has the same checkboxes, Forward, and mute controls. Because it's personal, it has no shared "Mark up to date" button. Its jump chip stays neutral instead of red, yellow or green. It clears itself as you complete tasks. It shows *Nothing in your inbox right now* when you're done.

Devs can reorder sections, hide them, and edit each section's banner prompt. Everyone else sees the configured order.

## The habit

The page is built for one pass in the morning and a lighter pass after lunch. If every bar is green by mid-morning, the office is caught up. Anything {{button:red|red}} is exactly where to spend attention next.

## Missing job info

The **Missing job info** section lists every job that's missing something. That is a **linked customer**, a **customer pictures link**, or a **billing email**. The billing email only counts for Ready to Bill jobs. These are the same three chips that appear at the top of Jobs → Pipeline. Each row shows the job number, name, customer, and address so you know exactly which job it is. For pictures and email, you type the value right in the row and press **Save** or Enter. The row disappears once it's fixed. Linking a customer opens Edit Job with one click.
