---
title: understand how liens work and which lien tool to use
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien, mechanic's lien, Texas, Property Code, chapter 53, notice, 53.056, affidavit, 53.052, release, waiver, work month, GC, subcontractor, owner of record, deadline, Lien desk, Lien instruments, homestead, retainage
---
A lien is a claim on the property the work went into. Texas lets a plumber who has not been paid put one there.

The rules are strict about **when** and **to whom**. The app does the counting. This page is the map. It shows how the law works and which paper goes out at each step. It also shows which tool in the app does it. The rules themselves are on [read the Texas lien rules the app follows](/help/texas-lien-rules-the-app-follows). Each rule there has its cite, the line of law it comes from, and what the app does about it. The step-by-step guides are linked at the end.

## The one rule under everything

Texas counts every lien deadline from the **month the work was done**, never from the day the bill went out. Two consequences:

- A job that ran June, July and August has three separate clocks, one per month. That holds even if it was billed once at the end.
- The clock goes by **approved clock sessions**. Hours still awaiting approval do not count, so approving the week's hours is part of protecting the money.

A **residential** property shortens every deadline by a month. Residential means a house, duplex, triplex, fourplex, or a condo unit the owner lives in. The app reads that from the property record. When it is unknown, it shows the commercial dates and says so.

## Who we are on the job decides which paper

- **We contracted with a GC**, the general contractor. In the app, a GC is set on the job. We are a *subcontractor*. Every unpaid month needs its own **notice** to the owner and the GC before we can ever file a lien.
- **We contracted with the owner**. In the app, no GC is on the job. We are the *original contractor*. No monthly notice. The affidavit, the sworn lien paper, is the only filing.

A builder entered as the customer with no GC set reads as the second case. If someone else owns the site, you set the GC on the job. The forecast's month panel prompts for this on commercial jobs.

## The four instruments, in order

An instrument is a legal paper.

1. **The § 53.056 notice**, on sub jobs only. It is the statute's own form. The statute is the written law. The notice goes to the owner of record *and* the GC. It is due by the **15th of the third month** after the unpaid work month. The owner of record is the owner the county lists. On a residential job it is the 15th of the second month. Certified mail, or a courtesy email on top. One notice may name several months. The earliest month sets the date. A homestead is the home the owner lives in. On a residential or homestead property the notice also carries the statement Texas Property Code *§ 53.254(g)* requires. Without it a homestead lien is invalid. The statement prints under the form by itself, on both copies. Missing a month's notice loses the lien on that month's work, quietly.
2. **The demand letter** is optional, not statutory. The law does not ask for it. It is a final formal demand with a payment deadline. It goes before an affidavit when a phone call has not worked.
3. **The § 53.052 affidavit** is the lien itself. It is sworn before a notary. It is filed with the County Clerk in the property's county. It is due by the **15th of the fourth month** after the *last* month worked. On a residential job it is the 15th of the third month. It needs the owner of record and the county and legal description of the property. The legal description is the lot as the county records name it. On sub jobs it needs a recorded notice. And the property must not be a **homestead**. A homestead lien needs a contract signed by both spouses and recorded before the work. That is attorney territory. A copy must reach the owner and the GC within **5 days** of filing.
4. **The release**: once the money lands, the customer is owed a release. A release gives up our lien claim for the money paid. A **conditional** release goes out with an unpaid bill and takes effect when the check clears. An **unconditional** one says we have been paid. A recorded affidavit gets a **release of record** filed with the same clerk.

Two related papers point the other way. First come the four Texas **lien waivers** we ask a sub to sign when we pay them. Then there is the **retainage** notice the statute has for money a GC holds back. That notice is not modeled in the app yet. Ask before relying on it.

## Which tool does what

| You want to | Go to |
|---|---|
| See which unpaid months are closing and get the notices out. | **The Lien desk**. It opens from Dashboard → Needs you {{chip:red|N lien notices to draft}}. It also opens from Jobs → Pipeline → Collections header {{button:outline|⏱ Lien desk}}. |
| See the months and hours behind one bill. | **Jobs → Pipeline → Forecast**, the chevron on the row. |
| Send one notice or a demand letter by hand. File the affidavit. Record the filing and the service. | **Lien instruments**, the orange lien icon on a Billed or Collections row. |
| Give a customer a release when they pay. | The blue release button on the row, or **Bill Customer → Lien releases**. |
| Ask a sub to waive their lien rights when you pay them. | **Job → Subs → Pay → Lien waiver…** |
| Hand an unpaid account to the attorney after the paper is done. | {{button:outline|⚖ Legal}} on the Collections header. |

## The everyday loop

1. **The Dashboard says what is due.** {{chip:red|6 lien notices to draft}} counts unpaid work months on jobs with a GC. It counts those whose notice closes within 30 days, with the dollars riding on them. The master technician sees a second card, {{chip:blue|Approve N lien notices}}, when drafts wait on their approval.
2. **The office readies and drafts.** The desk's first pile is *Needs the owner*. The notice cannot go anywhere without the owner of record's mailing address. So {{button:outline|Find the owner ›}} opens the property record where the county appraisal link lives. Then you press {{button:blue|Send for approval ▸}}. Or you press {{button:amber|The leader said to send it ▸}} when Robert already said so.
3. **The master decides once per GC.** The master approves, holds, or sets a **standing rule** on the GC, like *send without asking*. Then routine notices stop coming to the master. A live payment promise always comes back to the master.
4. **The run goes out.** {{button:blue|Send the run · N}} prints one packet and one tracking form. The packet is a cover sheet, then every notice for the owner and for the GC. {{button:blue|Record the run ▸}} writes each notice to its job, naming every month it covered.
5. **The affidavit follows the same path** under the desk's Affidavits switch. It files from the Lien window's affidavit tab. When the money arrives, the release goes out. When it does not, the Legal desk takes over.

:::example What the dates look like on a real job
J650 ran June through September for a GC and nothing is paid. June's notice is due September 15, July's October 15, August's November 16 (the 15th is a Sunday), and the affidavit for all of it by January 15 (the fourth month after September, the last month worked). The forecast row shows exactly those lines, and the desk lists the job the moment June is inside 30 days.
:::

## Who can do what

- **Draft, send for approval, record the leader's spoken word, send the run, record filings and releases:** the office roles. Those are dev, master technician, assistant and controller.
- **Approve, hold, set a standing rule, sign the affidavit:** master technician and dev. The database refuses an approval from anyone else.
- **See any of it:** the same office roles. Customers never see lien paperwork in their portal.

## The step-by-step guides

- *send lien notices from the Lien desk*: the desk, piles, approval, the run.
- *answer an owner who calls about a lien letter*: ☎ Someone's calling. Find the letter they hold, read the cards, record the call.
- *file a lien and never miss its deadlines*: the Lien instruments window. It covers notice, affidavit, service and release of record.
- *give a customer a lien release*: conditional and unconditional releases, signing, the Needs you follow-through.
- *send a sub the right lien waiver*: the four Texas waiver forms when you pay a sub.
- *see when a customer will pay*: the forecast's work-month panel the desk reads from.
