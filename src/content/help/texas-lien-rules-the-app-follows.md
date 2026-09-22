---
title: read the Texas lien rules the app follows
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien, Texas, rules, Property Code, chapter 53, 53.056, 53.052, affidavit, notice, release, waiver, demand letter, presentment, sworn account, interest, prompt payment, 28.004, 302.002, debt collection, 392, theft of service, 31.04, justice court, certified mail, cite, statute
---
Every deadline, sentence and switch the app uses for liens and collections comes from a rule in Texas law. This page lists each rule the app applies, what it says, what the app does about it, and where it comes from, so the office can read the code the app is following without opening a modal. From the work itself, {{button:outline|§ The rules}} on the Lien desk header and on the Lien window's tab row opens this page at the row that matters for what is on screen, and the section numbers the demand letter prints beside its interest switches are links to their rows here. The map of the instruments themselves is in [understand how liens work and which lien tool to use](/help/understand-how-liens-work-and-which-lien-tool-to-use).

**Verified on 2026-09-14** against the statute text at statutes.capitol.texas.gov; case cites checked on FindLaw and Justia. This page is the one copy: when a rule changes, it changes here, and the surfaces keep quoting the same section numbers.

## The month rule

**What it says.** Every lien deadline counts from the **month labor or materials were furnished**, never from the bill date. One clock per unpaid month. The clock keys on approved clock sessions.

**What the app does.** The Payment forecast's month panel, the Lien desk queue, and the notice's *months covered* line all count from the work month.

**Cite.** Prop. Code § 53.056(a-1), § 53.052.

## Residential shortens everything by a month

**What it says.** A house, duplex, triplex, fourplex, or an owner-occupied condo unit is residential, and every deadline moves a month earlier.

**What the app does.** The property record's kind decides it; the notice and filing dates shift a month earlier. When the kind is unknown the app shows the commercial dates and says so.

**Cite.** § 53.001(10), § 53.052(b), § 53.056(a-1).

## Sub vs original contractor

**What it says.** A GC on the job means we are a subcontractor: every unpaid month needs a notice to the owner **and** the GC before any lien. No GC means we contracted with the owner: no monthly notice, the affidavit alone.

**What the app does.** The *Role* line on the notice tab; the Lien desk lists only jobs with a GC.

**Cite.** § 53.056, § 53.052.

## The § 53.056 notice

**What it says.** A statutory form, to the owner of record and the original contractor, by the 15th of the 3rd month after the work month (the 2nd if residential); certified mail or another traceable service. **It may include the invoice.**

**What the app does.** The notice tab and the Lien desk run {{button:outline|⏱ Lien desk}}; the invoice is enclosed behind the notice.

**Cite.** § 53.056(a-1) to (a-3), § 53.003.

## What the notice does for the owner

**What it says.** The owner may withhold what we are owed from the GC (fund trapping) and is liable for money paid out afterward.

**What the app does.** The Lien desk's cover note says so; the demand letter points the owner to the notice, not to a demand.

**Cite.** § 53.081, § 53.082, § 53.084.

## The owner demand is gone

**What it says.** The old § 53.083 "demand for payment to the owner" was **repealed** for contracts on or after 2022-01-01.

**What the app does.** There is no owner-demand instrument in the app; the notice is the owner-facing paper.

**Cite.** HB 2237 (87th Leg.) § 36(8).

## The affidavit

**What it says.** The lien itself: sworn, filed with the County Clerk of the property's county by the 15th of the 4th month after the last month worked (the 3rd if residential). It needs the owner of record, the county and legal description, a recorded notice on sub jobs, and a property that is not a homestead. A copy is served on the owner and the GC within 5 days of filing.

**What the app does.** The Mechanic's lien tab's four-fact gate, {{button:outline|Record filing}}, the serve-by watch (a red Needs-you card), and {{button:outline|Record service}}.

