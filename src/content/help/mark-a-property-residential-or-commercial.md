---
title: mark a property residential or commercial from the Pipeline
category: Office
roles: dev, master_technician, assistant, primary
keywords: residential, commercial, property kind, non-residential, badge, C, R, question mark, address, pipeline, stages, lien clock, notice deadline, homestead
---
You tap the small circle at the end of a job's address on Jobs → Pipeline. It says what kind of property the job is on.

The answer lives on the customer's property record. The lien screens use the same fact. A lien is the legal claim on a property for unpaid work. A residential property's § 53.056 notice is due a month sooner. The § 53.056 notice is the Texas form we send the owner and the GC for each unpaid month. So setting it here sets it for every job at that address.

## Reading the badge

At the end of the address's last line:

- {{button:amber|C}} is a **commercial** property.
- {{button:blue|R}} is a **residential** property.
- {{button:red|?}} means nobody has said yet. This is the one that wants you.

You hover any of them for the words. Some jobs have an address typed on the job rather than linked to one of the customer's saved properties. Those show the red **?** too. Picking an answer saves the address as a property on the customer. When the job already matches a saved property, the pick links the job to it instead. Either way the answer lands on that property. GC is short for the general contractor. A GC job with no owner on it keeps the property on the GC, the way Edit Job does. Only a job with neither a customer nor a GC shows no badge. There is nobody to keep a property on.

## Setting it

You tap the circle. Office roles can do this: dev, master, assistant and controller. A small card asks *What kind of property is 8507 Culebra Road?* with {{button:outline|Residential}} {{button:outline|Commercial}}. It is the same switch the Lien desk and Edit Job's Property record row use. You pick one and the badge changes at once. The property is saved. Every job at that address follows it. The job's lien clock reads the right deadline from then on. When the job had no saved property, the card says so: *Not one of Dudley Mason's saved properties yet*. Then the pick saves the address as a property on that customer. It links the job before it marks it.

:::example A ? on a service visit
HCP 863 at 628 Terrell Rd shows a red ?. Taunya taps it, picks Residential, and the badge turns to a blue R — on this job and on the other two jobs at the same address. The notice deadline in their Lien window moves up a month, as the law has it.
:::

Picked wrong? You tap the C or the R and pick the other one. A commercial pick also clears the property's Homestead tick. A homestead is an owner's own home, and a non-residential property cannot be one.
