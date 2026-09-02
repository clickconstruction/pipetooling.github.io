---
title: file a lien and never miss its deadlines
category: Billing & Money
keywords: mechanic's lien, lien affidavit, notice of claim, 53.056, county clerk, recording number, serve, deadline, filing window, release of lien, homestead
roles: dev, master_technician, assistant, controller
---
When a demand letter doesn't shake the money loose, Texas gives you a lien — but only if the paperwork happens in the right order, on the right dates. The **Lien instruments** window (the orange lien icon on Billed and Collections rows) now walks all of it, and the app watches every deadline.

## The clock, always visible

The window header shows the job's two dates, computed from its last work month: **⏱ Notice by …** (subcontractor jobs only) and **File by …**. Weekends roll forward automatically. The same clock powers the Dashboard cards below.

## Step 1 — the § 53.056 notice (sub jobs only)

If the job has a GC, unpaid work months need a **notice of claim** — the statute's own form, filled in by the app — delivered to **both** the owner of record and the GC by the 15th of the 2nd (residential) / 3rd (commercial) month after the work.

- Print it for certified mail, or pick **email** as a recipient's method and the app sends the PDF for you and keeps the send receipt.
- {{button:blue|Save & record sends…}} captures a method + tracking number **per recipient** — that's what lets the affidavit later swear the notices went out.

Jobs where you contracted directly with the owner skip this step — the tab says so.

## Step 2 — the affidavit, behind its gate

The **Mechanic's lien** tab refuses to generate until the paper trail is real: owner of record with mailing address ✓, county + legal description ✓ (from the property record), notice recorded ✓ (subs), and **not a homestead** — a homestead lien needs a pre-work contract signed by both spouses and recorded with the county, which is attorney territory the app won't paper over.

When the gate clears: {{button:outline-blue|Print for notarization}}, sign before a notary, file it with the County Clerk in the property's county, then {{button:blue|Record filing…}} with the recording number. The **serve-by date stamps itself** — a copy must reach the owner and contractor within 5 days — and a red Dashboard card nags until you {{button:outline-blue|Record service…}}.

## Step 3 — when it's paid, release it

Once a filing exists, a **Release of record** tab appears, prefilled with the instrument number, county, and filing date. Print, notarize, file — the recorded lien is discharged.

:::example The three Dashboard watches
**Lien notice windows close Oct 15** (amber — unpaid sub jobs with no notice for the work month), **lien filing window closes Nov 16** (amber — noticed jobs still unpaid as the § 53.052 window ends), and **a filed lien has not been served** (red — the 5-day § 53.055 clock). Each clears itself the moment the record exists.
:::
