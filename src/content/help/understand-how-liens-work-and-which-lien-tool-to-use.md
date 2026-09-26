---
title: understand how liens work and which lien tool to use
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien, mechanic's lien, Texas, Property Code, chapter 53, notice, 53.056, affidavit, 53.052, release, waiver, work month, GC, subcontractor, owner of record, deadline, Lien desk, Lien instruments, homestead, retainage
---
A lien is how Texas lets a plumber who has not been paid put a claim on the property the work went into. The rules are strict about **when** and **to whom**, and the app does the counting. This page is the map: how the law works, which paper goes out at each step, and which tool in the app does it. The rules themselves, each with its cite and what the app does about it, are on [read the Texas lien rules the app follows](/help/texas-lien-rules-the-app-follows). The step-by-step guides are linked at the end.

## The one rule under everything

Texas counts every lien deadline from the **month the work was done**, never from the day the bill went out. Two consequences:

- A job that ran June, July and August has three separate clocks, one per month, even if it was billed once at the end.
- The clock keys on **approved clock sessions**. Hours still awaiting approval do not count, so approving the week's hours is part of protecting the money.

Whether the property is **residential** (a house, duplex, triplex, fourplex, or a condo unit the owner lives in) shortens every deadline by a month. The app reads that from the property record; when it is unknown it shows the commercial dates and says so.

## Who we are on the job decides which paper

- **We contracted with a GC** (a GC is set on the job): we are a *subcontractor*. Every unpaid month needs its own **notice** to the owner and the GC before we can ever file a lien.
- **We contracted with the owner** (no GC on the job): we are the *original contractor*. No monthly notice. The affidavit is the only filing.

A builder entered as the customer with no GC set reads as the second case. If someone else owns the site, set the GC on the job. The forecast's month panel prompts for this on commercial jobs.

## The four instruments, in order

1. **The § 53.056 notice** (sub jobs only) — the statute's own form, sent to the owner of record *and* the GC by the **15th of the third month** after the unpaid work month (the second month if residential). Certified mail, or a courtesy email on top. One notice may name several months; the earliest month sets the date. On a residential or homestead property the notice also carries the statement Texas Property Code § 53.254(g) requires — without it a homestead lien is invalid — printed under the form by itself, on both copies. Missing a month's notice loses the lien on that month's work, quietly.
2. **The demand letter** — optional, not statutory. A final formal demand with a payment deadline, sent before an affidavit when a phone call has not worked.
3. **The § 53.052 affidavit** — the lien itself, sworn before a notary and filed with the County Clerk in the property's county by the **15th of the fourth month** after the *last* month worked (the third if residential). It needs the owner of record, the county and legal description of the property, a recorded notice on sub jobs, and the property must not be a **homestead** (a homestead lien needs a contract signed by both spouses and recorded before the work — attorney territory). A copy must reach the owner and the GC within **5 days** of filing.
4. **The release** — once the money lands, the customer is owed a release. A **conditional** release goes out with an unpaid bill and takes effect when the check clears; an **unconditional** one says we have been paid. A recorded affidavit gets a **release of record** filed with the same clerk.

Two related papers point the other way: the four Texas **lien waivers** we ask a sub to sign when we pay them, and the **retainage** notice the statute has for money a GC holds back (not modeled in the app yet — ask before relying on it).

## Which tool does what

| You want to | Go to |
|---|---|
| See which unpaid months are closing and get the notices out | **The Lien desk** — Dashboard → Needs you {{chip:red|N lien notices to draft}}, or Jobs → Pipeline → Collections header {{button:outline|⏱ Lien desk}} |
| See the months and hours behind one bill | **Jobs → Pipeline → Forecast**, the chevron on the row |
| Send one notice or a demand letter by hand, file the affidavit, record the filing and the service | **Lien instruments**, the orange lien icon on a Billed or Collections row |
| Give a customer a release when they pay | The blue release button on the row, or **Bill Customer → Lien releases** |
| Ask a sub to waive their lien rights when you pay them | **Job → Subs → Pay → Lien waiver…** |
| Hand an unpaid account to the attorney after the paper is done | {{button:outline|⚖ Legal}} on the Collections header |

## The everyday loop

1. **The Dashboard says what is due.** {{chip:red|6 lien notices to draft}} counts unpaid work months on jobs with a GC whose notice closes within 30 days, with the dollars riding on them. The master sees a second card, {{chip:blue|Approve N lien notices}}, when drafts are waiting on him.
2. **The office readies and drafts.** The desk's first pile is *Needs the owner*: the notice cannot go anywhere without the owner of record's mailing address, so {{button:outline|Find the owner ›}} opens the property record where the county appraisal link lives. Then {{button:blue|Send for approval ▸}}, or {{button:amber|The leader said to send it ▸}} when Robert already said so.
3. **The master decides once per GC.** He approves, holds, or sets a **standing rule** on the GC — *send without asking* — so routine notices stop coming to him. A live payment promise always comes back to him.
4. **The run goes out.** {{button:blue|Send the run · N}} prints one packet — a cover sheet, then every notice for the owner and for the GC — and one tracking form. {{button:blue|Record the run ▸}} writes each notice to its job naming every month it covered.
5. **The affidavit follows the same path** under the desk's Affidavits switch, and files from the Lien window's affidavit tab. When the money arrives, the release goes out. When it does not, the Legal desk takes over.

:::example What the dates look like on a real job
J650 ran June through September for a GC and nothing is paid. June's notice is due September 15, July's October 15, August's November 16 (the 15th is a Sunday), and the affidavit for all of it by January 15 (the fourth month after September, the last month worked). The forecast row shows exactly those lines, and the desk lists the job the moment June is inside 30 days.
:::

## Who can do what

- **Draft, send for approval, record the leader's spoken word, send the run, record filings and releases:** dev, master technician, assistant, controller.
- **Approve, hold, set a standing rule, sign the affidavit:** master technician and dev. The database refuses an approval from anyone else.
- **See any of it:** the same office roles. Customers never see lien paperwork in their portal.

## The step-by-step guides

- *send lien notices from the Lien desk* — the desk, piles, approval, the run.
- *answer an owner who calls about a lien letter* — ☎ Someone's calling: find the letter they hold, read the cards, record the call.
- *file a lien and never miss its deadlines* — the Lien instruments window: notice, affidavit, service, release of record.
- *give a customer a lien release* — conditional and unconditional releases, signing, the Needs you follow-through.
- *send a sub the right lien waiver* — the four Texas waiver forms when you pay a sub.
- *see when a customer will pay* — the forecast's work-month panel the desk reads from.
