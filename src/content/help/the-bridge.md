---
title: read the Bridge
category: Billing & Money
roles: dev
keywords: bridge, vectors, who moved the number, by the day, profitable day, red day, green day, truth check, paper vs bank, net position, cash forecast, cash on hand, cash floor, bills due, receipts expected, profit rate, overhead, earned revenue
order: 62
---
1. Read the top line. The big number is this week's field contribution. The two lights under it say whether net position is up and whether cash clears your floor.
2. Read the cash readout: the lowest cash point in the next 8 weeks, and whether it clears your floor. Cash on hand comes from the bank.
3. Read the Truth check verdict: *steer by the profit rate*, *bill it to see it*, or *not a number to steer by yet*.

**The Bridge** answers three questions on one page: where we stand, where cash is going, and what would change it. The Bridge runs on one clock: days.

The Bridge is for devs only for now. When you open the app or sign in, you land here. Press **Dashboard** in the header to see your day. You can also open the Bridge from the compass icon in the header, or **Bridge** in the ☰ menu. The page’s address is `/bridge`.

## A card behind every bar

Hover over any of the eight bars, or tab to it, or press it. A card opens under the bar. It shows what the week earned less field wages, the hours, the sessions, the people and the dollars an hour. It names the three jobs that made the week. The last line reads the week against the 8-week average. A week still waiting on approvals says what it reads now and what approved only reads. Press the bar to pin the card. Press it again to let it go.

## The rule, and where the work piles up

The page opens on one line. Find the slowest step. Everything waits on it. Press the {{button:outline|?}} beside it to read why, in five points.

Under the top line sit five cards in the order work flows. Market, Sales, Build, Bill, Collect. Each card reads one stage. The bar is the pile waiting in front of it. The two lines under the bar say what comes in and what goes out each week. The last line says how many weeks it would take to clear the pile at today's pace. Collect's weeks count only the bills past their day. The grey part of its bar is billed and not yet due.

The Market card counts the asks that came in: bids invited and estimates requested, by value. The Sales card shows what went out and what came back, bids and estimates on their own lines. Won counts the bids marked won and the bids that became jobs. Both cards read by pace against the field, not by weeks of pile.

The Build card reads the jobs' percent complete. Built per week is each job's change in percent times its contract. Sold per week is the contract on the jobs created. The pile is the contract left to build on open jobs. A job with no percent is read as half done and drawn grey. Set its percent to make the reading true.

Under the cards, the **Jobs with no %** strip counts the open jobs with a contract and no percent. Press {{button:outline-amber|Set the %s}} to open the list, biggest contract first. Press {{button:outline|Set}} on a row to open the percent window the crews use on their schedule. Saving files a status report on the job, the way a crew's does. The Build card's grey shrinks right away, and the row moves to the bottom marked set. A set row stays on the list until the page reloads. When every open job with a contract has a percent, the strip says so.

The field's pace is read a second way, by hours. That is what the field earned on recorded time, the way the top line reads the week. The card uses the larger of the two and names the other. The Bill card's first line reads the same hours. When over a third of Build's pile is grey, Build takes the link only by a clear margin. Until then its badge says it reads on a thin percent.

The Bill card's pile is finished work not yet billed. On each working job that is the percent done times the contract, less what is billed or paid. A job marked ready to bill counts the whole remainder. A job with no percent takes the newest field report's answer. A working job with neither reads as half done and is drawn grey. The grey rule and the thin percent rule work the same way as on Build. The Bill card's second line counts every bill by the day it went out. A bill marked billed by hand counts on the day it was marked.

The stage with the most weeks reads red. That is the weakest link. A stage within a tenth of it reads as its pair. The stages after the link say they move with it. A card that says **not readable yet** waits on a later step of the app.

Press a card to read it. The pressed card has the red border.

## Sales, broken down

Press **Break it down** on the Sales card. A window opens on everything asked and not yet answered. Every number in it is expected dollars. Expected dollars are the ask times the asker's own win rate, faded past their answer pace. The headline says what was asked and what it is worth. One bold line names the calls this week and what they protect. Three tiles say what the pile is worth, what is at risk, and what thins the reading. The bar splits the pile into protected, at risk, evaporating and dead weight. A line under it counts the bids past the 90-day window, with a door to the Bid Board. Then one row per asker, ranked by what a call protects. Press **Ranked by expected dollars** to rank by open dollars instead. A note says who leads by open dollars when the two rankings disagree. Each row shows the open dollars, the wins, the answer pace, the expected dollars and where the asks stand. Press a row to open it. The row lists each bid with its age and says the one move. **Open the bid** opens that bid on the Bid Board. Everyone else is one row. The estimates are one row, with **Open Estimates** as the door. Under the rows, a strip reads the asks already decided. Won comes first, then lost by the reason on each bid. A red line counts the losses with no reason. Nothing records here. Answers land on the bid itself. Esc closes the window.

