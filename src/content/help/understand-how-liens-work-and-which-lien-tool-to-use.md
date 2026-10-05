---
title: understand how liens work and which lien tool to use
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien, mechanic's lien, Texas, Property Code, chapter 53, notice, 53.056, affidavit, 53.052, release, waiver, work month, GC, subcontractor, owner of record, deadline, Lien desk, Next up, liens on job, homestead, retainage
---
A lien lets a plumber who has not been paid put a claim on the property the work went into. Texas is strict about when each paper goes out and who gets it. The app does the counting. This page is the map of the law, the papers and the tools.

The rules themselves are on [read the Texas lien rules the app follows](/help/texas-lien-rules-the-app-follows). The step by step guides are linked at the end.

## Start here: the Lien desk and Next up

You do not need to know the law to know what to do next. Open the Lien desk from the orange gavel on the Pipeline. It opens on **Next up**.

Next up is one list of every lien paper that needs someone to act. It runs in date order. Each row has one button that names the next move. The button opens the screen that does that work.

Two names cover everything.

- **Lien desk** is every job at once.
- **Liens on job** and a job number is one job's window. This guide calls it the job's Lien window.

## The one rule under everything

Texas counts every lien deadline from the month the work was done. It never counts from the day the bill went out. Two things follow.

- A job that ran June, July and August has three clocks, one for each month. That is true even if it was billed once at the end.
- The clock reads approved clock sessions. Hours still waiting for approval do not count. So approving the week's hours protects the money.

A residential property shortens every deadline by a month. That means a house, a duplex, a triplex, a fourplex or a condo the owner lives in. The app reads the kind from the property record. When the kind is unknown, it shows the commercial dates and says so.

## Who we are on the job decides which paper

- **We contracted with a GC.** A GC is set on the job, and we are a subcontractor. Every unpaid month needs its own notice to the owner and the GC. Without it we can never file a lien for that month.
- **We contracted with the owner.** No GC is set on the job, and we are the original contractor. There is no monthly notice. The affidavit is the only filing.

A builder entered as the customer with no GC set reads as the second case. If someone else owns the site, set the GC on the job. The forecast's month panel asks for this on commercial jobs.

## The papers, in order

1. **The § 53.056 notice.** It is for sub jobs only. It goes to the owner of record and to the GC. It is due by the 15th of the third month after the unpaid work month. On a residential property it is due a month sooner. It goes by certified mail, with an email as a courtesy. One notice may name several months, and the earliest month sets the date. Missing a month's notice loses the lien on that month's work.
2. **The demand letter.** It is optional, and the law does not require it. It is a final formal demand with a payment deadline. Send it before an affidavit when a phone call has not worked.
3. **The § 53.057 retainage notice.** It is for money the GC holds back. It is due 30 days after our contract ends.
4. **The § 53.052 affidavit.** This is the lien itself. It is sworn before a notary and filed with the County Clerk in the property's county. It is due by the 15th of the fourth month after the last month worked. On a residential property it is due a month sooner. A copy must reach the owner and the GC within 5 days of filing.
5. **The release.** Once the money lands, the customer is owed a release. A recorded affidavit also gets a release of record, filed with the same clerk.

On a residential or homestead property, the notice carries one more statement. Texas Property Code § 53.254 requires it, and a homestead lien is invalid without it. The app prints it under the form on both copies.

An affidavit needs four things. It needs the owner of record. It needs the county and the legal description of the property. On a sub job it needs a recorded notice. And the property must not be a homestead. A homestead lien needs a contract signed by both spouses and recorded before the work. That is a matter for the attorney.

A conditional release goes out with an unpaid bill. It takes effect when the check clears. An unconditional release says we have been paid.

One more paper points the other way. When we pay a sub, we ask the sub to sign a Texas lien waiver.

## Which tool does what

- **See what needs doing next, on every job.** Open the Lien desk. It opens on **Next up**.
- **See when each deadline falls.** Open the Lien desk and press **Calendar**.
- **Draft, approve and send notices.** Use the Lien desk's **Notices** tab. A Next up row takes you to the right job there.
- **See the months and hours behind one bill.** Go to Jobs, then Pipeline, then Forecast. Press the chevron on the row.
- **Work one job's lien paper.** Press the orange lien icon on a Billed or Collections row. The job's Lien window opens. Its top card names your next step. The demand letter, the affidavit, the service and the release of record are made here.
- **Give a customer a release when they pay.** Press the blue release button on the row. Or open Bill Customer and use **Lien releases**. The job's Lien window also has a link to it.
- **Ask a sub to waive lien rights when you pay them.** Open the job, then Subs, then Pay. Press {{button:outline|Lien waiver…}}.
- **Hand an unpaid account to the attorney.** Press {{button:outline|⚖ Legal}} on the Collections header.

## The everyday loop

1. **The Dashboard says what is due.** Its lien card counts the notices to draft and the dollars riding on them. The master sees a second card when drafts are waiting on him.
2. **The office readies and drafts.** A notice cannot go anywhere without the owner of record's mailing address. So the first move on many rows is {{button:blue|Find the owner}}. Then the office presses {{button:blue|Send for approval ▸}}.
3. **The master decides.** He approves or holds. He can also set a standing rule on a GC, so routine notices stop coming to him. A live payment promise always comes back to him.
4. **The run goes out.** {{button:blue|Send the run}} prints one packet and one tracking form. The packet has a cover sheet, then every notice for the owner and for the GC. Recording the run writes each notice to its job, with every month it covered.
5. **The affidavit follows the same path.** It is drafted and approved on the desk's **Affidavits** tab. It is filed from the job's Lien window.

When the money arrives, the release goes out. When it does not, the Legal desk takes over.

:::example What the dates look like on a real job
J650 ran June through September for a GC, and nothing is paid. June's notice is due September 15. July's is due October 15. August's is due November 16, because the 15th is a Sunday. The affidavit for all of it is due January 15. That is the fourth month after September, the last month worked. The forecast row shows those lines. The desk lists the job the moment June is inside 30 days.
:::

## Who can do what

- **The office drafts, sends for approval, sends the run and records filings and releases.** That is a dev, a master technician, an assistant or a controller.
- **The leader approves, holds, sets a standing rule and signs the affidavit.** That is a master technician or a dev. The database refuses an approval from anyone else.
- **The same office roles can see it.** Customers never see lien paperwork in their portal.

## The step by step guides

- [send lien notices from the Lien desk](/help/send-lien-notices-from-the-lien-desk) covers Next up, the piles, approval and the run.
- [answer an owner who calls about a lien letter](/help/answer-an-owner-who-calls-about-a-lien-letter) covers the call sheet.
- [file a lien and never miss its deadlines](/help/file-a-lien-and-never-miss-its-deadlines) covers the job's Lien window.
- [give a customer a lien release](/help/give-a-customer-a-lien-release) covers releases, signing and the follow through.
- [send a sub the right lien waiver](/help/send-a-lien-waiver) covers the four Texas waiver forms.
- [see when a customer will pay](/help/see-when-a-customer-will-pay) covers the forecast's work month panel.
