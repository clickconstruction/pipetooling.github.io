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

## Step 2 — the affidavit, behind its gate

The **Mechanic's lien** tab refuses to generate until the paper trail is real: owner of record with mailing address ✓, county + legal description ✓ (from the property record), notice recorded ✓ (subs), and **not a homestead** — a homestead lien needs a pre-work contract signed by both spouses and recorded with the county, which is attorney territory the app won't paper over.

When the gate clears: {{button:outline-blue|Print for notarization}}, sign before a notary, file it with the County Clerk in the property's county, then {{button:blue|Record filing…}} with the recording number. The **serve-by date stamps itself** — a copy must reach the owner and contractor within 5 days — and a red Dashboard card nags until you {{button:outline-blue|Record service…}}.

## Step 3 — when it's paid, release it

Once a filing exists, a **Release of record** tab appears, prefilled with the instrument number, county, and filing date. Print, notarize, file — the recorded lien is discharged.

:::example The three Dashboard watches
**Lien notice windows close Oct 15** (amber — unpaid sub jobs with no notice for the work month), **lien filing window closes Nov 16** (amber — noticed jobs still unpaid as the § 53.052 window ends), and **a filed lien has not been served** (red — the 5-day § 53.055 clock). Each clears itself the moment the record exists.
:::
