---
title: bring a bid's stages onto its job
category: Office
roles: dev, master_technician, assistant, controller
keywords: stages, stage lines, bring the bid's stages, existing job, keep one line, bid price, rough in, top out, trim set, final, line items, new job, won bid, carry over, as stages, as one line, start at $0, 30/30/30/10, 40/40/20, any time, in order, schedule of values, labor tab, hours, pace card, projects board, stage checklist
order: 73
---
When you open a job from a won bid, the app asks how the price comes onto the job. You can bring it as stages, as one line, or not at all. Stages give the pace card, the Projects board and the stage checklists something to read.

## Answer the question

1. Open **New Job** from the won bid.
2. A window asks how the price should come onto the job. It names the figure.
3. Pick one of the three answers below.
4. Press the blue button. It names what it will do.

- **As stages.** One line for each stage, such as Rough In, Top Out, Trim Set and Final. The lines add up to the price.
- **As one line.** One line named *Bid price* for the whole figure.
- **Start at $0.** Nothing comes over. You type the lines yourself.

**Cancel import** closes the window and fills nothing in.

Nothing is saved yet. The lines sit in **Line Items**, where you can change any name or amount. They are saved when you press {{button:blue|Create Job}}.

:::example A bid won at $48,000
How should $48,000 come onto the job?

Rough In · 211 h · $14,400.00

Top Out · 150 h · $14,400.00

Trim Set · 122 h · $14,400.00

Final · no hours · $4,800.00

{{button:blue|Bring 4 stages · $48,000}}
:::

## Where the dollars come from

The chips above the lines pick the split. Press a chip to change it.

- **Commercial 30/30/30/10.** Thirty percent each for Rough In, Top Out and Trim Set. Then ten percent for Final.
- **Residential 40/40/20.** Forty percent each for Rough In and Top Out. Then twenty percent for Trim Set.
- **The bid's schedule.** This chip shows only when the bid has its own schedule of values. It starts lit, since it is what the customer saw.

With no schedule on the bid, a residential customer starts on 40/40/20. Everyone else starts on 30/30/30/10.

## Where the hours come from

Each stage's hours come from the bid's Labor tab. The window says so under the lines. In Line Items those lines wear a ◆.

A line keeps its labor as a whole percent of its price. So a line can read an hour or two off the bid's own figure.

Sometimes the bid cannot give hours. The window then says why, such as hours on too few Labor rows. Those lines read the company's usual split and wear a ≈.

## What changes on the job

- The Pipeline row draws the job as stages.
- Rough In, Top Out and Trim Set each take the company's stage checklist, once the office has written its questions. From then the row reads **not ready** until the crew answers.
- The superintendent's pace card draws the stages.
- Every line arrives **Any time**, so nothing about billing changes. Tap a line's badge to make it **In order**.
- The hours frozen at award stay as they are. See [give a project its hours baseline at award](/help/give-a-project-its-hours-baseline).

## On a job that already exists

A job opened before this, or opened as one line, can still take its stages.

1. Open the job and press **Bill**.
2. Beside **Multiple Segment Generator**, press the link that names the bid, such as **Bring B482's stages**.
3. Pick the split with the chips.
4. Press the blue button.

The stages take the place of the one line. The job saves its lines as you change them, so this is saved with it. **Keep one line** closes the window and changes nothing.

The link shows only on a job from a bid that is Waiting or Working and still has one line. It also needs nothing to hang on that line. When something does, a short line under **Line Items** says what. It can be a bill, a pay application or the crew's percent. It can be a checklist answer, stage dates, a trip or a tuned budget. Use **+ Add line item** to add a stage on those jobs.

For the rest of the win, see [turn a won bid into a job](/help/turn-a-won-bid-into-a-job).