## Bill, broken down

Press **Break it down** on the Bill card. A window opens on one question. When the work finishes, does the bill go out that day? The headline is the money the reads can prove will not bill itself. One bold line under it says how much the office already called done waits on a send. The next line carries the card's two paces and its weeks. The pipe strip reads the window in five cells. Finished by the field, finished with no bill yet, billed, billed and not yet paid, and paid. This desk owns the first gap. The second gap is Collect's.

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

A card under the desk lists the four fixes people reach for first. Hire another plumber. Push for more bids. Add a field day. Cut overhead. Press one and the dial and the cards above show what it would do. One line under the press says what changed and whether the link moved. Cut overhead moves nothing above. That is the point. Press {{button:outline|back to today}} to put things back. The {{button:outline|?}} in the corner lists the other links' levers.

## The week's call

Under the cards sits the desk of the pressed stage. It says what the stage is, why it matters, how the Bridge reads it, and what it reads today. Below that are the moves the week would make. Tick the ones you mean and type an owner beside each. Press {{button:green|This is the link this week}} to record the call. The call keeps today's numbers, so Friday can read them again.

A recorded call holds the red on its stage for the week. Another stage takes it only when it reads clearly longer.

**Last week's call, against what moved** sits under the desk. It names the link, who called it and how many weeks running. Each move shows its number then and now, and whether it got done. The last line says what that means for this week. From Friday the card asks whether the link moved. Press {{button:green|It moved}} or {{button:red|It did not}}. The chip beside the date carries the answer.

## The Daily profit rate, opened

Press the **Daily profit rate** card. A panel opens under the row. The chart shows earned against costs by pay week. The bar is the net. A hatched week is missing hours that wait for approval. Under it, a waterfall shows where a day's money goes, from earned to the number on the card. A table says where each input is read from and what can make it wrong. Each row ends in its door. The last line is break-even. Press the card again or the {{button:outline|×}} to close it.

## Money owed and Crew hours, opened

Press **Money owed**. Owed to you reads by how late it is. Owed by you reads by when it falls due. A waterfall walks from cash through what is owed each way to net position. It then adds the finished work not yet billed. Press **Crew hours**. The chart stacks each week by what the app has read. Approved field hours are blue. Hours waiting for approval are hatched. Office hours are grey. A waterfall walks this week's hours from clocked to what the page reads. Both panels end in the table of sources. One line ties each to the link.

## The two charts, broken down

Press {{button:outline|break it down}} on the net position chart. A waterfall shows what moved it since the window opened. Cash, owed to you and owed by you each show their change. The cash row reads red when the chart's figure and the bank's disagree. Press {{button:outline|break it down}} on the cash chart. The waterfall walks from the bank today through the receipts and the bills to where the line ends. Each table ends in its doors.

## The people tables

Vectors reads in two groups. Field is who makes the contribution. Office & estimators is who does the billing, collecting and bids. A dev counts as office. Each group ends in a subtotal row. Rows sort by contribution, then by hours waiting.

Vectors by the day has three readings. Press {{button:outline|Profit}} for earned at the job's rate less the wage. Press {{button:outline|Revenue}} for what the day earned. Press {{button:outline|Cost}} for what the day cost in wages. The week column, the totals and the Field crew row follow the reading.

## The Monday sheet

Press {{button:outline|Monday sheet}} at the top of the page. The page becomes one screen. Three tiles carry a light each: contribution per week, net position, and cash. A tile for the weakest link carries the rule, the lit link, this week's call and last week's verdict. Under them sit the five moves for the week and the people lines. Press {{button:outline|Email me this sheet}} and the same screen lands in your own inbox. Press {{button:outline|Open the full Bridge}} to come back.

## Cash on hand comes from the bank

The page reads the bank's balance when it opens. Under the cash chart, the cash row says the balance and the time it was read. The accounts with money are named beside it. Accounts at zero are only counted. Press {{button:outline|Read again}} to read the bank once more. The cash line and the net position line start from that figure.

When the bank cannot be read, the row shows the reason. You then type today's balance in **Cash on hand today** and press {{button:outline|Set}}. The number is remembered with the date. On later days the page rolls it forward through the bank transactions since. Once the bank answers again, the typed figure steps aside. An amber line then says how far the typed figure drifted from the bank, if it did.

You set the **Floor** the same way. The floor is the cash level you never want to go under. The floor starts at $5,000.

## The top line: contribution per week

The page opens on **field contribution this week**. That is the number the company maximizes. Field contribution is what field hours earned minus what those hours cost in wages. The big number reads recorded time, so hours still waiting on approval count. An amber **≈** beside it means some of those hours still wait. Under it, **approved only** is the same week on what payroll paid.

