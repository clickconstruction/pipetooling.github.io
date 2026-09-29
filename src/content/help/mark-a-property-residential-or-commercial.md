---
title: mark a property residential or commercial from the Pipeline
category: Office
roles: dev, master_technician, assistant, primary
keywords: residential, commercial, property kind, non-residential, badge, C, R, question mark, address, pipeline, stages, lien clock, notice deadline, homestead
---
Every job's address on Jobs → Pipeline ends in a small circle that says what kind of property it is. The answer lives on the customer's property record — the same fact the lien screens use, because a residential property's § 53.056 notice is due a month sooner — so setting it here sets it for every job at that address.

## Reading the badge

At the end of the address's last line:

- {{button:amber|C}} — a **commercial** property.
- {{button:blue|R}} — a **residential** property.
- {{button:red|?}} — nobody has said yet. This is the one that wants you.

Hover any of them for the words. A job whose address was typed on the job rather than linked to a customer's saved property shows no badge — there is no property record to keep the answer on; link the property from Edit Job first.

## Setting it

Tap the circle (office roles: dev, master, assistant). A small card asks *What kind of property is 8507 Culebra Road?* with {{button:outline|Residential}} {{button:outline|Commercial}} — the same switch the Lien desk and the customer's property sheet use. Pick one and the badge changes at once; the property is saved, every job at that address follows it, and the job's lien clock reads the right deadline from then on.

:::example A ? on a service visit
HCP 863 at 628 Terrell Rd shows a red ?. Taunya taps it, picks Residential, and the badge turns to a blue R — on this job and on the other two jobs at the same address. The notice deadline on their Billed rows moves up a month, as the law has it.
:::

Picked wrong? Tap the C or the R and pick the other one. A commercial pick also clears the property's Homestead tick, since a non-residential property cannot be a homestead.
