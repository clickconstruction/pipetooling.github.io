---
title: file a lien and never miss its deadlines
category: Billing & Money
keywords: mechanic's lien, lien affidavit, notice of claim, 53.056, county clerk, recording number, serve, deadline, filing window, release of lien, homestead
roles: dev, master_technician, assistant, controller
---
When a demand letter doesn't shake the money loose, Texas gives you a lien — but only if the paperwork happens in the right order, on the right dates. The **Lien instruments** window (the orange lien icon on Billed and Collections rows) now walks all of it, and the app watches every deadline.

## The clock, always visible

The window header shows the job's two dates: **⏱ Notice by …** (subcontractor jobs only) and **File by …**. Weekends roll forward automatically. The same clock powers the Dashboard cards below.

**What the clock keys on.** Both dates count from the job's **last work month** — the month of the job's last work date, which is the latest **approved clock session** on the job. The app doesn't track which month each dollar was billed in, so it uses that one month as the basis and the notice's *months covered* is what you attest. Two consequences: a job with no approved clock sessions shows no dates (approve the hours first), and if the crew goes back for a day, the clock moves to that later month.

## Step 1 — the § 53.056 notice (sub jobs only)

If the job has a GC, unpaid work months need a **notice of claim** — the statute's own form, filled in by the app — delivered to **both** the owner of record and the GC by the 15th of the 2nd (residential) / 3rd (commercial) month after the work.

- Print it for certified mail, or pick **email** as a recipient's method and the app sends the PDF for you and keeps the send receipt.
- **Enclose the invoice** is on by default when the job has unpaid bills: the statute lets the notice include the invoice, the owner learns exactly what to withhold from the GC, and the notice's reference strip says it is enclosed. It prints after the notice and rides the emailed PDF, stamped INVOICE.
- {{button:blue|Save & record sends…}} captures a method + tracking number **per recipient** — that's what lets the affidavit later swear the notices went out.

Jobs where you contracted directly with the owner skip this step — the tab says so.

:::example Which months need a notice?
The **Payment forecast** on Jobs → Pipeline shows it per month: open a row's chevron and every month the crew worked lists with its own notice date and state — {{chip:red|due tomorrow}}, {{chip:yellow|closes in 12d}}, {{chip:green|notice sent}} — with {{button:outline|Send notice…}} opening the **Lien desk**, where the office drafts the notice, the master approves it (or the office records his spoken word), and it lands here to print and record. See *send lien notices from the Lien desk*.
:::

## The app finds the owner; you confirm it

A § 53.056 notice goes to the **owner of record** at a mailing address — and the county appraisal roll already knows both. So on **Jobs → Pipeline**, the Fix-ups strip shows {{chip:yellow|Owner of record to confirm · 35}} whenever a GC job with approved hours has no confirmed owner on its property record. Click it and the list looks every property up on the roll as it opens (*Looking up 12 of 31…*), grouped by property and sorted by the first notice due, so one click covers every job at that address, now and later.

:::example One row of the list
**628 Terrell Rd, San Antonio** · J258 · J608 · RMC- Dudley Mason · Bexar {{chip:yellow|due Sep 15}}
**Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima** · Mail to 704 Garraty Ct, San Antonio 78209 {{chip:gray|mail elsewhere}} Bexar Appraisal District · 2025 · *this parcel on Bexar CAD ↗* {{button:blue|Use}}
:::

- {{button:blue|Use}} saves the owner, mailing address, legal description and where they came from on the property record, links every job at that address to it, and marks the owner **confirmed**. A value someone already typed is never overwritten — Use confirms it.
- {{button:blue|Use all found}} in the footer does the whole pile in one click. It skips rows that read as a **public owner** on purpose; press their own Use with your eyes open.
- The chips say what the roll reads as: {{chip:red|public owner — bond claim, not a lien}} (a city, county, school district or the State — a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond), {{chip:yellow|landlord · ATI Schertz is the tenant}} (the notice goes to the owner, the customer is copied), {{chip:red|likely homestead}} (an individual who gets mail at the property — a homestead lien needs a contract signed by both spouses and recorded before work starts; confirm the exemption on the CAD page and talk to the attorney).
- A row the roll cannot place reads *No parcel under the pin — paste the CAD page…* and opens the property record's paste box right there: open the district's page, select all, copy, paste, {{button:blue|Save the owner}}.
- A saved row turns green and stays for the sitting; the footer reads *k of N confirmed*. The chip's count falls as you go, and the Lien desk's *Needs the owner* pile empties with it.

The roll lags sales and carries no exemptions, so the CAD link sits on every row for the day-of-filing check.

**Earlier still — on the job itself.** You do not have to wait for the Fix-ups chip. Open a GC job (or a job whose customer is a builder — one that is the GC on other jobs) and the **Property record** row on the Edit tab looks the site up by itself, the moment the job has an address and no confirmed owner. Nobody is asked; the row says {{chip:blue|1 suggestion}} and the answer appears under it as a card. It is a *suggestion* until you save it, so it is not green:

