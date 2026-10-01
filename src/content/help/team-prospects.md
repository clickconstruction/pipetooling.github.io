---
title: track and rank prospective hires
category: Office
roles: dev, master_technician, assistant, estimator
keywords: try out, trial helper, try-out, prospects, team, hiring, candidates, rank, crew, recruiting, hire, roles, columns, board, roster, office, add to roster, onboarding
order: 40
---
The Hiring tab on Prospects is a board of people who might join the crew. When a spot opens up, you already know who to call first.

The Prospects page has two pipelines, or lists. **Customers** are leads who might buy work. **Hiring** is people who might join the crew. The Hiring board has one column for each role you are hiring for.

If Hiring is the only pipeline you hold, the **Prospects** link in the menu opens straight onto the board. If you work both, it reopens on the tab you used last. The first time, that is the calling deck.

## Set up your role columns

You press {{button:blue|+ Add role}} and name the opening. It might be Plumber, Apprentice, Office or whatever you are hiring for. Each role becomes a column on the board. You can add more at any time.

:::example A three-role board
**Plumber (3)** &nbsp;·&nbsp; **Apprentice (1)** &nbsp;·&nbsp; **Office (2)**
:::

## Add candidates

Every column has its own {{button:outline|+ Add candidate}} button. The new person lands at the bottom of that role's ranking. Only the name is required. You add phone, email, trade, source and notes as you learn them. To change someone's column later, you open {{button:outline|Edit}} and use the **Role column** picker.

## Rank within each role

Each column is its own ranked list. **#1 is your top candidate for that role.** You grab the ⠿ handle and drag a card up or down to re-rank it. You drag a card sideways into another column to move the candidate to that role. The order saves at once. Everyone with access sees the same board.

## Keep it current

- You press {{button:outline|Talked today}} after a call or text. Each card shows how long it has been since the last contact.
- You keep running impressions in the notes through {{button:outline|Edit}}.

## When a decision lands

- {{button:green|Hired}} moves them to the collapsed **Hired** bucket below the board.
- {{button:outline|Passed}} moves them to **Passed**. Their name and notes are still there the next time they apply.

Neither is final. You open the bucket and press **Back to active** to put someone back in the running. They rejoin at the bottom of their role's ranking.

## See which source is working

You fill in the **Source** field when you add a candidate. It can be a job board's name or a pasted link to their profile on that board. It can also be "referral", "walk-in" or whatever you have. The field suggests names you have already used.

Pasted links group under their board on their own. Every Indeed candidate link counts as **Indeed**, however long the link is. "indeed.com", "Indeed ad" and "INDEED" all land in the same row.

The collapsible **Source success** section sits below the board. For each source it shows how many candidates came in. It shows how many were hired or passed. It also shows the **hire rate**.

:::example Reading the table
**Referral** — 6 candidates · 2 active · 3 hired · 1 passed · **75%** hire rate

**Job board** — 9 candidates · 4 active · 1 hired · 4 passed · **20%** hire rate
:::

The hire rate counts only decided candidates. It is hired divided by hired plus passed. So a brand-new source with nobody decided yet shows a dash, not a misleading 0%.

## Removing a role column

You can delete a role column only once **every candidate in it has been deleted one by one**. That includes anyone in the Hired or Passed buckets still tagged with that role. Until then the column's ✕ stays disabled. It tells you how many people are still assigned. This is on purpose. A column can't silently take candidates with it.

## Who can see this

The Hiring tab is granted **per person**, on top of normal Prospects access. If you don't see the tab, you have not been granted it.

A dev turns it on for someone on that person's desk. You open the desk from People → Users. Under **Access & account**, the dev ticks the **Hiring board** box on the **Extra access** row.

**If a column was shared with you** instead, the Hiring tab shows just the columns shared with you. It shows them on **Screen, Interview and Try-out** only. There is no Hire or Review stage, no Sources table and no other column.

You can add and edit candidates and mark Talked today. You can drag to re-rank, press Advance and press Try out. The office presses Hire, Pass and Keep trying. See "Sharing a column with an assistant" below for what the person sharing sees.

## Sharing a column with an assistant

You can hand **one role column** to someone who has Prospects access but not the Hiring board. That is the assistant who calls candidates and feeds helpers to the masters. They do not see the rest of the board.

