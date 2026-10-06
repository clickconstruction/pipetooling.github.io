---
title: file a lien and never miss its deadlines
category: Billing & Money
keywords: mechanic's lien, lien affidavit, notice of claim, 53.056, county clerk, recording number, serve, deadline, filing window, release of lien, homestead
roles: dev, master_technician, assistant, controller
---
When a demand letter does not shake the money loose, Texas gives you a lien. But only if the paperwork happens in the right order, on the right dates.

A lien is a legal claim on the property for unpaid work. The job's Lien window walks all of it, and the app watches every deadline. Its title reads *Liens on job* and the job's number. It opens from the orange lien icon on Billed and Collections rows.

## The clock, always visible

The top of the window draws the job's steps on one line, with today marked. The steps are last work, the § 53.056 notice and the § 53.057 retainage notice. Then come the § 53.052 affidavit, serving it, and the year to sue. Each step shows its date and how many days are left. The § 53.056 notice step counts on subcontractor jobs only. Weekends roll forward automatically. Above the line, in a tinted band, **Next on the path** names the next step and who it waits on. The switch in the corner reads **Steps** or **Windows**. Windows is a calendar of every paper, the closed windows too, from first day to last. On a phone the steps fold to one strip. Press it to see them. The same clock powers the Dashboard cards below. On **Jobs → Pipeline**, every Billed and Collections row carries the same date under its money bar. That is the **lien runway**. It reads *file lien by …*, against the day the customer is expected to pay. So the row says whether the money lands before the lien dies. On a sub job with no recorded notice the runway puts the § 53.056 notice date first. It shows as a hollow flag. See *read the Pipeline's money view*.

**What the clock keys on.** Each month worked gets its own notice date. The affidavit's date counts from the job's **last work month**. That is the month of the job's last work date, which is the latest **approved clock session** on the job. The app does not track which month each dollar was billed in. So it uses that one month as the basis. The notice's *months covered* is what you attest. Two consequences follow. A job with no approved clock sessions is dated from the month it was created, so approve the hours first. If the crew goes back for a day, the clock moves to that later month.

## On a phone

On a phone the window keeps its top short, so the paper gets the room.

- The steps fold into one strip under the job's name. The strip says the next step and the days left.
- The strip also says who you are waiting on. A red chip counts every notice window that closed.
- Tap the strip to see the steps. They drop down over the paper and do not push it.
- Tap the strip again, or the grey area, to put the steps away.
- The papers sit in one bar: **Demand letter**, **§ 53.056 notice** and **Mechanic's lien**.
- **§ Rules** and **×** sit beside the title.
- On **Demand letter** the four buttons at the foot sit in two rows. **×** closes the window, so there is no **Cancel**.
- {{button:outline-blue|Email with the PDF…}} opens its own panel in place of those buttons. **Back** brings them back.
- Each record step opens as its own page over the window. That covers **Save & record sends…**, {{button:outline|Already sent — record it…}}, **Record filing…** and **Record service…**.
- The page names the paper and the job at the top. **Back** returns to the paper where you left it.
- On **Release of record** nothing opens. Its boxes fill the width and its buttons sit in two rows.

## Step 1 — the § 53.056 notice (sub jobs only)

If the job has a GC, unpaid work months need a **notice of claim**. GC means the general contractor. The notice is the statute's own form, filled in by the app. It goes to **both** the owner of record and the GC. It is due by the 15th of the 2nd month after the work on residential jobs. On commercial jobs it is the 3rd month.

- Print it for certified mail. Or pick **email** as a recipient's method and the app sends the PDF for you and keeps the send receipt.
- **Enclose the invoice** is on by default when the job has unpaid bills. The statute lets the notice include the invoice. The owner learns exactly what to withhold from the GC. The notice's reference strip says it is enclosed. It prints after the notice and rides the emailed PDF, stamped INVOICE. Between the notice and the invoices sits the **pay codes** page. It has one QR code per unpaid Stripe bill under *Once these bills are paid, there will be no lien filed.* Each opens the bill's own `clicktooling.com/pay/…` address. That address is good until the bill is paid, however old the letter. Untick *Enclose the invoice* and the page leaves with the invoices.
- {{button:amber|Save & record sends…}} captures a method and tracking number **per recipient**. That is what lets the affidavit, the sworn lien statement, later swear the notices went out. It also captures a **Saved copy**: a Drive link to the paper as sent, with a note. The same two boxes sit on the affidavit's *Record filing* and the release's record. Every recorded row under *Filings on this job* reads *Saved copy · Drive ›* with *change*. When nobody kept one yet it offers *link the saved copy* instead.

- {{button:outline|Already sent — record it…}} is for a notice printed here and mailed by hand. You record when, how, to whom, the claim and months as printed, and the saved copy. You also record the other unpaid jobs at the property the one paper covered. It makes one record per job, and the Lien desk reads them as sent.

Jobs where you contracted directly with the owner skip this step. The tab says so.

