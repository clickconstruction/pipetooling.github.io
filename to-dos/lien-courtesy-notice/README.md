---
name: "A courtesy notice between the § 53.056 notice and the lien"
number: 231
group: gated
status: looked at and drawn 2026-11-01 · the owner took all six recommendations the same day ("Take all recommended") · nothing built; the word to build the four PRs has not come · counsel's read of the words comes before the first real send
summary: >
  Supply houses send a plain letter a week or two before they lien: we already sent you the notice,
  nothing has come, here is the day the lien goes on unless it is paid, here is where to pay, here is
  who to call. The Lien desk has no such step. Between the § 53.056 notice and the affidavit it offers
  only letter two, a second certified statutory packet, and on the live desk fifteen sent notices sit
  at "day 18 · letter two overdue" with none pressed. The proposal is one press on the sent notice,
  Send a courtesy notice, from day 7: an email and a text in plain words, built from the sent notice's
  own facts, naming the lien's day, carrying the pay link and the office's number, recorded on the
  Timeline so the affidavit's packet shows it went. No new statutory paper, no certified mail, no new
  claim.
next: >
  The owner's word to build. Then PR 1, the kernel, which changes no screen; counsel reads the words
  before PR 2's first real send.
size: M (four PRs: S, M, S, XS; one function redeploy; no migration)
blocker: The owner has not yet said to build; counsel's read of the courtesy words before the first real send.
opinion: build — the gap is real and visible on the desk today; the shape reuses the sent notice, the pay page and the cover letter's three doors, so the words are already counsel's
---

# A courtesy notice between the § 53.056 notice and the lien (#231)

## The ask

The owner, 2026-11-01, verbatim: *"Take a look at the lean desk. What I have noticed is that we have tools for sending out notices and we have tools for sending out liens. But what a lot of supply houses do is they contact the group before a lean goes out and they say, Hey, we are going to lean you. We've already sent you a notice. Here is where you can pay. If you have any issues, contact us. Can you take a look at the lean desk and figure out if we have the functionality to offer this additional notice between the first notice and the lean itself. This is kind of a courtesy notice, but it seems to convert well. It seems to convert people to pay their bills. If we don't have it, can you help me think of what we might need to offer to add this? It seems like we're just resending the notice. And maybe that's all we need to do. And we just need to offer it in a way that is friendly and honest. Take a look and let me know what you think we should build, and show me a mock-up of what that could be like."*

## What I found

I walked the desk's code, its kernels and their tests, counsel's memo of 2026-09-22, the help guides, and the deployed app as the dev, read only.

### Every letter the desk can send today

| Paper | Says | To whom | Channel | When the desk offers it |
|---|---|---|---|---|
| **§ 53.056 notice** (`lienNoticeDraft.ts`, the run) | The statute's form: claimant, months, claim amount, the WARNING block; counsel's cover letter as page 1 of the owner's copy (you did not hire us, this is not a lawsuit, withhold under § 53.081, three doors to end it, none a joint check, "we would rather pick up a check than file a lien on your property", the signer's name and number); the pay codes page ("Once these bills are paid, there will be no lien filed", one QR code per Stripe bill, the owner's rule to pay only with the GC's written okay); the invoices behind it | The owner of record and the GC | Certified mail (printed run or Docsmit); email as a method where an address is on file; the GC gets a **courtesy PDF by email** when the run records ("Attached is a courtesy copy of our notice… For questions call the office") | Per unpaid work month, due the 15th of the third month after it (second on residential); Do now lists it inside 30 days |
| **The pay offer** (`lienPayOffer.ts`, v2.4713) | A discount on each enclosed bill paid in full by a day; a Stripe credit while it runs | Whoever pays | Rides the pay page | The leader ticks it when he approves a notice; never later than a week before the affidavit |
| **Letter two** (`lienLetterTwo.ts`, counsel's memo) | A second owner letter on the same § 53.056 form: the *paid-out* letter (three questions, the 10 %, the affidavit's month) or the *unresponsive* letter (stop the next payment, three ways to end it, "we will file the lien affidavit… by the 15th day of the fourth month") | The owner and the GC, both again | Certified mail, through drafting, the leader's approval and the run | From day 10 after the packet, overdue from day 14; off once paid, once the GC authorized direct pay, once the owner called |
| **§ 53.057 retainage notice** | The statute's retainage form with counsel's retainage cover letter | The owner and the GC | Certified mail, the run | 30 days after our contract on the job ends |
| **The demand letter** (`demandLetter.ts`, the Lien window) | "Final demand for payment": the statement of account, pay codes under the amount box, the remedies (small claims, a Chapter 53 lien with its filing window, theft of services off by default), attorney's fees under CPRC § 38, interest, the notice history | The party in privity: the GC on a sub job, the owner only when we are the original contractor | Email with the PDF, or print and record by hand | Any time from the Lien window; not a Chapter 53 step |
| **The affidavit, the service, the release** | The lien itself and what follows it | The county, then the owner and the GC | Paper, the county clerk, certified mail | The 15th of the fourth month after the last work month (third on residential) |
| **The owner's portal card** (`PortalPropertyNoticeCard.tsx`) | Counsel's owner letter in short, with a Call button | The owner, when they open their portal | The portal | From the day the notice is recorded sent |
| **Messages** (`legalLines.ts`) | The notice, a demand letter or a release as a grey read-only line | The person's thread | Messages | After each send; replies go to the office |
| **The Collect desk** (`collectMoves.ts`) | The one move per payer and the words to say on the phone; the lien chip beside it | The office | A call sheet | Every day |
| **The owner's call** (`lienCallScript.ts`) | Counsel's words when an owner calls about the letter | The office | The ☎ button | While a letter is out |