On the column header, you open {{button:outline|⋯}}, choose **Share with…** and tick their name. The list is everyone with Prospects access who does not already hold the board. Full holders are not listed, because they already see everything.

Each tick takes effect at once. There is no Save. Afterwards the header wears a {{chip:blue|shared with 1}} chip. You untick a name to take the column back.

:::example What the person you shared with can do
See that column's cards on **Screen, Interview and Try-out** · add and edit candidates · Talked today · drag-rank · Advance · Try out.

Never: Hire, Pass, Keep trying, move a card to another column, delete a candidate, rename or delete the column, or see Hire, Review, the Sources table or any other column. These are refused by the database, not just hidden.
:::

Sharing never ticks their **Hiring board** box. A dev sees which columns each account holds on the person's desk. It is on the **Extra access** row, in the line *Hiring columns shared with them*.

## The five stages

Across the top of the tab are five stages: **Screen → Interview → Try-out → Hire → Review**. Each one shows a live count under it. The stage you are on gets the blue box. Each stage is its own view.

- **Screen** is the sourcing board, where you find and rank candidates. It has the role columns, drag-ranking and the rating sliders. When someone is worth a call, you press {{button:blue|Advance}} on their card.
- **Interview** has the same role columns, now amber. Each candidate shows a tap-to-call phone, the sourcing scores and everyone's reviews. Anyone can {{button:green|Advance}} them to Hire, or send them Back to Screen.
- **Try-out** holds helpers who are working on jobs while the leaders decide whether they want them back. See "Trying a helper out" below.
- **Hire** is onboarding, the steps that get a new hire set up. Each hire gets the company's checklist as a row of boxes. Every Hire card also carries {{button:outline|Add to roster}}. See "Hiring someone onto the roster" below.
- **Review** is not about candidates at all. It holds monthly reviews of your **current team**. See "Reviewing your current team" below.

### The onboarding checklist

Every hire shows a row of red, yellow and green boxes for the company's checklist. The items might be the driver's license and the signed contract. You tap a box to move it along. Red means not started. Yellow means requested, so you have asked and are waiting. Green means done. Tapping again from green resets it.

A {{chip:gray|🔗}} next to a box opens that item's document. That is the thing to share, or where the person finds their copy. Each hire has an **n/N done** counter.

Devs manage the checklist itself under **⚙ Onboarding settings** on this tab. They set the questions, the links and the order. Until a dev adds items, the hire list shows without boxes. Only the dev sees the *No onboarding items defined yet* note, because only the dev can add them.

## Interview calls

When a candidate looks promising, you press {{button:blue|Advance}} on their Screen card. They move to the **Interview** stage. That is the queue for a leader or dev to actually call them.

- Their phone number is a **tap-to-call** button, with the last-contact stamp next to it. {{button:outline|Talked today}} updates the stamp.
- After the call, you press {{button:outline|My review}}. You leave **your own** three ratings plus remarks. Under each rating slider is an optional comment box. You say *why* you scored Ability, Drive or Integrity the way you did, right where you set the number. Each reviewer gets exactly one review per candidate. You open it again to revise it. Everyone's reviews show on the row. The sourcing scores, the reviewer verdicts and any per-rating comments sit side by side.
- Then you decide. You press {{button:green|Advance}} to send them to Hire. Or you press **Passed**. Or you press **Back to Screen** if they need more sourcing time.

## Trying a helper out

A helper is judged on a job, not on a phone call. So every Screen and Interview card in a **helper column** carries {{button:green|Try out}}. The helper columns are Helper, Apprentice and Laborer. One press does two things.

- It makes the helper an **app login** from the name and email on the card. It is a regular Helper account. So Dispatch can schedule them, and they can clock in like anyone else. They sign in with the **emailed link** on the sign-in page. Nobody has to hand them a password.
- It moves the card to the **Try-out** stage. The card is stamped *on trial since* that day. It stays linked to the person.

:::example The card needs an email first
{{button:green|Try out}} refuses a card with no email — *Add an email first — the helper signs in with it to clock in.* Open {{button:outline|Edit}}, add it, and press Try out again.
:::

While the helper is on trial, **whoever ran their job each day is asked whether they would take them again**. That is a master, or a sub or helper cleared to run a job. The app reads who that was off the schedule and the clock. They answer on their own Dashboard, by name. See [how do I say whether a trial helper worked out](/help/see-if-a-helper-worked-out).

