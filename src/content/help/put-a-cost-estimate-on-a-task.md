---
title: put a cost estimate on a task
category: Office
roles: dev, controller
keywords: cost, estimate, price, hours, rate, calculator, gold chip, stage total, roadmap, budget, actual, took, sign off, calibration
order: 44
---
Devs and the controller can price any checklist or roadmap task: who would do it, at their hourly rate, for how many hours. Estimates show as **gold dollar chips** and roll up so a whole stage — or the whole roadmap — reads as money. Nobody else sees any of it.

## Add or change an estimate

1. Find the **🖩 calculator** on a task row — on **Checklist → Review** (expand a person, or a stage in Goals) and on the **Roadmap → Plan** view's task rows.
2. Pick **who does it** — their **$/hour** fills in from People → Pay config (edit it if needed; salaried people may need a number typed in).
3. Set **hours** — quick-picks (0.5h–8h) or type — and watch the math: *2h × $50/hr → $100*.
4. {{button:blue|Save cost}}. The calculator becomes a gold **$100** chip; tap the chip any time to change or **Remove** the estimate.

The rate is **snapshotted** when you save — a later pay change doesn't rewrite old estimates.

## Read the roll-ups

- **A person's queue** — their Review header adds a gold total: "4 outstanding · **$300**".
- **A stage** — Plan-view stage headers total their open tasks: **$300+**. The **+** means only some tasks are costed, so it's a floor, not the full price.
- **The roadmap** — the Plan header shows what's left: "1 of 89 tasks done · **$400+** left".

:::example Pricing a stage before committing
Open Plan, cost the six tasks in **Drill a well** at the driller's rate, and the stage header reads **$1,450** — now you know what saying "go" costs before anyone starts.
:::

## Record what it really took

When a costed task lands in the **sign-off queue**, its row shows the estimate and a *Took about* strip — tap the band that fits (the amber one is "as estimated") and it's recorded; tap it again to clear. Leaving the strip untouched records nothing, and sign-off itself never waits on it. Missed one? Open the task's gold chip any time — the cost dialog has an **Actually took** row for late entries and corrections.

Once recorded, the chip gains a truth tag — <span style="color: #dc2626;">**was $200 · ×2**</span> when it ran over, green when it ran under.

## Let the estimates learn

After five tasks have actuals, the numbers start talking back:

- Writing a new estimate shows a gentle hint: *"Estimates have really run ×1.6 — 2h may be closer to 3h ($150)."* It never changes your number.
- The Review tab's sign-off section shows a one-line strip: your overall multiplier and the people whose work runs hottest.

:::example Two weeks in
After a dozen sign-offs the strip reads **×1.4 — estimates run hot**. Next time you'd guess 2h, guess 3 — or just watch the hint do the nudging.
:::
