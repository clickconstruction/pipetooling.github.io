---
title: read the Texas lien rules the app follows
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien, Texas, rules, Property Code, chapter 53, 53.056, 53.052, affidavit, notice, release, waiver, demand letter, presentment, sworn account, interest, prompt payment, 28.004, 302.002, debt collection, 392, theft of service, 31.04, justice court, certified mail, cite, statute, deadline, homestead, residential, find a rule
---
Every lien deadline and every line in a demand letter comes from a rule in Texas law. This page lists each rule the app follows. It says what the rule is, what the app does about it and where the rule comes from.

## How to use this page

Each rule has three parts. **What it says** is the rule. **What the app does** is where you see it on screen. **Cite** is the law it comes from.

Press {{button:outline|§ Rules}} on the Lien desk. These rules open in a window over the desk, at the rule for what is on screen. A find box at the top narrows the rules to what you type. Enter walks the matches and Esc closes the window. The Lien window has the same button. In a demand letter, the section numbers beside the interest switches open their rules here.

New to liens? Start with [understand how liens work and which lien tool to use](/help/understand-how-liens-work-and-which-lien-tool-to-use).

This page was checked on 2026-09-14 against the statute text at statutes.capitol.texas.gov. The case cites were checked on FindLaw and Justia. This page is the one copy of the rules. When a rule changes, it changes here.

## Find a rule

**The clock**