You don't set anything up for that. You put the helper on a crew in Dispatch as you would anyone.

### Reading the Try-out card

Each card on the Try-out stage keeps the tally. It shows how many days the helper has clocked. It shows **each leader's latest word, by name**, with the note they left. A small *sub* or *helper* tag shows when the leader is not a master. Anyone who was asked and has not said reads *not answered yet*.

:::example A card after four days
**4 days worked · 3 leaders**

**Mike** ✓ “careful, a bit slow” · **Jake** sub ✓ “kept up all day” · **Luis** ✓

{{chip:green|3 leaders said yes — hire?}}
:::

The line under the tally says what the numbers suggest, and nothing more. The office still presses the button.

- {{chip:green|3 leaders said yes — hire?}} means three said yes and nobody said no.
- {{chip:red|2 said no — pass?}} means two said no.
- {{chip:yellow|3 said yes, 2 said no — talk to them before you decide}} means the leaders disagree.
- {{chip:yellow|waiting on Mike}} means a leader was asked yesterday or today and has not answered yet.
- {{chip:yellow|1 yes — needs another leader}} means not enough has been said yet. You put the helper with someone else.
- {{chip:yellow|no days yet — ask Dispatch to put them on a crew}} means nobody has scheduled them.

Some days the helper works with **nobody who could run the job**. The card calls out each of those days. It reads like *Wed, Sep 16 at J258 · Oak St — no lead listed; ask Dispatch to put a master on the block*. Nobody was asked that day, so it counts for nothing. You fix the block, and the next day counts.

On the Try-out stage each card has three decisions. They are the office's.

- {{button:green|Hire}} ends the try-out. The card moves to **Hire** with the onboarding checklist. The person stays exactly as they were, a regular helper.
- {{button:outline|Keep trying}} shows only while the line asks a question. It means *not yet*. Nothing changes for the helper. The card notes who pressed it and when. The suggestion comes back as soon as a new verdict lands.
- **Pass** ends the try-out. The card moves to Passed with its notes. Their login stays until someone archives it from their desk with {{button:red|Archive…}}. That is a dev, a controller or a pay-approved leader.

{{button:blue|Advance}} is still there for anyone who wants the Interview call first. An office column never shows Try out.

## Hiring someone onto the roster

When you advance a candidate to **Hire**, the app offers to add them straight to the **People roster**. Their name, phone and email carry over. The **Roster kind** is picked for you from the role column they were in.

An "Office Manager" column suggests Office / assistant. "Apprentice" suggests Helper. A trade role stays Subcontractor. You change it if the guess is wrong. The list is Subcontractor, Helper, Office / assistant, Estimator, Superintendent, Primary and Leader technician.

They appear under People → Users, with subs and helpers under External. They are ready for labor sheets and payments. When they get an app login later, you use **Link account** there to tie the two together.

:::example Missed the prompt?
Pressing {{button:outline|Not now}} is not final. Every card on the Hire stage has an {{button:outline|Add to roster}} button that reopens the same prompt, so an interrupted hand-off picks up where it left off — no need to bounce someone back to Interview and re-advance them.
:::

## Candidate links

Add/Edit candidate has a **Links** list. You add as many links as you need. Each one has its own type and its web address. The type can be "Indeed", "Resume", "LinkedIn" or anything you type.

The links show on the candidate's card as {{chip:gray|🔗 Indeed}}-style chips. Each chip opens its link in a new tab. They show on both the Screen board and the Interview stage. The card's edit control is the small ⚙ gear in its top-right corner.

## Rating candidates

You open {{button:outline|Edit}} on any candidate. Under the contact fields are three sliders that run from 0 to 100.

- *Evidence of Exceptional Ability (Talent / Problem-Solving)*
- *Drive / Work Ethic / Intrinsic Motivation*
- *Trustworthiness / Goodness of Heart / Integrity*

The cards call them Ability, Drive and Integrity. You slide to score, or you leave a dimension **unrated**. A candidate you have not rated yet shows a dash rather than a misleading zero. You press **clear** to put a rating back to unrated.