:::example The Property record row on a GC job
**The appraisal roll's answer for 9703 Lenox Hl** · Bexar Appraisal District · 2025 · *Check this parcel on Bexar CAD ↗*
*Owner of record, mails to* **Khan Umar & Bangash Shazmeena** · 3203 Spider Lily · San Antonio, TX 78258
*Legal* CB 4696A (Cantera Hills UT-3), Block 3 Lot 35 · *County* Bexar · *Reads as* Mails somewhere other than the job site
{{button:blue|Save this owner}} *Not right? Paste the CAD page…*
:::

The address is laid out the way the envelope will read — owner, a *c/o* line when the roll names one (the districts write it as a leading **%**), street, then city. On a phone the facts drop under the address and the button runs the full width.

- {{button:blue|Save this owner}} does exactly what {{button:blue|Use}} does on the list: saves the owner with its provenance on the property record (creating one on the GC when the job has no customer row), links this job and every other job at that address, and marks the owner confirmed. The row then reads the linked property with its ✓ lien-ready mark.
- *Not right — paste the CAD page…* opens the same paste box; a site the roll cannot place reads *No parcel under the pin — paste the CAD page…*.
- A direct job — a homeowner who hired you — gets no box. They are the owner of record already.
- When the roll suggests the site is the owner's home, the box says so right there: {{chip:red|likely homestead}} *Likely a homestead — the owners get mail at the property. A lien on a homestead needs a contract signed by both spouses and recorded with the county before work starts. Confirm the exemption on the CAD page and talk to the attorney before the crew goes out.* It is a hint, not a finding — the roll carries no exemptions — which is why the CAD link sits beside it.

**The one question you are asked.** When a new job's customer is a builder and no GC is set, the *Does this job need a contract?* prompt first asks **Is <customer> building this for someone?** {{button:outline|No — they own the site}} records nothing. {{button:blue|Yes — they are the builder}} sets them as the job's GC — which is what starts the monthly notice clock — and the appraisal roll then fills the owner of record on the spot. The customer row stays as it is; pick the site owner as the customer later if you want them on the job.

The same answer meets you in two more places, so no notice is ever blocked on a missing owner:

- **Bill Customer** — the first bill on a GC job is the last net. When the job has no confirmed owner, the Send-to block shows one green line: *Owner of record for 5498 Cibolo Valley Dr: Schertz Station Ltd (Guadalupe Appraisal District 2025) — not yet on the job.* {{button:green|Use}} *it so the lien notice can be mailed when it is due.* It never holds up the bill. A roll miss reads *No owner of record on file — paste the county's page…* and opens the paste box right there.
- **The Lien desk** — an item in *Needs the owner* shows *The roll says: …* with the chips, the provenance, the CAD link and {{button:blue|Use}}; {{button:outline|Find the owner ›}} stays as the fallback. Once Use is pressed the row moves to *To draft* on its own.

:::example Save owners from the appraisal roll automatically (Settings → Jobs & billing, master and dev)
Off on day one. When it is on, every night the app looks up every GC job with approved hours and **no owner at all** and saves the roll's answer as *from the roll · unconfirmed* — the property record fills in with its provenance, but nobody has looked at it yet. The Lien desk drafts on it and says so — *Owner from the roll (2025) · unconfirmed · confirm on Guadalupe CAD ↗* {{button:blue|Confirm}} — and **Record the run refuses** until a person presses Confirm on every notice in the run. Owners someone typed or pressed Use on are never touched. Turn it on after the first sitting shows the roll is right.
:::

## Step 2 — the affidavit, behind its gate

The **Mechanic's lien** tab refuses to generate until the paper trail is real: owner of record with mailing address ✓, county + legal description ✓ (from the property record), notice recorded ✓ (subs), and **not a homestead** — a homestead lien needs a pre-work contract signed by both spouses and recorded with the county, which is attorney territory the app won't paper over.

When the gate clears: {{button:outline-blue|Print for notarization}}, sign before a notary, file it with the County Clerk in the property's county, then {{button:blue|Record filing…}} with the recording number. The **serve-by date stamps itself** — a copy must reach the owner and contractor within 5 days — and a red Dashboard card nags until you {{button:outline-blue|Record service…}}.

## Step 3 — when it's paid, release it

Once a filing exists, a **Release of record** tab appears, prefilled with the instrument number, county, and filing date. Print, notarize, file — the recorded lien is discharged.

:::example The three Dashboard watches
**Lien notice windows close Oct 15** (amber — unpaid sub jobs with no notice for the work month), **lien filing window closes Nov 16** (amber — noticed jobs still unpaid as the § 53.052 window ends), and **a filed lien has not been served** (red — the 5-day § 53.055 clock). Each clears itself the moment the record exists.
:::
