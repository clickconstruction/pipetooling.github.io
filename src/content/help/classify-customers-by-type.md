---
title: classify customers as commercial or residential in one sitting
category: Office
roles: dev, master_technician, assistant, controller
keywords: customer type, commercial, residential, no customer type, classify, untyped customers, bulk classify
order: 43
---
The Commercial and Residential filters only work if customers have a type. The classifier sweeps through every untyped customer at once, instead of opening each one.

## Run the classifier

1. Go to **Customers**. The stat band at the top shows how many customers have **No customer type**.
2. Click **Classify →** in that cell.
3. Every untyped customer appears with a pre-selected suggestion. Names with business words suggest {{chip:yellow|Commercial}}. Business words are LLC, Contracting, City of, Management and more. Everything else suggests {{chip:blue|Residential}}. The matched word shows next to the name so you can see why.
4. Flip any suggestion that looks wrong, then click {{button:blue|Apply}}.

:::example Nothing happens without you
The suggestions are only pre-selections — no types are saved until you press Apply, and Cancel walks away without changing anything.
:::

## After applying

The stat band's untyped count drops to zero. It reads *all classified 🎉*. The **Commercial** and **Residential** filters now cover everyone. New customers can be typed on their edit form as usual.
