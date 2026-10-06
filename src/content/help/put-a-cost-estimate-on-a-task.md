---
title: put a cost estimate on a task
category: Office
roles: dev, controller
keywords: cost, estimate, price, hours, rate, calculator, gold chip, stage total, roadmap, budget, actual, took, sign off, calibration
order: 44
---
Devs and the controller can price any checklist or roadmap task. Nobody else sees any of it.

An estimate says who would do it, at their hourly rate, for how many hours. Estimates show as **gold dollar chips**. They roll up, so a whole stage or the whole roadmap reads as money.

## Add or change an estimate

1. Find the **🖩 calculator** on a task row. It sits on **Checklist → Review** when you expand a person. It sits in the **Roadmap** page's Goals when you unfold a stage. It also sits on the **Roadmap → Plan** view's task rows.
2. Pick **who does it**. Their **$/hour** fills in from People → Pay config. Edit it if needed. Salaried people may need a number typed in.
3. Set **hours** with the quick-picks from 0.5h to 8h, or type a number. Watch the math: *2h × $50/hr → $100*.
4. Press {{button:blue|Save cost}}. The calculator becomes a gold **$100** chip. Tap the chip any time to change or **Remove** the estimate.

The rate is **snapshotted** when you save, so it is kept as it was that day. A later pay change doesn't rewrite old estimates.

## Read the roll-ups

- **A person's queue**: their Review header adds a gold total, like *4 outstanding · $300*.
- **A stage**: Plan-view stage headers total their open tasks, like **$300+**. The **+** means only some tasks are costed. So it's a floor, not the full price.
- **The roadmap**: the Plan header shows what's left, like *1 of 89 tasks done · $400+ left*.

:::example Pricing a stage before committing
Open Plan, cost the six tasks in **Drill a well** at the driller's rate, and the stage header reads **$1,450** — now you know what saying "go" costs before anyone starts.
:::

## Record what it really took

A costed task lands in the **sign-off queue**. Its row shows the estimate and a *Took about* strip. You tap the band that fits, and it's recorded. The amber band means "as estimated". Tap it again to clear. Leaving the strip untouched records nothing, and sign-off itself never waits on it. Missed one? Open the task's gold chip any time. The cost dialog has an **Actually took** row for late entries and corrections.

Once recorded, the chip gains a truth tag. It reads <span style="color: #dc2626">***was $200 · ×2***</span> when it ran over, and green when it ran under.

## Let the estimates learn

After five tasks have actuals, the real time taken, the numbers start talking back:

- Writing a new estimate shows a gentle hint: *"Estimates have really run ×1.6 — 2h may be closer to 3h ($150)."* It never changes your number.
- The Review tab's sign-off section shows a one-line strip: your overall multiplier and the people whose work runs hottest.

:::example Two weeks in
After a dozen sign-offs the strip reads **×1.4 — estimates run hot**. Next time you'd guess 2h, guess 3 — or just watch the hint do the nudging.
:::
