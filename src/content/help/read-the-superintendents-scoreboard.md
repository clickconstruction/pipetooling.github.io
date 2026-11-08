---
title: read the superintendents' scoreboard and set the bonus share
category: Office
roles: dev, master_technician, superintendent
keywords: scoreboard, superintendent, bonus, labor kept, hours saved, baseline, sign-off, certified percent, days ahead, planned finish, share, people review
order: 40
---
The scoreboard pays a superintendent for finishing under the hours his project was awarded with. One row per superintendent, one month at a time. The number the office pays on is the same number he reads on his phone.

## The rule in six lines

- **Percent.** The office's own sign-off on the job's percent counts. The crew's percent is provisional and never scores.
- **Baseline.** The hours and labor dollars frozen at award. Refresh from bid never moves the score.
- **Hours.** The team's clock hours at the burden factor. A stage a sub performs counts on the sub's sheet hours.
- **Kept.** The labor budget earned at the signed-off percent, minus the actual labor cost. The bonus is a share of it. A project over its baseline pays nothing and owes nothing back.
- **Days.** The planned finish frozen at award against the finish at this pace. Its own figure, never paid on.
- **Not scored.** A project awarded on the book's hours is a guess. It waits for a bid or typed baseline.

## Read the board

1. Open People → **Review** → **Scoreboard**. A dev and a pay-approved master see it.
2. Pick the month with the arrows.
3. Read each row. It shows the jobs signed off, hours used of hours earned, days against the plan, labor kept and the bonus.
4. Press a name to open the jobs under it. A job that could not score says why.

:::example One row
Pat Sample · 1042 Harbor Lane Offices · 48% · 206 h / 248 h · 42 h under the baseline · 1 day ahead of the plan · $2,130 kept · $213 · 10% of the labor kept
:::

Labor kept shows only to someone with payroll access. Everyone on the board sees hours, days and the bonus.

## Sign off a percent

The score moves when the office sets the percent. Open the job and set it from the Dashboard's **Update % done** or the Bridge's percent prompt. That press is the sign-off. The scoreboard reads the newest one in the month.

## What a superintendent sees

On his project's card in Job Mode, under the proof line, one line reads *Scored this month: 42 h under the baseline · 1 day ahead of the plan · bonus $213*. He sees his own row only. He never sees a wage or another superintendent's figures. Before the office signs off, the line says what it waits on.

## Set the share

1. Open Settings → **People** → **Superintendent bonus**.
2. Type the share of the labor kept, as a percent.
3. Press {{button:blue|Save the share}}.

The board reads the new share at once. The period is the month and the sign-off is the office's. Those two are fixed by the owner's call and are not settings.

## Good to know

- A superintendent is known from the project's assigned superintendents, or the GC project's superintendent.
- A job with no hours baseline at award is not on the board. Give it one on the Costs tab first. See [give a project its hours baseline at award](/help/give-a-project-its-hours-baseline).
- Every signed-off job also feeds the labor book, so the next baseline is sharper.