**Homestead.** A lien on a homestead is invalid unless the § 53.056 notice includes or has attached the statement in § 53.254(g): the two conditions (the owner fails to withhold enough to cover the claim after notice, or fails to reserve 10 percent during construction and for 30 days after the contractor's work is complete) and the closing paragraph on what compliance protects. The app prints that statement in the statute's own words under the form on every residential or homestead-flagged property — never on a commercial one — on the owner's copy and the GC's alike. The § 53.056(a-2) form itself carries no warning block under the current Code (read 2026-09-22); the app prints the form as prescribed.

**Cite.** § 53.052, § 53.054, § 53.055, § 53.254 (homestead).

## Weekends roll, holidays are not modeled

**What it says.** A deadline on a Saturday, Sunday or legal holiday moves to the next business day.

**What the app does.** The app rolls weekends only. A holiday 15th shows the earlier, safe date.

**Cite.** § 53.003.

## Releases and waivers

**What it says.** Once paid, the customer is owed a release: conditional with an unpaid bill, unconditional once paid. A recorded affidavit gets a release of record. Waivers we ask a sub to sign follow the four statutory forms, and an unconditional waiver may not be required before payment.

**What the app does.** The Release of Lien window, Bill Customer → Lien releases, the Release of record tab, and Subs → Pay → Lien waiver.

**Cite.** § 53.281, § 53.284, § 53.286.

## Attorney's fees need presentment

**What it says.** Fees on a claim for services, labor, materials, a sworn account or a contract require the claim to be **presented** and unpaid for **30 days**. There is no form; a demand letter is presentment.

**What the app does.** The demand letter's fee-clock sentence and date.

**Cite.** CPRC § 38.001(b), § 38.002; *Jones v. Kelley*, 614 S.W.2d 95 (Tex. 1981).

## Demand exactly what is owed

**What it says.** Demanding more than is due, or refusing tender of the true amount, forfeits the fee claim.

**What the app does.** The statement of account is read from the bill, never typed.

**Cite.** *Findlay v. Cave*, 611 S.W.2d 57 (Tex. 1981).

## Sworn account

**What it says.** A suit on an account needs a systematic, itemized record: the name, date and charge of each item, with all payments and credits allowed.

**What the app does.** The statement of account per invoice; the invoice enclosed as Exhibit A.

**Cite.** Tex. R. Civ. P. 185; *Panditi v. Apostle*, 180 S.W.3d 924 (Tex. App.—Dallas 2006).

## Debt collection (homeowners)

**What it says.** Texas's act binds the original creditor for a **consumer** debt (a homeowner, not a GC): no threatening a criminal charge over a payment dispute, no threatening an action prohibited by law, no charge that no agreement or statute authorizes, no misrepresenting the amount, and never "fees will be added". Civil suit and lien threats are allowed.

**What the app does.** The lien line is offered only while a lien can still be filed; every charge names its statute; the letter says it will "seek" fees, never that they "will be added"; the § 31.04 line is off.

**Cite.** Fin. Code § 392.001, § 392.301(a)(2), (6), (8), (b)(2), § 392.303(a)(2), § 392.304(a)(8), (12), (13).

## Interest: Prompt Payment

**What it says.** Applies to **every** contract to improve real property, homeowner jobs included; there is no residential carve-out. A written payment request is due by the 35th day after receipt; from the day after, the unpaid amount bears 1.5 % a month; fees are at the court's discretion; suspension of work is unavailable on 1- to 4-family residential.

**What the app does.** The interest line reads § 28.004 from the 36th day after the bill went out.

**Cite.** Prop. Code § 28.001, § 28.002(a), § 28.003, § 28.004, § 28.005, § 28.009(e).

## Interest: the legal rate

**What it says.** With no agreed rate and no written request, 6 % a year from the 30th day after the amount is due.

**What the app does.** The interest line's fallback when the bill was never sent.

**Cite.** Fin. Code § 302.002.

## Theft of service

**What it says.** The presumption of intent needs a written demand by certified or registered mail with return receipt (or a commercial delivery service) to the address on the service agreement, unpaid 10 days after receipt. This is the source of the app's 10-business-day default.

**What the app does.** The § 31.04 line ships **off** until the attorney package.

**Cite.** Penal Code § 31.04(a)(4), (b)(2), (c).

## Justice court

**What it says.** Hears claims to $20,000 exclusive of interest.

**What the app does.** The demand letter's court line.

**Cite.** Gov't Code § 27.031(a)(1).

## Delivery

**What it says.** Certified mail is required only for chapter 53 notices and the § 31.04 presumption; for presentment it is optional but evidentiary.

**What the app does.** Certified mail is the default channel everywhere; email is the second channel and is recorded as one.

**Cite.** Prop. Code § 53.003.

## Not yet verified, or for the attorney

These are the app's current readings that a lawyer has not confirmed: whether a bill counts as chapter 28's "written payment request" on a homeowner job (the letter says so today); the CPRC ch. 38 sentence on every letter; the § 31.04 line and § 31.04(c) delivery; the § 53.284 statutory release text; TRCP 500.3's treatment of fees in the justice-court amount; and whether the Texas Supreme Court reads ch. 392 as reaching original creditors (the Fifth Circuit's *Miller v. BAC*, 726 F.3d 717, does).