Nothing above is a short, friendly, electronic reminder. The GC's courtesy PDF is the nearest thing by channel, but it goes on day 0 with the notice, says only "attached is a courtesy copy", and carries no pay link and no lien day.

### The plain answer

**No.** There is no step that resends the notice with a pay-here line and an "about to lien" warning. The only step the desk offers between the sent notice and the affidavit is **letter two**, and letter two is heavy on purpose: a second statutory packet, counsel's words, the leader's approval, certified mail to two addresses, and the run.

The live desk on 2026-11-01 shows the cost of that weight. Fifteen notices sent on October 6 and October 14 sit under *Needs you now* reading **day 18 · letter two overdue** (day 26 on three), every one with the same blue button, **Send letter two**, and none pressed. Their affidavits are due November 16, fifteen days away. The sent footer under each reads *GC paid: no · GC authorized direct pay: no · Owner called: not yet*. So on the busiest month the desk has had, the one step offered in the gap was not taken, and the next thing that will happen is the lien itself.

What the near things lack:

- **Letter two** is certified mail and a statutory form again. It cannot be sent in a minute, and it reads to the owner as a second legal notice, not a reminder. It goes to the owner first; on a sub job the GC is the one who pays.
- **The demand letter** carries the pay codes and the lien's day, but it is a *final demand* with remedies, fees and interest, counsel keeps that voice off the owner's envelope, and it goes from the Lien window, outside the desk's path.
- **The courtesy PDF** goes only to the GC, only on day 0, and says nothing about paying.
- **A Collect desk move** is a phone call, not a send, and the Collect desk reads payers, not notices.
- **The portal card** waits for the owner to open the portal; nothing pushes it to them.

### The law and the tone

- **Texas has no statutory "notice of intent to lien".** The supply houses' letter is a courtesy in Texas too. That is good: ours need not carry statutory words, and must not look as though it does. It says in its first line that the notice we mailed stands and this is a reminder, not a new notice.
- **It may not threaten what we cannot do.** Texas Finance Code § 392.301(a)(8) forbids threatening an action not permitted by law, and the company collects its own debts under that chapter. The demand letter already gates its lien sentence with `lienLineBlockedReason` (homestead, no work month, the window closed). The courtesy notice reuses that gate, and the lien's day comes from the timeline's live affidavit step. When the gate refuses, the message is held and the row says why, the way a run envelope is held.
- **It keeps counsel's never-say list**: no "the law makes you pay us", no joint check, no interest or fees, no theft of service, nothing about the GC's other jobs, no "you are in default". The owner's copy keeps the owner's rule from the pay page: pay us only with the GC's written okay, otherwise hold the amount back.
- **One number, the sent notice's.** The claim is the notice's claim, not the job's whole balance, with the pay page's *still owed* figure where a bill has been part paid. Stale months stay in the footnote where counsel put them.
- **What it reuses, word for word**: the cover letter's three doors, the pay page's title sentence and its owner rule, the pay link (`clicktooling.com/pay/<id>`, good until the bill is paid), the signer's name and number, the office's reply-to (`office@clickplumbing.com`).