:::example Which months need a notice?
The **Payment forecast** on Jobs → Pipeline shows it per month: open a row's chevron and every month the crew worked lists with its own notice date and state — {{chip:red|due tomorrow}}, {{chip:yellow|closes in 12d}}, {{chip:green|notice sent}} — with {{button:outline|Send notice…}} opening the **Lien desk**, where the office drafts the notice, the master approves it (or the office records his spoken word), and it goes out in the desk's run, or on its own from this tab through *Just this one, from the Lien window ›*. See *send lien notices from the Lien desk*.
:::

## The app finds the owner; you confirm it

A § 53.056 notice goes to the **owner of record** at a mailing address. The county appraisal roll already knows both. The appraisal roll is the county's list of who owns each property. So on **Jobs → Pipeline**, the Fix-ups strip shows {{chip:yellow|Owner of record to confirm · 35}}. It shows whenever an open GC job has no confirmed owner on its property record, with or without approved hours. Click it and the list looks every property up on the roll as it opens. It reads *Looking up 12 of 31…* meanwhile. The list is grouped by property and sorted by the first notice due. So one click covers every job at that address, now and later.

:::example One row of the list
**628 Terrell Rd, San Antonio** · J258 · J608 · RMC- Dudley Mason · Bexar {{chip:yellow|due Sep 15}}
**Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima** · Mail to 704 Garraty Ct, San Antonio 78209 · Bexar Appraisal District · 2025 · *this parcel on Bexar CAD ↗* {{button:blue|Use}}
:::

- {{button:blue|Use}} saves the owner, mailing address, legal description and where they came from on the property record. It links every job at that address to it. It marks the owner **confirmed**. A value someone already typed is never overwritten. Use confirms it.
- {{button:blue|Use all found}} in the footer does the whole pile in one click. It skips rows that read as a **public owner** on purpose. Press their own Use with your eyes open.
- The chips say what the roll reads as. {{chip:red|public owner — bond claim, not a lien}} is a city, county, school district or the State. A mechanic's lien does not attach there. The remedy is a claim on the GC's payment bond. {{chip:yellow|landlord · ATI Schertz is the tenant}} means the notice goes to the owner and the customer is copied. {{chip:red|likely homestead}} is an individual who gets mail at the property. A homestead lien needs a contract signed by both spouses and recorded before work starts. Confirm the exemption on the CAD page and talk to the attorney. CAD is the county appraisal district.
- A row the roll cannot place reads *No parcel under the pin — paste the CAD page…*. It opens the property record's paste box right there. Open the district's page, select all, copy, paste, then {{button:blue|Save the owner}}.
- A saved row turns green and stays for the sitting. The footer reads *k of N confirmed*. The chip's count falls as you go. The Lien desk's *Needs the owner* pile empties with it.

The roll lags sales and carries no exemptions. So the CAD link sits on every row for the day-of-filing check.

**Fill in the record from Edit Job.** Open the job's **Property record** row. It lists what the lien papers read: the county, the legal description, the owner and the owner's mailing address. A blank reads *Missing* in red. {{button:blue|Fill in the record}} opens the property record above Edit Job. When the roll has no parcel, the paste box is already open. Open the county's page for the property, select all and copy. Paste it, check what was found, then press {{button:blue|Use these}} and {{button:blue|Done}}. The row shows the new values right away. The Lien desk has the same door. An affidavit's red *Owner of record* or *County and legal description* line shows {{button:outline|Fill in the record ›}}.

**Residential or not, on the same row.** A residential property's notice is due a month earlier than a commercial one. So the lien screens need the property's kind. The **Property record** row on a job's Edit tab shows {{chip:yellow|kind not set}} until it is answered. Open the row and pick {{button:outline|Residential}} or {{button:outline|Non-residential}}. **Homestead** sits beside Residential. It saves on the property as you pick, not on the job. So every job at that address follows it. The Lien desk's *Set property kind ›* lands on this row, already open.

**Earlier still, on the job itself.** You do not have to wait for the Fix-ups chip. Open a GC job, or a job whose customer is a builder. A builder is one that is the GC on other jobs. The **Property record** row on the Edit tab looks the site up by itself. It does so the moment the job has an address and no confirmed owner. Nobody is asked. The row says {{chip:blue|1 suggestion}} and the answer appears under it as a card. It is a suggestion until you save it, so it is not green:

:::example The Property record row on a GC job
**The appraisal roll's answer for 9703 Lenox Hl** · Bexar Appraisal District · 2025 · *Check this parcel on Bexar CAD ↗*
*Owner of record, mails to* **Khan Umar & Bangash Shazmeena** · 3203 Spider Lily · San Antonio, TX 78258
*Legal* CB 4696A (Cantera Hills UT-3), Block 3 Lot 35 · *County* Bexar
{{button:blue|Save this owner}} *Not right? Paste the CAD page…*
:::

The address is laid out the way the envelope will read. First the owner, then street, then city. A *c/o* line sits after the owner when the roll names one. The districts write that line as a leading **%**. On a phone the facts drop under the address and the button runs the full width.