Once a candidate has at least one score, their board card shows the three as narrow bars at the bottom. So you can compare candidates at a glance while you drag-rank. A card with no scores yet shows no bars. The sliders are information only. Your drag order stays the ranking.

## Reviewing your current team

The **Review** stage tab comes after Hire. It turns the same three dimensions on your existing team. That is every active account, in every role.

**Rate** deals you a card per person. The card shows their name, their role and the last 5 jobs they clocked approved time on. Then come the three sliders, with an optional *why this score?* note under each.

{{button:blue|Save … review, go to next}} saves the card and jumps to the next person. Anyone **due** for your review comes first. Due means no review from you in 30 days or more. Next comes anyone you have not rated this month. When everyone is done, the button turns green and reads {{button:green|All rated! Go to Reflect}}.

You can also flip freely with the **◀ ▶** buttons or the arrow keys. Or you jump straight to someone with the dropdown. Due people are marked *● … · due* there.

Above the deck, next to your average, a pill shows where you stand. It reads {{chip:yellow|● 2 due ›}} when reviews are waiting. It reads {{chip:green|✓ Caught up · next in 5d}} when they are not. You tap it either way for **Upcoming reviews**. That shows who is due now and how many days until each next person comes due. Tapping a person opens their card.

When you tap the **Team reviews due** reminder on your Dashboard, the deck opens on the person it named. So you can rate them and keep going without hunting through the list.

:::example One review per person per month
Reviews are monthly: saving again in the same month updates that month's review; a new month starts a fresh one. Over time that builds a track record — the card reminds you when you last rated each person.
:::

You don't have to remember how often to review. When teammates go 30 days or more without your review, a **Team reviews due** notice appears. It shows on your Dashboard and in the Dispatch Mode Inbox. You tap it to land right here. A dev can change the 30-day interval under Settings → Your dashboard.

**Reflect** shows the whole picture. For each person it shows every reviewer's latest scores and notes side by side. That includes the office's reviews. Since v2.3614 it also includes the ratings a **supervisor** left from *Rate my crew* on their Dashboard. Those rows carry a green chip. They are by name, from someone who was on the job with them that month.

Each person also gets a team **average** of the three dimensions. The card shows how long they have been **at the company**. A **History** toggle shows the earlier months.

The **Group by** toggle at the top switches how each card lists the feedback. {{chip:blue|Reviewer}} keeps each reviewer's three scores and notes together. That is the classic view. {{chip:blue|Dimension}} regroups the same feedback under **Ability**, **Drive** and **Integrity** headings. Under each heading is every reviewer's score and comment for that one dimension, highest score first. The team average sits next to the heading. It is handy when you want to read everything people said about one thing, like someone's Drive.

You **click a person's card** to expand a chart of their three ratings over time. Each point is the team's average for that month. Everyone who can see the Hiring board sees everyone's reviews. There is no blind reviewing, the same as with candidate reviews.

Some people grade tough and some grade easy. So Reflect also corrects for it. The **Reviewer tendencies** panel shows each reviewer's own average. Every score carries a small *+6 vs their norm* anchor. Each person gets a blue **adj** average. It re-centers every reviewer's scores around the company norm. A reviewer needs at least 3 people rated before their correction kicks in. While you rate, the deck shows **your own running average**. That way you can keep yourself calibrated.

Below the office average, a muted **Crew** line shows what that person's teammates said about them at clock-out. It averages Ability, Drive and Integrity, and says how many rated. It appears once two teammates have rated someone. It never carries a name. Crew ratings are anonymous to everyone but the developer. You read it against the office line. A wide gap is usually the most useful thing on the card.

Each person also gets a **composite**. That is the three corrected ratings blended into one number. Recent months count more than old ones. Someone with fewer than two reviewers shows *insufficient data* instead of a misleading score.

**Leaderboard** turns the composites into the hiring signal. Every role is ranked from best to worst, with the role's average. A red **weakest** chip shows once a role has at least two members who can be ranked. A **Replace-priority focus** strip at the top lists the lowest composites company-wide. It has a button straight to the hiring board. A weak spot on the leaderboard is a role to start sourcing for.

Devs can tune how much each dimension counts with the {{icon:gear}} gear. There they can also tick **Crew lane counts as a reviewer**. That lets each person's crew average join the composite as one more reviewer. It stays off until someone switches it on.