## The decision

**Picked: one press on the sent notice, *Send a courtesy notice*, from day 7, by email and text, recorded on the Timeline.** Letter two stays behind it as counsel's certified second letter.

Weighed and set aside:

| Shape | Why not as the main answer |
|---|---|
| Resend the notice as it is | A second statutory packet reads as a new notice, costs certified postage twice, and is what the desk already offers and nobody presses. |
| A Collect desk sentence | The Collect desk is a call sheet by payer; a courtesy *send* belongs on the notice it reminds about. A later line there (*courtesy notice due on 2 jobs*) is worth adding once the send exists. |
| A letter-two variant | Letter two is counsel's, certified, and for the owner. The courtesy notice is ours, electronic, and mostly for the GC. Mixing them would make counsel's letter lighter and ours heavier. |

### The shape

1. **Where it sits.** The sent notice's footer on the Lien desk and the same job's Do now row. From day 7 after the packet (the Docsmit delivery clock when a piece knows better, `letterTwoClock`), the row's button reads **Send a courtesy notice** and the footer's sentence reads *Nothing has come since the packet. A courtesy notice goes by email and text in a minute; letter two is counsel's certified second letter from day 10.* Letter two's button stays beside it. The Legal desk's Paper tab shows the same button under *Where each job stands* through `legalPaperNextDoor`, and the job's Lien window names it on its next-step card.
2. **What it says.** One message, the same words for both recipients, built from the sent notice: the notice's day and how it went, the claim, the months, the day the affidavit goes on unless paid, where to pay, who to call. The owner's copy adds the pay page's owner rule and *nothing here is billed to you*. The words are in the mock-up.
3. **Who gets it.** The GC's contact on the job (the email the run already sent the courtesy PDF to; a text when their card says we may text, `textRefusal`). The owner of record when the property record holds an email (`job_property_owners.owner_email`). Never certified mail: it is not a statutory paper.
4. **Who presses.** The office roles, no leader approval: the message changes no claim and sends no statutory form. The record names who pressed. A GC's standing rule may later send it by itself on day 7 (not in this build).
5. **When it is offered.** From day 7 after the packet; amber from day 10 with letter two; held when the lien's day is inside 7 days (the affidavit is the next press then), when the affidavit's gate refuses (homestead, the window closed), or when a courtesy notice already went in the last 7 days.
6. **What closes it.** The claim paid (`openBalance ≤ 0`), the owner's call recorded, the GC's written okay, a reply in Messages on that job, the affidavit filed, or a second press. The row drops the button and the footer says which.
7. **What it records.** `courtesy: [{ at, by, to: [{ who, channel, address, emailId | textId }], lienDay, held? }]` on the sent desk item's `fields`, beside `ownerCall` and `gcAuthorizedDirectPay`. The Timeline gains a square *Courtesy* node after the notice (the demand letter's shape); the job trail gets a `lien_courtesy_sent` line; the Legal desk's *Under a notice* band and the firm's portal read it; Messages shows it as a grey legal line with a reply box that goes to the office.

## What the build needs

