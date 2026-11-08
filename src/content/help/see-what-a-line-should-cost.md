---
title: see what a line should cost and tune it
category: Billing & Money
roles: master_technician, assistant
keywords: line budget, labor budget, materials budget, hours, margin, assumed, tuned, sliders, split, costs tab, where we are, project, brush, company split, cost rate, settings, learning line
order: 12
---
On a project, every line item carries what the company thinks it will cost. You see it under the line's name on the Bill tab. The owner can change it there with two sliders. The Costs tab adds the lines up and reads where the job stands.

## The quiet line under each price

Open the job from Jobs → Pipeline → {{button:outline|Edit}} → **Bill**. Find **① Line Items**. A job priced before the work is a project. Under each line's name sits one small grey line.

:::example Under Rough In, $24,000
≈ ▬▬▬▬ 240 h · $10,800 labor · $8,400 mat. · assumed
:::

The first mark says where the split came from. **≈ assumed** means the line reads the company's split for its kind. **✎ tuned** means the owner moved it. **◆ workbench** means the bid priced the line from these hours and parts. The line that carries a bid's price gets it at award. The bar is labor in blue and materials in orange. The words are the hours, the labor dollars and the materials dollars. The hours are the labor dollars at the company's cost rate.

Nothing here reaches a customer. A bill and a Stripe line show the price alone.

## Tune a line

Only the owner tunes a budget. Tap the quiet line and a panel opens under the line.

1. Drag the **Labor** slider. The hours and the labor dollars move with it.
2. Drag the **Materials** slider. It never passes what labor left.
3. Read **Margin, what is left** under the bar. It turns red under the company's target.
4. Press **Done**.

Every drag saves by itself. The line now reads **✎ tuned**. Press **Back to** and the split goes back to where it was when you opened the panel. On a tuned line, **Back to ≈ the company split** puts it back on the company's numbers.

Anyone else taps the quiet line and sees the same panel with the sliders held still.

## Brush one split across the job

A job often has several assumed lines that should read alike. Tune one, then carry it to the rest.

1. Open a line's panel and drag it where you want it.
2. Press **Brush onto the 3 other assumed lines**. The panel counts them for you.
3. Every one of them now reads **✎ tuned** with the same split.

**Undo** sits beside the words until you close the panel. It puts the other lines back on the company split. A workbench line or a line you already tuned is never brushed.

## Review the week's guesses

Once a week the Needs You card on your Dashboard counts the assumed lines on the projects awarded that week. The line reads *4 assumed lines on 2 projects awarded this week*.

1. Press {{button:outline|Review}}. A window lists each line with its job, its price and the split it reads.
2. Press {{button:blue|Looks right · stamp 4 lines}}. Each is stamped reviewed with your name and stays on the company split.
3. Or press **Tune** to open the first project and move the sliders.

A stamped line never asks again. A line you tune is off the list by itself.

## The company's splits and the cost rate

Open Settings → **Jobs & billing** → **Line budgets**. Only the owner changes it.

- Each stage kind has a **Labor** slider and a **Materials** slider. The margin is what is left. It turns red under the target.
- **Cost rate** is the burdened rate the hours use. The roster's own rate reads beside it. Press **Use the roster's rate** to take it.
- **Target margin** is the dashed mark on every bar.
- Pick a line size, such as $10,000, and every row reads itself out in dollars and hours.

Nothing changes until you press **Save**. The button names what it writes, such as *Save · 2 splits and the rate*. **Back to what you saved** drops the draft. Save moves only the lines still assumed. A workbench line or a line you tuned keeps its own numbers.

:::example The learning line
Your Any line lines ran 52% labor on the last 6 tunes, against the 45% default. {{button:outline|Use 52%}}
:::

After five tunes on one kind that sit off its default, the row offers the number they settled on. Nothing moves until you press it and then Save.

## Where we are on the Costs tab

Open the **Costs** tab. Under the baseline strip sits **Where we are**.

:::example The card on a $56,000 project
**Where we are** $6,200 of $44,800 spent · 14% of the budget — the job is 17% done · $1,416 kept so far

**Labor** $0 of $24,600 · 0% · 0 h of 547 h

**Materials** $6,200 of $20,200 · 31%
:::

The first line is spent against the whole budget, beside the job's percent done. Under it come a **Labor** bar and a **Materials** bar. Each fills with what was spent against its budget. Labor counts team and sub labor. Materials counts parts, card charges and supply house invoices. The dashed mark on each bar is the job's percent done. A bar turns red when its spend runs ten points past the work. Then comes one row per line with the same reading as the quiet line.

A line with no percent of its own says so. It never borrows the job's percent.

## Related

- To set a line In order or Any time, see *split a job into stages and bill stage by stage*.
- To read the rest of the Costs tab, see *read the cost and value timeline on a job*.
- To give the whole project its hours baseline, see [give a project its hours baseline at award](/help/give-a-project-its-hours-baseline).