- [The month rule](#the-month-rule)
- [Residential shortens everything by a month](#residential-shortens-everything-by-a-month)
- [Weekends roll, holidays are not modeled](#weekends-roll-holidays-are-not-modeled)

**The notice**

- [Sub vs original contractor](#sub-vs-original-contractor)
- [The § 53.056 notice](#the-s-53-056-notice)
- [What the notice does for the owner](#what-the-notice-does-for-the-owner)
- [The owner demand is gone](#the-owner-demand-is-gone)

**The lien**

- [The affidavit](#the-affidavit)
- [Releases and waivers](#releases-and-waivers)

**The demand letter**

- [Attorney's fees need presentment](#attorney-s-fees-need-presentment)
- [Demand exactly what is owed](#demand-exactly-what-is-owed)
- [Sworn account](#sworn-account)
- [Delivery](#delivery)
- [Justice court](#justice-court)

**Interest**

- [Interest: Prompt Payment](#interest-prompt-payment)
- [Interest: the legal rate](#interest-the-legal-rate)

**Limits on a collection letter**

- [Debt collection from a homeowner](#debt-collection-homeowners)
- [Theft of service](#theft-of-service)

**Open questions**

- [Not yet verified, or for the attorney](#not-yet-verified-or-for-the-attorney)

## The clock

:::example Work done in June and not paid
On a commercial job with a GC, the notice is due September 15 and the lien is due October 15.
On a house with a GC, the notice is due August 15 and the lien is due September 15.
A 15th on a weekend moves to Monday.
:::

### The month rule

**What it says.** Every lien deadline counts from the month the labor or materials were furnished. It never counts from the bill date. Each unpaid month has its own clock. The clock reads the approved clock sessions.

**What the app does.** Three places count from the work month. They are the Payment forecast's month panel, the Lien desk queue and the notice's *months covered* line.

**Cite.** *Prop. Code § 53.056(a-1), § 53.052*

### Residential shortens everything by a month

**What it says.** Some properties are residential. They are a house, a duplex, a triplex, a fourplex and a condo unit its owner lives in. On a residential property every deadline moves a month earlier.

**What the app does.** The property record's kind decides it. The notice date and the filing date shift a month earlier. When the kind is not known, the app shows the commercial dates and says so.

**Cite.** *§ 53.001(10), § 53.052(b), § 53.056(a-1)*

### Weekends roll, holidays are not modeled

**What it says.** A deadline on a Saturday, a Sunday or a legal holiday moves to the next business day.

**What the app does.** The app moves weekends only. When the 15th is a holiday, the app still shows the 15th. That is the earlier, safe date.

**Cite.** *§ 53.003*

[Back to Find a rule](#find-a-rule)

## The notice

### Sub vs original contractor

**What it says.** A GC on the job means we are a subcontractor. GC means the general contractor. Then every unpaid month needs a notice before any lien. The notice goes to the owner and to the GC. No GC means we contracted with the owner. Then no monthly notice is needed. The affidavit stands alone.

**What the app does.** The notice tab shows a *Role* line. The Lien desk's Notices list shows only jobs with a GC.

**Cite.** *§ 53.056, § 53.052*

### The § 53.056 notice

**What it says.** The notice is a form the statute sets. It goes to the owner of record and to the original contractor. It is due by the 15th of the third month after the work month. On a residential property it is due by the 15th of the second month. It goes by certified mail or another service that can be traced. **It may include the invoice.**

**What the app does.** You send it from the notice tab or from {{button:outline|Lien desk}}. The invoice is enclosed behind the notice.

**Cite.** *§ 53.056(a-1) to (a-3), § 53.003*

### What the notice does for the owner

**What it says.** The owner may withhold what we are owed from the GC. This is called fund trapping. The owner is liable for money paid out after the notice.

**What the app does.** Counsel's cover letter goes on the owner's copy of every notice the desk sends. The office can untick the letter on a draft. It says the owner may withhold. It says what paying the GC anyway risks. The demand letter points the owner to the notice. It does not point to a demand.

**Cite.** *§ 53.081, § 53.082, § 53.084*

### The owner demand is gone

**What it says.** The old *§ 53.083* demand for payment to the owner was **repealed**. The repeal covers contracts made on or after 2022-01-01.

**What the app does.** The app has no owner demand. The notice is the paper the owner gets.

**Cite.** *HB 2237 (87th Leg.) § 36(8)*

[Back to Find a rule](#find-a-rule)

## The lien

### The affidavit

**What it says.** The affidavit is the lien itself. It is sworn. It is filed with the County Clerk of the property's county. It is due by the 15th of the fourth month after the last month worked. On a residential property it is due by the 15th of the third month. A copy is served on the owner and the GC within 5 days of filing.

The affidavit needs four things.

- The owner of record.
- The county and the legal description.
- A recorded notice, on a sub job.
- A property that is not a homestead.

**What the app does.** The Mechanic's lien tab checks the four facts first. {{button:outline|Record filing}} records the filing. A red Needs you card watches the serve-by date. {{button:outline|Record service}} records the service.

**Homestead.** A lien on a homestead is invalid without one statement. The *§ 53.056* notice must include that statement or have it attached. The statement is in *§ 53.254(g)*. It names two conditions.

- The owner fails to withhold enough to cover the claim after notice.
- The owner fails to reserve 10 percent during construction and for 30 days after the contractor's work is complete.

The statement closes with a paragraph on what compliance protects. The app prints the statement in the statute's own words. It prints it under the form on every residential or homestead-flagged property. It never prints it on a commercial property. The owner's copy and the GC's copy both carry it.

The *§ 53.056(a-2)* form itself carries no warning block under the current Code. That was read on 2026-09-22. The app prints the form as prescribed.

**Cite.** *§ 53.052, § 53.054, § 53.055*. Homestead is *§ 53.254*.

### Releases and waivers

**What it says.** Once paid, the customer is owed a release. It is conditional while a bill is unpaid. It is unconditional once the bill is paid. A recorded affidavit gets a release of record. A waiver we ask a sub to sign follows one of the four statutory forms. An unconditional waiver may not be required before payment.

**What the app does.** Four places handle them.

- The Release of Lien window.
- **Bill Customer → Lien releases**.
- The Release of record tab.
- **Subs → Pay → Lien waiver**.

**Cite.** *§ 53.281, § 53.284, § 53.286*

[Back to Find a rule](#find-a-rule)

## The demand letter

### Attorney's fees need presentment

**What it says.** Attorney's fees can be claimed on a claim for services, labor, materials, a sworn account or a contract. The claim must first be **presented**. Presented means the customer was asked to pay. Then it must stay unpaid for **30 days**. There is no set form. A demand letter is presentment.

**What the app does.** The demand letter carries a sentence and a date for the fee clock.

**Cite.** *CPRC § 38.001(b), § 38.002*. The case is *Jones v. Kelley, 614 S.W.2d 95 (Tex. 1981)*.

### Demand exactly what is owed

**What it says.** Two mistakes forfeit the fee claim. One is demanding more than is due. The other is refusing tender of the true amount. Tender is an offer to pay.

**What the app does.** The statement of account is read from the bill. It is never typed.

**Cite.** *Findlay v. Cave, 611 S.W.2d 57 (Tex. 1981)*

### Sworn account

**What it says.** A suit on an account needs a systematic, itemized record. The record gives the name, the date and the charge of each item. It allows all payments and credits.

**What the app does.** Each invoice gets a statement of account. The invoice is enclosed as Exhibit A.

**Cite.** *Tex. R. Civ. P. 185*. The case is *Panditi v. Apostle, 180 S.W.3d 924 (Tex. App.—Dallas 2006)*.

### Delivery

**What it says.** Certified mail is required for two things only. They are the chapter 53 notices and the *§ 31.04* presumption. For presentment it is optional. It is still good evidence.

**What the app does.** Certified mail is the default channel everywhere. Email is the second channel. An email is recorded as an email.

**Cite.** *Prop. Code § 53.003*

### Justice court

**What it says.** A justice court hears claims up to $20,000. Interest is not counted in that amount.

**What the app does.** The demand letter's court line uses it.

**Cite.** *Gov't Code § 27.031(a)(1)*

[Back to Find a rule](#find-a-rule)

## Interest

### Interest: Prompt Payment

**What it says.** This rule applies to **every** contract to improve real property. Homeowner jobs are included. There is no residential carve-out. A written payment request is due by the 35th day after it is received. From the day after, the unpaid amount bears 1.5 % a month. Fees are at the court's discretion. Work may not be suspended on a home for one to four families.

**What the app does.** The interest line reads *§ 28.004*. It runs from the 36th day after the bill went out.

**Cite.** *Prop. Code § 28.001, § 28.002(a), § 28.003, § 28.004, § 28.005, § 28.009(e)*

### Interest: the legal rate

**What it says.** This rate applies when no rate was agreed and no written request was sent. It is 6 % a year. It runs from the 30th day after the amount is due.

**What the app does.** The interest line falls back to this rate when the bill was never sent.

**Cite.** *Fin. Code § 302.002*

[Back to Find a rule](#find-a-rule)

## Limits on a collection letter

### Debt collection (homeowners)

**What it says.** Texas has a debt collection act. It binds the original creditor on a **consumer** debt. A homeowner's debt is a consumer debt. A GC's debt is not. The act forbids five things.

- Threatening a criminal charge over a payment dispute.
- Threatening an action the law prohibits.
- Adding a charge that no agreement or statute authorizes.
- Misrepresenting the amount.
- Saying that fees will be added.

Threats of a civil suit or a lien are allowed.

**What the app does.** The lien line is offered only while a lien can still be filed. Every charge names its statute. The letter says it will *seek* fees. It never says they *will be added*. The *§ 31.04* line is off.

**Cite.** *Fin. Code § 392.001, § 392.301(a)(2), (6), (8), (b)(2), § 392.303(a)(2), § 392.304(a)(8), (12), (13)*

### Theft of service

**What it says.** The law can presume intent to avoid payment. That presumption needs a written demand. The demand goes by certified or registered mail with a return receipt. A commercial delivery service also counts. It goes to the address on the service agreement. The bill must stay unpaid 10 days after receipt. This is the source of the app's default of 10 business days.

**What the app does.** The *§ 31.04* line ships **off**. It stays off until the attorney package.

**Cite.** *Penal Code § 31.04(a)(4), (b)(2), (c)*

[Back to Find a rule](#find-a-rule)

## Not yet verified, or for the attorney

A lawyer has not confirmed these readings. The app uses them today.

- Whether a late § 53.056 notice still carries the affidavit while the affidavit window is open. The app says it does since Oct 6, 2026, on the owner's reading. Counsel's memo of Sep 22, 2026 read a closed month as information only.
- Whether a bill counts as chapter 28's written payment request on a homeowner job. The letter says it does today.
- The CPRC chapter 38 sentence on every letter.
- The *§ 31.04* line, and delivery under *§ 31.04(c)*.
- The statutory release text in *§ 53.284*.
- How *TRCP 500.3* treats fees in the justice court amount.
- Whether the Texas Supreme Court reads chapter 392 as reaching original creditors. The Fifth Circuit does, in *Miller v. BAC, 726 F.3d 717*.

The Lien desk's timeline also prints first days, shown as *open since …*. The statute sets only the last days. These three first days are the app's reading.

- A month's *§ 53.056* notice may go out from the 1st of the next month. That holds even before its bill is past due.
- A sub's affidavit may be filed as soon as its notice is mailed, with no wait. Counsel said so on 2026-09-22 for a GC who had stopped answering.
- A sub still on the job may file for months already finished.

[Back to Find a rule](#find-a-rule)
