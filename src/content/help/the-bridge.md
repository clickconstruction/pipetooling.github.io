---
title: read the Bridge
category: Billing & Money
roles: dev, master_technician
keywords: bridge, vectors, who moved the number, by the day, profitable day, red day, green day, truth check, paper vs bank, net position, cash forecast, cash on hand, cash floor, bills due, receipts expected, profit rate, overhead, earned revenue
order: 62
---
1. Read the three numbers at the top. They are what the field made last week, cash's low point, and the slowest step.
2. Read the card under them. It names the slowest step and the moves for this week.
3. Press {{button:blue|Make Build this week's call}} to record it. The button names the step the page reads today.

**The Bridge** answers three questions on one page: where we stand, where cash is going, and what would change it. The Bridge runs on one clock: days.

The Bridge is for the owner and devs. A dev lands here when they open the app or sign in. Press **Dashboard** in the header to see your day. You can also open the Bridge from the compass icon in the header, or **Bridge** in the ☰ menu. The page’s address is `/bridge`.

## The first screen

The page opens on three numbers.

- **Made last week** is field contribution, the number the company works to raise. That is what the field earned at each job's price, less its wages. The small bars are the last eight pay weeks. A ≈ after the number means hours still wait on approval. From Friday the tile shows this week so far.
- **Cash low point, 8 weeks** is the lowest your cash gets in the next eight weeks. The tile is green when that stays above your floor. The tile is red when cash goes under the floor, and it names the day.
- **Slowest step** is the stage the page reads as the weakest link.

Under the three numbers, a strip of pipe draws the five steps in a line. A section is wide when the step moves many dollars a week. The word under each number says what the dollars are: asked, sold, built, billed or paid. A block on top of a section is work waiting in front of that step. The slowest step is red. Press a section to open that step's desk. In a week cash comes first, the strip sits under the card.

An amber line under the cash tile names any account you left out of cash on hand. Press it to open Money at [the bank's accounts](#cash-on-hand-comes-from-the-bank).

When cash goes under your floor, cash comes first. The cash tile takes the top row and the card reads **Keep cash above the floor**. Its moves chase the late invoices and ask the supply houses for more days. The slowest step follows as the last move. To call a step that week, press {{button:outline|Pick another step ›}}.

Under the numbers, **This week's call** names the step and proposes two or three moves. Each move has a person. Press a move to open the page where the work is done.

- Press a name to change who does the move. Pick a person from the list and the move reaches them. Pick **Type a name…** for someone with no account. A typed name reaches nobody, and its chip has a dashed edge.
- Press {{button:outline|take off}} to drop a move from the call. The step's next move comes on in its place. Press {{button:outline|put back}} to return it.
- Press {{button:outline|Add a note ›}} to type one line with the call. The card shows the note again once the call stands.
- Press the blue button to record the call. The button waits until one move is on the call.

Once the call is recorded, each person finds their move on their own [Needs you card](#the-call-reaches-its-people).

After you record it, the card shows each move against today. A move reads *done*, *part* or *not yet*. A move the app cannot measure reads *yours*.

From Friday the card asks whether the step moved. Press {{button:green|It moved}} or {{button:outline|It did not}}. Your answer is the one the page keeps.

When an earlier call was never answered, **The last call** asks for its answer beside this week's card.

To call a different step, press {{button:outline|Pick another step ›}}. The flow opens. Press a stage card there. The card at the top then proposes that step.

## The call reaches its people

A move goes to the person named on it. They do not need to open the Bridge. Their Dashboard's **Needs you** card shows a line named **The week's call**.

- The line reads the move, and who made the call.
- Its button opens the page where the work is done, such as Stages or Billing.
- Press **Done** when the work is finished. The line leaves their card.
- A move with no page has one button, **Mark it done**.

On the Bridge, the card then says who marked a move done. For a move the app can measure, the numbers still decide whether it reads *done*. For one it cannot measure, the person's word decides.

The line leaves by itself when Friday's question is answered, or when the pay week ends.

## The doors

The first screen is the whole page until you open a door. Under the card sit {{button:outline|The flow}}, {{button:outline|Money}} and {{button:outline|People}}. Press one and that part of the page opens under the row. Press it again to close it. One door is open at a time.

- **The flow** holds the rule, the five steps and their desks, the dial, the three resources and the last call.
- **Money** holds cash for eight weeks, bills and receipts, net position, money owed and the eight week chart.
- **People** holds who moved the number, the day grid and the crew's hours.

An amber door counts the [soft numbers](#soft-numbers). It shows only when something makes the reading unsure.

The open door rides in the page's address. A link to `/bridge?door=money` opens Money.

## A card behind every bar

Behind **Money**, the eight week chart has a card for every bar. Hover over any of the eight bars, or tab to it, or press it. A card opens under the bar. It shows what the week earned less field wages, the hours, the sessions, the people and the dollars an hour. It names the three jobs that made the week. The last line reads the week against the 8-week average. A week still waiting on approvals says what it reads now and what approved only reads. Press the bar to pin the card. Press it again to let it go.

## The rule, and where the work piles up

**The flow** opens on one line. Find the slowest step. Everything waits on it. Press the {{button:outline|?}} beside it to read why, in five points.

Under that line sit five cards in the order work flows. Market, Sales, Build, Bill, Collect. Each card reads one stage. The bar is the pile waiting in front of it. The two lines under the bar say what comes in and what goes out each week. The last line says how many weeks it would take to clear the pile at today's pace. Collect's weeks count only the bills past their day. The grey part of its bar is billed and not yet due.

The Market card counts the asks that came in: bids invited and estimates requested, by value. The Sales card shows what went out and what came back, bids and estimates on their own lines. Won counts the bids marked won and the bids that became jobs. Both cards read by pace against the field, not by weeks of pile.

The Build card reads the jobs' percent complete. Built per week is each job's change in percent times its contract. Sold per week is the contract on the jobs created. The pile is the contract left to build on open jobs. A job with no percent is read as half done and drawn grey. Set its percent to make the reading true.

The **Jobs with no %** strip sits behind the soft numbers door. It counts the open jobs with a contract and no percent. Press {{button:outline-amber|Set the %s}} to open the list, biggest contract first. Press {{button:outline|Set}} on a row to open the percent window the crews use on their schedule. Saving files a status report on the job, the way a crew's does. The Build card's grey shrinks right away, and the row moves to the bottom marked set. A set row stays on the list until the page reloads. When every open job with a contract has a percent, the strip says so.

The field's pace is read a second way, by hours. That is what the field earned on recorded time, the way the top line reads the week. The card uses the larger of the two and names the other. The Bill card's first line reads the same hours. When over a third of Build's pile is grey, Build takes the link only by a clear margin. Until then its badge says it reads on a thin percent.

The Bill card's pile is finished work not yet billed. On each working job that is the percent done times the contract, less what is billed or paid. A job marked ready to bill counts the whole remainder. A job with no percent takes the newest field report's answer. A working job with neither reads as half done and is drawn grey. The grey rule and the thin percent rule work the same way as on Build. The Bill card's second line counts every bill by the day it went out. A bill marked billed by hand counts on the day it was marked.

The stage with the most weeks reads red. That is the weakest link. A stage within a tenth of it reads as its pair. The stages after the link say they move with it. A card that says **not readable yet** waits on a later step of the app.

Press a card to read it. The pressed card has the red border.

## Market, broken down

Press **Break it down** on the Market card. A window opens on the asks. The headline reads about how much is asked of us a week. The same line says whether that feeds the field at the win share. One bold line under it names this week's move. The quiet GCs to call, and the GC whose bids need a value. Three tiles read the quarter. How much was asked, how much three GCs carry, and the new names. A strip shows the last 26 pay weeks. Each week stacks what GCs asked and what customers asked, by value. A dashed line marks what feeding the field takes. Press a week and its numbers read under the strip. Under the strip sits the book. Each GC gets a row with a chip. Feeding means they keep asking. Fading means they ask less than half their usual. New name means their first bid ever was this quarter. Dead weight means six priced bids and no answer. The row says what they asked and what they paid. Press a row for its quarters and its answer pace. **Open their bids** opens the Bid Board. The customers' estimates get one row of their own. **Open Estimates** opens the Estimates page. A card names a GC that has never answered a priced bid. Another card counts the bids sent at $0. **Open the bids** opens the bids page. An amber panel says what the window cannot see. Courting, reputation, and invites that never became a bid. The last line says how it reads. Nothing records here. The week's call stays with the lit link. Esc closes the window. A GC in the book is the customer the bid names. A GC that has never answered a bid says so.

## Sales, broken down

Press **Break it down** on the Sales card. A window opens on everything asked and not yet answered. Every number in it is expected dollars. Expected dollars are the ask times the asker's own win rate, faded past their answer pace. The headline says what was asked and what it is worth. One bold line names the calls this week and what they protect. Three tiles say what the pile is worth, what is at risk, and what thins the reading. The bar splits the pile into protected, at risk, evaporating and dead weight. A line under it counts the bids past the 90-day window, with a door to the Bid Board. Then one row per asker, ranked by what a call protects. Press **Ranked by expected dollars** to rank by open dollars instead. A note says who leads by open dollars when the two rankings disagree. Each row shows the open dollars, the wins, the answer pace, the expected dollars and where the asks stand. Press a row to open it. The row lists each bid with its age and says the one move. **Open the bid** opens that bid on the Bid Board. Everyone else is one row. The estimates are one row, with **Open Estimates** as the door. Under the rows, a strip reads the asks already decided. Won comes first, then lost by the reason on each bid. A red line counts the losses with no reason. Nothing records here. Answers land on the bid itself. Esc closes the window. The asker is the customer the bid names. A bid that became a job counts as won. The estimates fade at their own answer pace, with a floor of seven days. A loss with no reason lists under the funnel with a door to its bid.

## Build, broken down

Press **Break it down** on the Build card. A window opens on the last 14 days of every open job. The headline says how many hours went in and how much work came out. Work out is each job's change in percent times its contract. One bold line names the week: the jobs that ate hours and moved nothing, and the jobs that saw nobody. Under it sit the card's two paces. Three tiles follow. Moved is the jobs where the hours and the percent agree. Ate hours is the jobs with hours and no movement. Stalled is the sold money on jobs with no field hours in 14 days. Then every open job gets a row, worst first. The row shows the hours, the percent from and to, the money moved and a chip that names its group. Press a row to read why. A stalled row says how long nobody has been on it and what the Schedule shows. A row with no price says its hours earned $0 on paper. A moving row says how many hours it expects. A finished row says the work is Bill's now. Each row ends in its doors. **Open the job** opens the job window. **Open the Schedule** opens the Schedule. **Price the job** opens the job window too. **Bill it** opens Billing. **Set the %** opens the percent window the crews use. Saving files a status report, and the desk recomputes. More than three moving jobs fold under one line. Press the line to show them. The foot of the window says how it reads. The week's call stays on the link desk above. Esc closes the window.

## Bill, broken down

Press **Break it down** on the Bill card. A window opens on one question. When the work finishes, does the bill go out that day? The headline is the money the reads can prove will not bill itself. One bold line under it says how much the office already called done waits on a send. The next line carries the card's two paces and its weeks. The pipe strip reads the window in five cells. Finished by the field, finished with no bill yet, billed, billed and not yet paid, and paid. This desk owns the first gap. The second gap is Collect's. Bills marked billed by hand with no send on file sit under their own line, apart from the leaks. The meter also says how many days of the cash in the bank the pile is.

The leaks are rows no page finds alone. Each row crosses two reads. A job reads 100% and its bills cover nothing. A job billed part of its finished share and the rest has no bill. A job has field hours and no contract price. A bill was marked billed by hand with no send on file. Each row says the amount, how long it has sat, and which job. Press a row to open the read that proves it and its door. **Bill it** and **Bill the rest** open Billing. **Price the job** opens the job window. **Open the bill** opens Billing. A row the office clears disappears on its own.

**Billable today** lists the jobs the office marked ready to bill. Each row says how many days the job has sat since that day. The row also says what the bills or payments already cover, and the remainder. The whole remainder counts on a ready job. **Bill it** opens Billing.

**The rule, lately** folds under one line. Press it. Eight cells show how many bills went out the day their job finished, per pay week. The table under them lists every bill of the window, newest first. Each row shows the ready day, the billed day, the lag, who sent it, and the cash-days. Cash-days is the lag times the bill. A bill with no ready day on record shows a dash. The meter under it says what one more week of sitting costs. The footnote names every read the figures rest on. The desk records nothing. The week's call stays with the lit link desk above. Press {{button:outline|×}} or the Escape key to close it.

## Collect, broken down

Press the Collect card. Under Today's reading, press **Break it down**. A window opens on the pile. It reads each bill by where it stands against its payer's own pace. Not yet due, promised, past a promise, late with no date, or doubtful. Collections sits apart. Three tiles say how much waits on a call, who holds it, and where the pile goes left alone. Each payer that holds the pile gets a row. The row says what is open, the oldest bill, how fast they pay, and why the window thinks so. It says where the account stands: the promise, the bills marked billed by hand, the last call, the lien paper. Everyone else is one line. Each row ends with the one move that lands the money soonest, and the words to say. Beside it sits the lien paper and a field for the owner and the day. A red strip names what only you can decide. The third tile is a guess, stated as one: what half of the ask lands in three weeks. The tile starts from the card's weeks, on what is already late. **After the call** on a row opens four answers. Money is in the bank, they named a date, no date, or they dispute it. Each becomes the record the app already keeps. A mailed check is a promise dated by the mail. Then the sheet keeps its word. A call that named no date waits three days off the sheet. A promise waits for its day. A dispute leaves the sheet for the red strip. A second miss on an account puts the owner on the next call. **Record this as the week's plan** writes the moves into the week's call. Once a plan is recorded, a green card sits above the rows. It says what landed, how many calls ended with a date, and whether the notices went out. It says what Monday carries. **Copy the call sheet** puts the rows on the clipboard. **Show the facts** opens what slows Collect before any call. Esc closes the window.

## The dial

Under the cards sits a slider for the pressed stage. It reads that stage's pace in dollars a week. Drag it and the cards above move with it. Marks on the track show today and where the pile stops growing. Other marks show where the link moves to another stage and where exploiting ends. The blue part of the track is what we can do with what we have. The amber part means spending.

The number beside the slider has a plain unit under it, such as jobs a week. The small chart shows the pile over the next twelve weeks at the chosen pace. The dotted line is today's pace. Three boxes read the pile, the link and the money. Press {{button:outline|back to today}} to put the slider back.

## The three resources

Under the dial sit Decision, Capital and Talent. A stage is slow because one of these is short. Decision counts the piles that wait on you. Capital reads the bank against the floor. Talent counts who is in the field and who bills. Each card says whether it throttles the link or shows its symptom. Press a card to open its desk.

## What to deal with first

Every card ends in a badge. Press any badge and a list opens. The list puts the link first. What throttles it comes with it. The stage that would be the link after it comes next. What moves when the link moves follows. What is ahead of the field waits. Each row shows the reading that put it there and its first move. The badge you pressed is marked. Press {{button:outline|×}} or the Escape key to close it.

## Everything else waits

A card under the desk lists the four fixes people reach for first. Hire another plumber. Push for more bids. Add a field day. Cut overhead. Two of them show what they are worth in dollars a day. Under them, **Bids due** lists the bids due soon and what a win is worth. Press a fix and the dial and the cards above show what it would do. One line under the press says what changed and whether the link moved. Cut overhead moves nothing above. That is the point. Press {{button:outline|back to today}} to put things back. The {{button:outline|?}} in the corner lists the other links' levers.

## The week's call

You record the call on [the first screen](#the-first-screen). It is the one place a call is made.

Behind **The flow**, the desk of the pressed stage sits under the three resources. It says what the stage is, why it matters, how the Bridge reads it, and what it reads today. Press {{button:outline|Every move for Bill}} to read every move the stage has. Each row says whether the card at the top holds it. Press a different stage card and the card at the top proposes that stage. Press {{button:outline|Go to this week's call ↑}} to go back up to it. The call keeps today's numbers, so Friday can read them again.

A recorded call holds the red on its stage for the week. Another stage takes it only when it reads clearly longer.

**Last week's call, against what moved** sits under the desk. It names the link, who called it and how many weeks running. Each move shows its number then and now, and whether it got done. The last line says what that means for this week. From Friday the card asks whether the link moved. Press {{button:green|It moved}} or {{button:red|It did not}}.

## Money owed and Crew hours, opened

**Money owed** sits behind Money. The card reads owed to you, owed by you, finished work not yet billed, and the collections balance. Owed to you leaves collections out. The collections balance is written off for planning.

**Crew hours** sits behind People. The card reads approved field time in the last 7 days. It also reads office and bid time, and how much still awaits approval.

Press **Money owed**. Owed to you reads by how late it is. Owed by you reads by when it falls due. A waterfall walks from cash through what is owed each way to net position. It then adds the finished work not yet billed. Press **Crew hours**. The chart stacks each week by what the app has read. Approved field hours are blue. Hours waiting for approval are hatched. Office hours are grey. A waterfall walks this week's hours from clocked to what the page reads. Both panels end in the table of sources. One line ties each to the link.

## The two charts, broken down

Press {{button:outline|break it down}} on the net position chart. A waterfall shows what moved it since the window opened. Cash, owed to you and owed by you each show their change. The cash row reads red when the chart's figure and the bank's disagree. The Truth check opens under that waterfall. Press {{button:outline|break it down}} on the cash chart. The waterfall walks from the bank today through the receipts and the bills to where the line ends. Each table ends in its doors.

## The people tables

Vectors reads in two groups. Field is who makes the contribution. Office & estimators is who does the billing, collecting and bids. A dev counts as office. Each group ends in a subtotal row. Rows sort by contribution, then by hours waiting.

Vectors by the day has three readings. Press {{button:outline|Profit}} for earned at the job's rate less the wage. Press {{button:outline|Revenue}} for what the day earned. Press {{button:outline|Cost}} for what the day cost in wages. The week column, the totals and the Field crew row follow the reading.

## The weekly email

Behind **The flow**, the **Weekly email** switch sits at the bottom. Turn it on and the app mails the Bridge's first screen every Monday at 6 AM Central. The owner and every dev get it at their own address. Nobody else gets it. The line under the switch says when it last went and to how many people. Turn it off and nothing goes out on Monday.

The email shows the three tiles, the strip of pipe and the week's call with its moves. The email counts the same bank accounts as the page. An account you left out of cash on hand is left out of the email too.

The email records nothing. The email's button opens the Bridge, where one press makes the call. A move the page would give to you goes out with no name on it. On a Friday the button opens the Bridge so you can answer.

## Cash on hand comes from the bank

The page reads the bank's balance when it opens. Behind **Money**, under the cash chart, the cash row says cash on hand and the time the bank was read. Press {{button:outline|Read again}} to read the bank once more. The cash line and the net position line start from that figure.

Under that row, **The bank's accounts** lists every account by the name you gave it in Mercury. Each row shows what the account holds. A row also shows what is free to spend when a charge is still pending.

Each account has a tick box. Clear the box to leave that account out of cash on hand. The row then reads *Left out* and keeps its balance. The forecast, the cash tile and the cash rule all use the lower figure. Tick the box to count the account again. The choice is saved, so it stands until you change it.

:::example Leaving one account out

You keep money for bills in an account named Accounts Payable. Clear its box to see cash without that money. Tick it again to see cash with it.

:::

Bills still come off the forecast on the day they are due, whichever way you count.

When the bank cannot be read, the row shows the reason. You then type today's balance in **Cash on hand today** and press {{button:outline|Set}}. The number is remembered with the date. On later days the page rolls it forward through the bank transactions since. Once the bank answers again, the typed figure steps aside. An amber line then says how far the typed figure drifted from the bank, if it did.

You set the **Floor** the same way. The floor is the cash level you never want to go under. The floor starts at $5,000.

## The top line: contribution per week

Behind **Money**, the eight week chart reads **field contribution this week**. That is the number the company maximizes. Field contribution is what field hours earned minus what those hours cost in wages. The big number reads recorded time, so hours still waiting on approval count. An amber **≈** beside it means some of those hours still wait. Under it, **approved only** is the same week on what payroll paid.

The bars are the last eight pay weeks. A hatched bar is a week still waiting on approvals. The **Verdict** line reads the bars for you. It names the range the settled weeks ran. It also says when a low week is the approval pile and not the field.

Two lights sit under the bars. **Net position rises over 8 weeks** is green when the line is up since the window started. **Cash stays above the floor** is green when the forecast never dips under your floor. The cash light turns amber when the cash figure you typed is a week or more old.

:::example Reading the top line
+$38.3k ≈ this week so far on 317h recorded, approved only +$9.7k on 80h. The verdict says contribution ran $13.8k to $46.8k a week over the six settled weeks, and the last two read low only because 564h still wait on approval.
:::

## What is left after overhead

The eight week chart ends at wages. Under its two lights, press {{button:outline|What is left after overhead}}. A breakdown opens.

- The big number is what a day keeps after every cost, on the last 14 days.
- It reads recorded time, the way the eight week chart does. Hours still waiting on approval are counted, with their wages.
- A ≈ after the number means waiting hours are in it. The amber line under it says how many. It also says what approved hours alone read.
- A chart shows where a day's money goes, from earned through job costs and overhead.
- One line gives break-even. It says what the field must earn a day to cover the office.
- A second chart shows earned against costs by pay week. A hatched week still has hours waiting.

Press **Where each number comes from** to see each source and what can make it wrong. Each row ends in its door.

## Net position — last 8 weeks

The solid line is **cash + owed to you − owed by you**. The line ends at today's real number. The last 8 weeks are rebuilt from dated flows. The flows are bank transactions, invoices sent, payments received, and supply invoices dated and paid. The readout says where the line is today. The readout also says how much the line moved since the start of the window. You hover any day for the split.

## Truth check — does the paper agree with the bank?

The Truth check opens with the net position chart's breakdown. Press {{button:outline|break it down}} on that chart.

Profit on paper is an accrual reading: earned minus costs. Costs are job costs plus overhead, the office's running cost, at the 90-day rate from People → Overhead. Accrual means earnings and costs count on the day they happen, not when cash moves. Net position is what the bank and the ledgers actually did. Over the same 8 weeks, the two should tell one story. The **Truth check** panel puts the two side by side: **Profit on paper** and **Net position moved**. The panel splits the difference between the two figures exactly in two:

- **Earned but not invoiced**: work that earned on paper and hasn't been billed yet. This money is real, and the biggest lever on the page. You bill it and the net line catches up.
- **Costs the paper doesn't see**: what the bank and the supply ledger charged beyond what the profit rate counted. Under 15% of paper costs reads as agreement.

The sentence on the right is the verdict: *steer by the profit rate*, *bill it to see it*, or *not a number to steer by yet*. Under the verdict sit the rows that make the cost side dirty. Each row is sized where it can be. {{chip:yellow|186h awaiting approval}} is labor that payroll pays and the paper hasn't counted. {{chip:yellow|bank transfers unsorted}} is rent, insurance and trucks that hit the bank and never the paper. {{chip:yellow|open jobs assumed half done}} is earned dollars resting on a guess. Worked jobs with no contract price get a row too.

:::example Reading it
Profit on paper +$194k · net position moved −$3.4k · the $197k between them: +$180k earned but not invoiced, +$17k costs the paper doesn't see. The verdict says the profit is real on paper — bill it to see it — and the cost side is close enough to trust.
:::

A loan or an owner deposit is money in that isn't a customer payment. The Bridge shows that money as a negative cost. Payroll and sub labor count when the bank pays them, not when the hours are worked.

## People — who moved the number

Behind **People**, a strip holds the two person tables. One line at its top reads the pay week. It names the top two people on approved hours and who has hours waiting. It also says what was billed and collected. The tables are open under it.

## Vectors — who moved the number

Inside the People strip, **Vectors** lists one row per person for one pay week. A pay week runs Sunday–Saturday. You step back through the eight weeks on the page with ‹ ›. The current week reads *so far*. The headline is the week's **field contribution**. Field contribution is what approved field hours earned minus what those hours cost in wages.

- **Field people** carry Field h, Earned, Labor, **Contribution** and $/h. Field h also shows hours still {{chip:yellow|waiting}} on approval. Earned uses the Bridge's own rate: the job's contract ÷ its expected hours. With this rate, a person's earned dollars add up to the company's.
- **Office people** carry Billed and Collected. Billed is the invoices they sent. Collected is the payments they recorded. Everyone carries **% reports**: job % updates plus field reports filed.
- **The estimator** carries Bids sent and Bids won, by value.

**A name is a door.** You click it and People → Review opens on that pay week. The person's panel is expanded. The panel shows jobs worked with day rows, hours and pay, reports and tasks. Review counts earned the same way, so its Gross is the Earned you clicked.

An amber **≈** on Earned or Contribution means some of it rests on a job with no % complete. The app assumed that job half done, so the rate is a guess. You set the % on the job and the mark goes away. You hover the Contribution cell for the split. The split shows earned, labor, guessed, hours on jobs with no contract price, and no wage on file.

:::example Reading a week
+$125k field contribution on 50 approved hours — but ≈ $124k of it is one person's day on a job with no % complete, and 166h are still waiting on approval, so most rows read "—". The number becomes real when the % is set and the hours are approved.
:::

Materials and sub sheets are job costs, not anyone's vector, so contribution here is labor-only.

## Vectors by the day — was each person's day worth it

Under the Vectors table, inside the same strip, the same rule runs one day at a time. The view is a grid with one row per field person and one cell per day of the month. Each cell is **green when the day's hours earned more than they cost, red when they cost more**. The shade is set by dollars per hour. A **wk** column after every Saturday sums the week. The month's total sits at the end, with the hours and $/h under it.

- You click a cell and a card opens under the grid. The card lists the jobs worked, each at its earned rate beside the wage. The card also shows the labor line and the contribution. A sentence says why the day reads the way it does. The card has doors to open the job, set its % complete, or see that day on People → Review. The {{chip:yellow|≈}} hatch means part of it rests on a job with no % complete.
- Under each name, a **Why** line counts the red days by job. *7 red · all on 990* is a pricing problem, not a slow person.
- **A grey cell with hours** is an office or bid day. That day costs a wage and earns nothing here, so it is never judged.
- The grid reads **recorded time**. Recorded time counts every closed session not rejected or revoked, the way job costing does. This week is on the grid before approvals catch up. Hours still waiting draw with a dashed border and say so. {{button:outline|Approved only}} beside the title switches to what payroll paid. This browser remembers that choice. The Vectors table above always reads approved time, so the two never disagree about what was paid.

:::example Reading a red day
Tristen's Tuesday reads −53: 7.5 h on J1044 at $31 an hour, against a $38 wage. That is the job's price against the hours it is taking, not how fast the day went — everyone on J1044 reads red this month. The job has no % complete, so its expected hours are a guess: set the % and the rate firms up either way.
:::

## Cash — next 8 weeks

The dashed line starts at cash today. The line **drops on the day each bill is due**. Supply invoices count on their due date. Sub labor counts on its payable-after date. Payroll counts every Friday, at the 8-week average. The line **rises on the day each receipt is expected**. The expected day is a promised pay date if the customer named one. Without a promise, the app uses that customer's usual pay speed. A GC with no history reads at the GC pace here. Anyone else with no history reads at their segment's pace. Next comes the company's usual pay speed, and last of all 45 days. A late invoice is assumed to arrive within that customer's own pay pace, between 7 and 45 days. With no pay pace on record, the app uses 14 days. An invoice more than 60 days late isn't counted at all and is listed as doubtful. Collections never count. Office parts drain a little every day at the 90-day rate. Office parts are materials bought for the office, not for a job.

The readout is a date and a number. The readout shows **the lowest cash point in the window and whether it clears your floor.** The dot on the line marks that point.

Under the chart, a band shows **how sure the receipts are**. Green is money a customer promised on a date. Blue is money expected by that customer's pay pace or the company's. Hatched yellow is late invoices assumed to land. When one day carries most of the window's receipts, an amber line names it. The line also says what else falls due that day. That is the day to watch.

:::example The day that carries the window
87% of the window's receipts land on Oct 24, most of it late invoices assumed to land. That day also owes $54.1k of sub labor. If the invoices slip, that is the day cash is tested.
:::

:::example What the lists under the chart are
**Bills coming due** and **Receipts expected** are the same events the chart uses, day by day, with the reason for each receipt date.
:::

The two lists show the next 14 days. Press the button under a list to show the later days too.

## Soft numbers

The amber door on the first screen counts the soft numbers. Press it and one list opens. Each row is something that makes the page read low or thin. The bold line names it. The line under it says what it moves. The link at the end opens the place that fixes it. The biggest mover is first. The rows are these:

- hours that wait on approval, which move the week's number and payroll
- a typed cash figure that drifted from the bank, or one typed when the bank could not be read
- jobs worked this window with no percent complete, which are read as half done
- worked jobs with no price, which earn $0
- bank transfers or card purchases not sorted
- bids sent with no value

This list took the place of **This week** and **Fix the reading**. The moves that were on This week are on the call card now. Its dollar sizes are on the usual fixes behind The flow.

Insurance, rent, and card bills aren't scheduled as bills yet. These bills arrive as bank transfers and only show once sorted.

:::example Reading a row
**585 hours wait on approval.** This week reads $9.7k until they are approved. With them it is about $38.3k. Press **Approve** and the queue opens.
:::

## Reference

### Vectors

Some invoice sends were written by the system with no signed-in sender. Those sends, and bids with no estimator, are listed under the table as *not on anyone's row*.

### Vectors by the day

The zoom row beside the title changes the columns. **Days** is the month. **Weeks** is the last thirteen pay weeks, one cell per person per week. **Months** is the last twelve months. A week or month cell is the same days folded together. So a person's month equals the sum of their week columns. ‹ › steps a month, thirteen weeks or twelve months at a time. The running period reads *so far*.

- A **↻** on a day means last week's rates read it the other way. A % update or the hours landing since then re-priced every day on that job.
- **A salaried person's day** costs the flat workday, the way payroll prices it, whatever the clock says.
- The **Field crew** row at the bottom is the company line day by day.

A red day is a job's verdict, not a person's. Every hour on a job earns the same rate. A day goes red only when the job's rate is under the wage. The job's rate falls under the wage when the job is priced low or has no contract price. The rate also falls under when the job has run past its expected hours. And the past moves. A job's rate is its contract ÷ its expected hours. A job's expected hours are its hours to date ÷ % complete. So every new hour and every % update re-prices every day ever worked on that job. The grid is always as of today.