The bars are the last eight pay weeks. A hatched bar is a week still waiting on approvals. The **Verdict** line reads the bars for you. It names the range the settled weeks ran. It also says when a low week is the approval pile and not the field.

Two lights sit under the bars. **Net position rises over 8 weeks** is green when the line is up since the window started. **Cash stays above the floor** is green when the forecast never dips under your floor. The cash light turns amber when the cash figure you typed is a week or more old.

:::example Reading the top line
+$38.3k ≈ this week so far on 317h recorded, approved only +$9.7k on 80h. The verdict says contribution ran $13.8k to $46.8k a week over the six settled weeks, and the last two read low only because 564h still wait on approval.
:::

## The three numbers under it

- **Daily profit rate**: earned per day minus costs per day, over the last 14 days. Costs are job costs plus overhead, the office's running cost, at the 90-day rate from People → Overhead. Job costs are field labor, purchases and supply invoices on jobs, and sub sheets. A sub sheet is a subcontractor's labor sheet.
- **Money owed**: owed to you, owed by you, finished work not yet billed, and the collections balance. Owed to you leaves collections out. The collections balance is written off for planning.
- **Crew hours**: approved field time in the last 7 days, office and bid time, and how much still awaits approval.

## Net position — last 8 weeks

The solid line is **cash + owed to you − owed by you**. The line ends at today's real number. The last 8 weeks are rebuilt from dated flows. The flows are bank transactions, invoices sent, payments received, and supply invoices dated and paid. The readout says where the line is today. The readout also says how much the line moved since the start of the window. You hover any day for the split.

## Truth check — does the paper agree with the bank?

The profit rate is an accrual reading: earned minus costs. Accrual means earnings and costs count on the day they happen, not when cash moves. Net position is what the bank and the ledgers actually did. Over the same 8 weeks, the two should tell one story. The **Truth check** panel puts the two side by side: **Profit on paper** and **Net position moved**. The panel splits the difference between the two figures exactly in two:

- **Earned but not invoiced**: work that earned on paper and hasn't been billed yet. This money is real, and the biggest lever on the page. You bill it and the net line catches up.
- **Costs the paper doesn't see**: what the bank and the supply ledger charged beyond what the profit rate counted. Under 15% of paper costs reads as agreement.

The sentence on the right is the verdict: *steer by the profit rate*, *bill it to see it*, or *not a number to steer by yet*. Under the verdict sit the rows that make the cost side dirty. Each row is sized where it can be. {{chip:yellow|186h awaiting approval}} is labor that payroll pays and the paper hasn't counted. {{chip:yellow|bank transfers unsorted}} is rent, insurance and trucks that hit the bank and never the paper. {{chip:yellow|open jobs assumed half done}} is earned dollars resting on a guess. Worked jobs with no contract price get a row too.

:::example Reading it
Profit on paper +$194k · net position moved −$3.4k · the $197k between them: +$180k earned but not invoiced, +$17k costs the paper doesn't see. The verdict says the profit is real on paper — bill it to see it — and the cost side is close enough to trust.
:::

A loan or an owner deposit is money in that isn't a customer payment. The Bridge shows that money as a negative cost. Payroll and sub labor count when the bank pays them, not when the hours are worked.

## People — who moved the number

Under the Truth check, a **People** strip holds the two person tables. The strip is closed when you first open the page. While closed, one line reads the pay week. It names the top two people on approved hours and who has hours waiting. It also says what was billed and collected. Press {{button:outline|Show the rows and the days}} to open it. This browser remembers your choice.

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

## This week

Beside Fix the reading, **This week** lists the moves that change the two lines. The biggest lever is first. Each move is sized on the right where it can be. Each move ends in the door that does it. The moves are these:

- bill the finished work, which opens Stages
- chase the late invoices the forecast leans on, which opens Billing
- approve the pending hours, which opens the approvals queue
- price the worked jobs with no contract price
- set % complete on the jobs assumed half done
- one more field day a week, and cut overhead 10%
- win a bid that is due soon

## Fix the reading

Under the top line, **Fix the reading** lists what makes the page read low or thin. Each row has three parts. The amber chip names the gap. The middle says what the gap moves. The link at the end opens the place that fixes it. The biggest mover is first. The gaps are these:

- unapproved hours, which move the top line and payroll
- a typed cash figure that drifted from the bank, or one typed when the bank could not be read
- jobs worked this window with no % complete, which are assumed half done
- worked jobs with no contract price, which earn $0
- unsorted bank transfers or card purchases
- bids sent with no value

Insurance, rent, and card bills aren't scheduled as bills yet. These bills arrive as bank transfers and only show once sorted.

:::example Reading a row
{{chip:yellow|585h unapproved}} moves the headline from +$9.7k to ≈ +$38.3k this week. Press **Approve** and the queue opens.
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