- {{button:blue|Save this owner}} does exactly what {{button:blue|Use}} does on the list. It saves the owner with its provenance on the property record. Provenance is where the answer came from. When the job has no customer row it creates one on the GC. It links this job and every other job at that address. It marks the owner confirmed. The row then reads the linked property with its ✓ lien-ready mark.
- *Not right? Paste the CAD page…* opens the same paste box. A site the roll cannot place reads *No parcel under the pin*, with *Paste the CAD page instead…*.
- A direct job, a homeowner who hired you, gets no box. They are the owner of record already.
- When the roll suggests the site is the owner's home, the box says so right there. It shows {{chip:red|likely homestead}} and reads *Likely a homestead — the owners get mail at the property. A lien on a homestead needs a contract signed by both spouses and recorded with the county before work starts. Confirm the exemption on the CAD page and talk to the attorney before the crew goes out.* It is a hint, not a finding. The roll carries no exemptions. That is why the CAD link sits beside it.

**The one question you are asked.** When a new job's customer is a builder and no GC is set, the *Does this job need a contract?* prompt asks first. It asks **Is <customer> building this for someone?** {{button:outline|No — they own the site}} records nothing. {{button:blue|Yes — they are the builder}} sets them as the job's GC. That is what starts the monthly notice clock. The appraisal roll then fills the owner of record on the spot. The customer row stays as it is. Pick the site owner as the customer later if you want them on the job.

The same answer meets you in two more places, so no notice is ever blocked on a missing owner:

- **Bill Customer** is one. The first bill on a GC job is the last net. When the job has no confirmed owner, the Send-to block shows one green line. It reads *Owner of record for 5498 Cibolo Valley Dr: Schertz Station Ltd (Guadalupe Appraisal District 2025) — not yet on the job.* Then {{button:green|Use}} *it so the lien notice can be mailed when it is due.* It never holds up the bill. A roll miss reads *No owner of record on file — paste the county's page…* and opens the paste box right there.
- **The Lien desk** is the other. An item in *Needs the owner* shows *Found at:* with the district and year, the chips, the CAD link and {{button:blue|Use this owner}}. {{button:outline|Find the owner ›}} stays as the fallback. Once Use this owner is pressed the row moves to *To draft* on its own.

:::example Save owners from the appraisal roll automatically (Settings → Jobs & billing, master and dev)
Off on day one. When it is on, every night the app looks up every open GC job with **no owner at all**, hours or not, and saves the roll's answer as *from the roll · unconfirmed* — the property record fills in with its provenance, but nobody has looked at it yet. The Lien desk drafts on it and says so — *Owner from the roll (2025) · unconfirmed · confirm on Guadalupe CAD ↗* {{button:blue|Confirm}} — and **Record the run refuses** until a person presses Confirm on every notice in the run. Owners someone typed or pressed Use on are never touched. Turn it on after the first sitting shows the roll is right.
:::

## Step 2 — the affidavit, behind its gate

The **Mechanic's lien** tab refuses to generate until the paper trail is real. It needs the owner of record with mailing address ✓. It needs the county and legal description ✓, from the property record. It needs the notice recorded ✓ on sub jobs. And it needs **not a homestead**. A homestead lien needs a pre-work contract signed by both spouses and recorded with the county. That is attorney territory the app will not paper over.

When the gate clears, click {{button:outline-blue|Print for notarization}}. Sign before a notary. File it with the County Clerk in the property's county. Then click {{button:red|Record filing…}} with the recording number. The **serve-by date stamps itself**. A copy must reach the owner and contractor within 5 days. A red Dashboard card nags until you {{button:red|Record service…}}.

## The year after filing

A recorded lien is good for one year from the last day the affidavit could have been filed. That is § 53.158. Ninety days before that day a Needs You card appears. It reads *A filed lien's year to sue ends <date>*, with the dollars still open behind it. It turns red inside 30 days. Once the day has passed, it reads *has run out*. Paid? File the release of record and the card goes. Unpaid? Get counsel on the suit. The card names the day to have counsel by. {{button:outline|Open the Timeline}} lands on the Lien desk's Timeline tab, where each job shows its date.

The Legal desk's Paper tab draws each job's timeline under *Where each job stands*. A filed lien's suit step reads *counsel by* and a date. The step reads *counsel now* inside 90 days and *the year ran out* after. The job's Lien window opens with its whole timeline under its name. So the date is one glance away wherever the job is opened.

## Step 3 — when it's paid, release it

Once a filing exists, a **Release of record** tab appears. It is prefilled with the instrument number, county, and filing date. Print, notarize, file. The recorded lien is discharged.

:::example The three Dashboard watches
**Next lien deadline: Oct 15** (amber inside 14 days for the soonest notice still to draft — inside 7 days the card turns red and reads *N lien windows close …*), **lien filing window closes Nov 16** (amber — noticed jobs still unpaid as the § 53.052 window ends), and **a filed lien has not been served** (red — the 5-day § 53.055 clock). Each clears itself the moment the record exists.
:::
