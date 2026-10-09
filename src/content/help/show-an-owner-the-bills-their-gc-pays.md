---
title: show an owner the bills their GC pays
category: Office
roles: dev, master_technician, assistant, controller
keywords: owner sees $0, owner sees the bills, owner sees some bills, show them, stop showing, billed to the GC, billed to your builder, property owner, shared bill, next bills, lien notice, notice on your property, 53.056, all paid up
---
An owner's portal reads $0 while the GC pays the bills on their property. A switch for each property puts its open bills on the owner's portal, for their records.

## When the GC pays: show the owner their property's bills

Some jobs are billed to the GC, while the customer is the property owner. There, the owner's portal lists nothing, since they pay none of the bills. So the owner's portal reads **$0** and *all paid up*, even while the GC owes on their house. Beside the owner's 🌐 on the job's Pipeline row, a chip says so: {{chip:gray|☐ owner sees $0}}.

You click the chip. The app reads **every job at that property** with the same owner. The app asks *Show Umar Khan the bills at 9703 Lenox Hl?* The prompt lists each job, its open bills and what is open. A job not billed yet reads *no bill yet — shows once billed*.

{{button:blue|Show them}} puts every open bill the GC pays on the owner's portal, for their records. Those bills show no Pay button, and never count in the owner's balance. Every bill after that shows too. The chip turns {{chip:blue|☑ owner sees the bills}}. The same click again offers {{button:dark|Stop showing}}. Stop showing takes the open bills back off. Paid ones stay in their history.

{{chip:yellow|☐ owner sees some bills}} means only part is shared. The shared part can be a bill ticked by hand at Bill Customer. The shared part can also come from Edit Job's older *next bills* tick. The switch finishes the job.

The owner's 🌐 window lists the same thing under **On <owner>'s jobs, billed to someone else**. The window has one line per property, with the switch. The live preview under it re-reads when you flip it.

### When a lien notice has gone to the owner

The § 53.056 notice is the Texas form we send the owner and the GC for each unpaid month. A notice to the owner can be **recorded as sent**. The ways to record it are the run's *Record the run*, or *Already mailed? Record it…* on the Lien desk. Once the notice is recorded, the owner's portal shows it on its own. No switch is needed, since the owner already holds the paper.

The notice shows as a card headed *Notice on your property · mailed Sep 25, 2026*. The card has these:

- the address
- what the GC has not paid, and for which months
- that they did not hire us, and this is not a lawsuit
- what they may hold back
- the three clean ways to finish it. The GC pays us. Or the owner holds it back and calls. Or the owner pays us only with the GC's written okay, never a joint check. A joint check is one check made out to both the GC and us.
- a **Call** button with the signer's name and our number

A draft or a notice awaiting approval never shows. The page stops saying *all paid up*. Instead the page reads *Nothing is billed to you directly. Work on your property is billed to your builder*. The shared bills below read *On your property, billed to your builder*. Each noticed job reads *on the notice above*. When the job is paid off, the card goes.

## More on the portal

- The owner's link and the gear are in [share a customer their portal](/help/share-a-customer-their-portal).
- The rest of the owner's page is in [see what a customer sees on their portal](/help/see-what-a-customer-sees-on-their-portal).
