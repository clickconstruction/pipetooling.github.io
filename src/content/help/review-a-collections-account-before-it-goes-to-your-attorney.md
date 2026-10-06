---
title: review a collections account before it goes to your attorney
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, collections, packet, sworn account, lien clock, demand letter, worth it, write down, theory, exhibits, contact history, attorney ready, release, held back, ask a dev
---
Before an account that will not pay goes to a law firm, the office should see what the firm sees. The Legal desk in the Pipeline's Collections section is that review, one account at a time.

You fix what an attorney asks for first. The **⚖ Legal** desk is where you do it.

## Open the desk

On **Jobs → Pipeline**, the **Collections** header carries {{button:outline|⚖ Legal}}. On a computer the button sits at the header's right, just before **Lien desk**. Billed Awaiting Payment carries Accounts Receivable on its own header. You press it to open the desk on every Collections account, largest net first. The desk also opens from a link: `/jobs?tab=stages&legal=1`. You use `legal=<payer key>` for one account.

An **account is the payer**. The payer is the GC, the general contractor, when one pays. Otherwise it is the customer. The account spans every Collections job that payer owes on. Two jobs for the same customer are one account. That is because a petition, the paper that starts a lawsuit, names one defendant.

## Read the top first

The rail on the left lists accounts by **what Click would keep** if every dollar landed. That is the balance less the firm's third and a filing cost. Under the account name:

- **Theory** is what an attorney could plead today. It reads {{chip:green|Signed contract}}, {{chip:yellow|Sworn account}}, {{chip:yellow|Lien only}}, or {{chip:red|None yet}}. A sworn account means three things are true. The customer received the bill. A report or clock session with GPS places a crew on the property. And no dispute is on record. A lien is a legal claim on the property for unpaid work.
- **Click keeps** is the balance after the firm's cut and costs, with a verdict. The verdict is worth it, marginal or not worth it.
- **Against pursuing** lists facts on record that argue for writing it down instead. Writing it down means giving up the balance. Examples are a "no money" note, a dispute, broken promises, or a payer that is a name only.

Then comes **Before this goes to an attorney**. {{chip:red|fix}} items are what an attorney asks for first. Those are no agreement and no sworn-account basis, no way to reach the payer, or no address. {{chip:yellow|note}} items are worth knowing. Those are no demand letter, a lien window still open, or an incomplete property record. They also include no field evidence, or never asked when they'd pay. A demand letter is the formal ask for payment. Most lines have a button that opens the surface that owns the record. That may be Contract desk, the job's Lien window, Edit customer, Edit job or Call mode. The desk refreshes when you come back.

## The five tabs

The same five the firm will see:

- **Account** shows who owes, contacts, the jobs, every invoice and payment in date order, and the property record.
- **Paper** shows agreements per job with the sworn-account column, *Where each job stands*, demand letters and *The paper that went out*. *Where each job stands* shows each job's notice and affidavit dates, drawn from its approved hours, its filings and the property kind. *The paper that went out* lists each notice, affidavit and release. An affidavit is the sworn lien filing. The monthly notice applies when a GC pays.
- **Their word** is one timeline of everything said. It holds contacts logged on the customer, payment promises and whether they were kept, collection calls, and the collections note. **Every entry goes to counsel** unless you hold it back. Counsel means the law firm. Held entries show struck through. The firm sees this tab as **Record of contact**.
- **Evidence** shows field reports and clock sessions per job. It shows how many carry GPS, hours, first and last work day, and photo and Drive links.
- **Fees & steps** shows what the office did, in order. It shows the exhibits the packet would carry, lettered A onward. Exhibits are the documents attached to the packet.

Most section titles carry an ↗ door to where their data is edited.

:::example A red gap that is not really red
The Learning Experience has no signed contract on either job. With a sent Stripe invoice and 22 GPS clock sessions on the property, the desk reads {{chip:yellow|Sworn account}} and the contract gap is a note, not a stop. The day a dispute is logged in call mode, the theory drops to {{chip:red|None yet}} and the gap turns red — that is the desk telling you the dispute has to be answered before the account is worth referring.
:::

## Two exits

{{button:outline|⎙ Print packet}} prints the cover sheet, then the five sections with held entries left out. The cover sheet holds the theory, the worth and the gap list. The browser's print-to-PDF is the PDF a firm receives today.

{{button:outline|Write down…}} opens the agreed write-down on the account's largest open bill line. It is for the accounts the desk says are not worth pursuing. The matter closes as {{chip:gray|Written down}}. The row leaves Collections when the bill clears.

{{button:dark|⚖ Mark attorney ready…}} is the release, and only a dev sees it. The sheet says what goes: jobs, balance, theory, exhibits, and how many entries are held back. It names the handling person at the firm and who hears about it. It takes a note for the firm. It warns when red gaps are still open. You can mark anyway, and the packet's cover sheet says so. {{button:outline|Preview what the firm sees ↗}} opens their page for this account before anything is released. That page has all five tabs and the exhibits, with held entries left out and your note in place. You confirm, and the account moves to **With the firm**. The row wears a {{chip:yellow|⚖ new}} chip and each job's Activity records the release. **Pull back** returns it to review. Only a dev sees it. The firm's fees and steps stay on the record.

## Curate what the firm sees

On **Their word**, every entry goes to counsel. Records can be shown in court either way, so your own lawyer should not be surprised by them.

To keep one entry from the firm, press {{button:outline|Hold back…}} on its row. Type why, then press {{button:dark|Hold back}}. The button stays off until you type a reason. The reason shows under the entry, for the office only.

Held entries show struck through. They never reach the printed packet, and they never reach the firm. The firm sees how many were held, never what or why. {{button:outline|Share}} on a held row sends it again. {{button:outline|Share all ↗}} clears every hold.

## Ask a dev to review

Office staff can move a job to Collections but cannot release it. {{button:outline|Ask a dev to review…}} takes a short note. It puts the account at the top of the dev's Needs You card. The card reads "N Collections accounts await your review before an attorney sees them". It opens the desk on that account. The account's header shows who asked and how many days ago. **Withdraw the request** takes it back.

## The firm

Settings → Jobs & billing → **Collections law firm** holds the firm's details. Only a dev sees it. It holds the firm's name, the handling person, a contact email and phone, and the fee model behind "Click keeps". The fee model is the contingency % and the filing cost. The contingency % is the firm's share of what is recovered. The contact email is not a subscription. The firm's own people and their email rules come from the portal's Notifications page. Nobody is emailed until they are on that list and confirmed.

## When the firm acts

Once an account is with the firm, their fees, steps, questions and payments received arrive on the desk. Steps, questions and payments land on the **Fees & steps** tab, under **On the matter**, counted as waiting on you. Fees and costs list under **Attorney fees and costs**. They also show on the Dashboard as "The law firm has N things for you". You answer a question inline. You acknowledge a fee or step. For a payment received, you apply it on the job with Mark Paid. Then you press **Mark applied** so the recovery and the firm's cut are on the record.

The whole path runs from moving a job to Collections to the matter closing. It is in [send a customer account to your attorney](/help/send-a-customer-account-to-your-attorney).
