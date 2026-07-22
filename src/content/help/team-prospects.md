---
title: track and rank prospective hires
category: Office
roles: dev, master_technician, assistant, estimator
keywords: prospects, team, hiring, candidates, rank, crew, recruiting, hire, roles, columns, board
order: 40
---
The Prospects page has two pipelines: **Customers** (leads who might buy work) and **Team** (people who might join the crew). The Team tab is a board — one column for each role you're hiring for — so when a spot opens up you already know who to call first.

## Set up your role columns

Press {{button:blue|+ Add role}} and name the opening — Plumber, Apprentice, Office, whatever you're hiring for. Each role becomes a column on the board, and you can add more at any time.

:::example A three-role board
**Plumber (3)** &nbsp;·&nbsp; **Apprentice (1)** &nbsp;·&nbsp; **Office (2)**
:::

## Add candidates

Every column has its own {{button:outline|+ Add candidate}} button — the new person lands at the bottom of that role's ranking. Only the name is required; add phone, email, trade, source, and notes as you learn them. You can also change someone's column later from {{button:outline|Edit}} via the **Role column** picker.

## Rank within each role

Each column is its own ranked list — **#1 is your top candidate for that role**. Grab the ⠿ handle and drag a card up or down to re-rank, or drag it sideways into a different column to move the candidate to another role. The order saves immediately and everyone with access sees the same board.

## Keep it current

- Press {{button:outline|Talked today}} after a call or text — each card shows how long it's been since the last contact.
- Keep running impressions in the notes via {{button:outline|Edit}}.

## When a decision lands

- {{button:green|Hired}} — moves them to the collapsed **Hired** bucket below the board.
- {{button:outline|Passed}} — moves them to **Passed**, so the name and notes are still there next time they apply.

Neither is final: open the bucket and press **Back to active** to put someone back in the running — they rejoin at the bottom of their role's ranking.

## See which source is working

Fill in the **Source** field when you add candidates (it suggests spellings you've already used — pick from the list so the stats stay clean). The collapsible **Source success** section below the board then shows, per source, how many candidates came in, how many were hired or passed, and the **hire rate**:

:::example Reading the table
**Referral** — 6 candidates · 2 active · 3 hired · 1 passed · **75%** hire rate

**Job board** — 9 candidates · 4 active · 1 hired · 4 passed · **20%** hire rate
:::

The hire rate only counts decided candidates (hired ÷ hired + passed), so a brand-new source with nobody decided yet shows — instead of a misleading 0%.

## Removing a role column

A role column can be deleted only once **every candidate in it has been individually deleted** — including anyone in the Hired or Passed buckets still tagged with that role. Until then the column's ✕ stays disabled and tells you how many people are still assigned. This is deliberate: a column can't silently take candidates with it.

## Who can see this

The Team tab is granted **per person**, on top of normal Prospects access. If you don't see the tab, you haven't been granted it. A dev can turn it on for someone under {{icon:gear}} **Settings → Active accounts → Edit** with the **Can see Prospects → Team (hiring board)** checkbox.

## The four stages

Across the top of the tab: **Screen → Interview → Hire → Review** — live counts under each, and the stage you're on gets the blue box. Each stage is its own view:

- **Screen** — the sourcing board: role columns, drag-ranking, and the rating sliders. When someone's worth a call, hit {{button:blue|Advance}} on their card.
- **Interview** — the same role columns, now amber: each candidate shows a tap-to-call phone, the sourcing scores, and everyone's reviews. Anyone can {{button:green|Advance}} them to Hire (or send them Back to Screen).
- **Hire** — onboarding: every hire shows a row of red/yellow/green boxes for the company's checklist (collect the driver's license, signed contract, …). Tap a box to move it along: red (not started) → yellow (requested — you've asked and are waiting) → green (done); tapping again from green resets it. A {{chip:gray|🔗}} next to a box opens that item's document — the thing to share, or where the person finds their copy. A **n/N done** counter sits on each hire, and devs manage the checklist itself (questions, links, order) under **⚙ Onboarding settings** on this tab.
- **Review** — not about candidates at all: monthly reviews of your **current team**. See "Reviewing your current team" below.

## Interview calls

When a candidate looks promising, hit {{button:blue|Advance}} on their Screen card. They move to the **Interview** stage — the queue for a master or dev to actually call them:

- Their phone number is a **tap-to-call** button, with the last-contact stamp next to it ({{button:outline|Talked today}} updates it).
- After the call, hit {{button:outline|My review}} and leave **your own** three ratings plus remarks. Under each rating slider there's an optional comment box — say *why* you scored Ability, Drive, or Integrity the way you did, right where you set the number. Each reviewer gets exactly one review per candidate (open it again to revise). Everyone's reviews show on the row — sourcing scores, reviewer verdicts, and any per-rating comments side by side.
- Then decide: {{button:green|Advance}} (to Hire), **Passed**, or **Back to Screen** if they need more sourcing time.

## Hiring someone onto the roster

Advancing a candidate to **Hire** offers to add them straight to the **People roster** — pick Subcontractor or Helper and their name, phone, and email carry over. They appear under People → Users (External), ready for sub labor sheets and payments; when they get an app login later, use **Link account** there to tie it together.

## Candidate links

Add/Edit candidate has a **Links** list — as many as you need, each with its own type ("Indeed", "Resume", "LinkedIn", or anything you type) and URL. They show on the candidate's card as {{chip:gray|🔗 Indeed}}-style chips that open in a new tab, on both the Screen board and the Interview stage. The card's edit control is the small ⚙ gear in its top-right corner.

## Rating candidates

Open {{button:outline|Edit}} on any candidate and you'll find three 0–100 sliders under the contact fields:

- **Evidence of Exceptional Ability** (Talent / Problem-Solving)
- **Drive / Work Ethic** (Intrinsic Motivation)
- **Trustworthiness / Goodness of Heart** (Integrity)

Slide to score, or leave a dimension **unrated** — a candidate you haven't evaluated yet shows "—" rather than a misleading zero, and **clear** puts a rating back to unrated. Every board card shows the three scores as narrow bars at the bottom, so you can compare candidates at a glance while you drag-rank. The sliders are information only — your drag order stays the ranking.

## Reviewing your current team

The **Review** stage tab (after Hire) turns the same three dimensions on your existing team — every active account, every role.

**Rate** deals you a card per person: their name, role, and the last 5 jobs they clocked approved time on, then the three sliders with an optional "why this score?" note under each. {{button:blue|Save … review, go to next}} saves the card and jumps to the next person you haven't rated this month; when everyone's done the button turns green — {{button:green|All rated! Go to Reflect}}. You can also flip freely with the **◀ ▶** buttons (or arrow keys), or jump straight to someone with the dropdown.

:::example One review per person per month
Reviews are monthly: saving again in the same month updates that month's review; a new month starts a fresh one. Over time that builds a track record — the card reminds you when you last rated each person.
:::

**Reflect** shows the whole picture: for each person, every reviewer's latest scores and notes side by side, a team **average** of the three dimensions, and a **History** toggle with the earlier months. Everyone who can see the Team board sees everyone's reviews — no blind reviewing, same as candidate reviews.