| PR | What | Size |
|---|---|---|
| 1 | `src/lib/jobs/lienCourtesyNotice.ts`: the words (email subject and body, the text, the owner's variant), the state (`waiting · due · held · sent · closed` with the reason), who gets it, the gate over `lienLineBlockedReason` and the timeline's affidavit step, the record's shape; tests for every state and both recipients | S |
| 2 | The press: the footer's sentence and button, the Do now row's action (`lienNextUp.ts` gains `courtesy`), the send through `send-lien-filing-email` (a new `email_type: 'lien_courtesy'`, no attachment, reply-to the office) and `quo-send` (the sender's box, the consent rule), the record on the item through `lienDeskIo.ts`, the job trail line, the toast with what went and what was held; render tests | M |
| 3 | The record read back: the Timeline node (`lienTimeline.ts` `courtesy` step), the Legal desk's *Under a notice* band and the firm's portal (`legalLienPaper.ts`), Messages' legal line (`legalRoute.ts`), the portal card's line *we also emailed you on …*; the Collect desk's move line | S |
| 4 | The help guide *send a courtesy notice before a lien* (the step, the words, what closes it, what it never says), a line in *answer an owner who calls about a lien letter* for "I got your email", the Rules window's row, `GLOSSARY.md` | XS |

- **Migration:** none. The record rides the sent item's `fields`, as the owner's call does.
- **Edge functions:** `send-lien-filing-email` redeployed with the new kind (one line in its instrument switch, the subject and body from the caller). `quo-send` unchanged. No new function.
- **Counsel:** reads the words before the first real send, as the supply house paragraph waits on him today.

## The mock-up

[`mockup.html`](./mockup.html), made-up data (Ridgeway Builders, Cibolo Crossing Ltd, job 741). Three boards: the Do now row and the sent footer with the new button and its held state; the message as the GC reads it on a phone, as a text and as an email, and the owner's copy; the Timeline, the job trail and the Legal desk's band afterwards. A fourth board lists the words it never says.

## How to verify

1. On the dev server, open the Lien desk on a ZZ Test job with a GC whose notice is recorded sent more than 7 days ago (record it by hand on the § 53.056 tab, *Already sent — record it…*, with a day a week back).
2. The Do now row reads **Send a courtesy notice**; the footer says why. Press it: the window shows both recipients, each with its channel, and the words. Send with a ZZ Test email and a test number only; a real GC's address must never be in the window.
3. The toast names what went and what was held. The footer reads *courtesy notice sent today by email and text*; the Timeline shows the square node; the job's History shows the line; the Legal desk's Paper tab shows it under the notice.
4. Record a payment that clears the claim: the button is gone and the footer reads *paid*. Record the owner's call: the same.
5. Set the property to homestead, or move the last work day so the window has closed: the row reads *Courtesy held · …* with the reason, and nothing can be sent.
6. Delete the ZZ Test job and its rows before the session ends.

## Is this the best we can do?

- **The simpler shape.** Simpler still would be one line on the day-7 footer, *Email the GC a reminder ›*, that opens the mail app with the words filled in. It would be in use tomorrow. It would also record nothing, so the affidavit's packet could not show the reminder went, and the office would retype it on fifteen jobs. The press with a record is the same effort for the office and keeps the paper trail counsel asked for.
- **What a supply house's letter does that ours copies.** It is short. It names the day. It names one number. It says where to pay in one line. It is signed by a person with a phone number. It arrives by a channel the reader checks that day. Ours does each of those. What a supply house's letter often does that ours must not: call itself a *Notice of Intent to Lien* as if it were a statutory step, and name interest and fees.
- **The risk of a notice that sounds like a threat.** The sentence that converts is the one that names the day the lien goes on. It is also the one sentence that can be unlawful if the lien cannot in fact go on. So the day is never typed: it comes from the live affidavit step, through the same gate the demand letter uses, and the message is held rather than sent without it. The frame is counsel's: we would rather pick up a check. The office can edit nothing but the greeting, so the words stay what counsel read.
- **What is still thin.** Texting the GC's contact needs their card to say we may text; most GC contacts have not been asked. The owner's email is on few property records today, so most owners will get nothing from this until the roll lookup or the office fills it. Both are honest limits, and the window says so per recipient rather than pretending.

## The owner's picks

The owner, 2026-11-01, on the six calls below: *"Take all recommended."* Each is settled as its first option. The word to build the four PRs has not come yet; the card waits for it.

1. **Who presses.** The office alone (the recommendation, **picked**), or the leader approves each one as he does a notice.
2. **The owner too.** Send the owner a copy when their email is on file (the recommendation, **picked**, with counsel's rule to copy the GC on every owner letter kept the other way round), or the GC only.
3. **Texts.** Text the GC's contact when their card allows it (the recommendation, **picked**), or email only.
4. **Day 7.** Offer it from day 7 and let letter two keep day 10 (the recommendation, **picked**), or offer both on day 10.
5. **Counsel first.** Counsel reads the words before the first real send (the recommendation, **picked**), or the office goes ahead and counsel reads the record.
6. **The pay offer.** When a discount offer is live on the notice, the courtesy notice repeats its sentence (the recommendation, **picked**), or stays silent on it.
