---
title: bid to your marked-up plans when the drawings are too rough to read
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: bid basis, marked-up plans, counttooling, export pdfs, cover letter, plans as issued, our marks govern, attach plans, file name, search b409, stamped
order: 97
---
Some plan sets arrive so faint or garbled that you cannot bid to them as issued. The answer is to bid to your own marks and say so in the letter.

You export the sheets you counted from CountTooling. You send that file with the proposal. ClickTooling keeps the record of which file you sent and which marks were on it.

## Before you start

The bid needs its **CountTooling plans** link. The Counts import sets it the moment you paste a takeoff, your count of the fixtures on the plans. Or you can paste the view link into Edit Bid. Without it the Bid basis card does not show a button.

## Get the marked-up plans

Open the bid in **Bids → Cover Letter**. In step 2, the **Bid basis** card reads *Plans as issued*. Click {{button:blue|Get marked-up plans from CountTooling}}.

1. CountTooling opens in a new tab as you. There is no email prompt. It shows its **Export PDFs** dialog already set up. Only the sheets that carry marks are in. The takeoff report goes first. Notes ride at the back. The file is rendered lighter than a normal export so it stays emailable. Sheets with no marks are dimmed and say *no marks*. Change anything you like.
2. Click **Download** there. In Chrome or Edge a save dialog asks where to put the file. Elsewhere it lands in your Downloads folder. Either way the name is one you can search for later:

   `bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432.pdf`

   The bid number comes first. So searching your computer for **b409** finds every export for that bid.
   If you picked a different name in the save dialog, that is the name ClickTooling records.
3. CountTooling shows a **Downloaded** card with the file name and a **Copy** button. It tells ClickTooling. Back in the Cover Letter, the card flips to *Marked-up plans · stamped*. It shows the file name, the sheets, who exported it and when, and the takeoff's last-saved time.

:::example If the tab never reports back
Closed the CountTooling tab early, or the browser blocked the popup? Click {{button:outline|Mark as attached by hand}} in the waiting dialog and confirm the file name (it is prefilled with the name CountTooling would have used). The bid is stamped without a marks snapshot.
:::

## Say it in the letter

Turn on the {{chip:blue|Bid to our marked-up plans}} pill in **Include in the letter**. It stays dashed until an export exists. So the letter can never claim a file that is not there. On, the letter gains a **Bid basis** line beside the plan date:

> *Bid basis: This proposal is based on our marked-up copy of the plans dated 8/14/26, which accompanies this letter (6 sheets: P-101, P-102, P-201, P-301, P-401, P-501). Where our marks and the issued drawings differ, our marks govern.*

The fixture header changes to *per our marked-up plans* at the same time. The Approval PDF carries the same line. Attach the downloaded file to the proposal you send. The letter names it, but ClickTooling never emails the file for you.

## Later

- **Takeoff changed since.** The takeoff may be saved again after the export. Then the next open of CountTooling from the card turns it amber. {{button:blue|Export again}} makes a fresh file with a new time in the name. The old row stays in the history.
- **Which file did we send?** The card's **History** and the bid's **Full bid details** on Followup list every export. Each shows its file name and date. Each row keeps its marks snapshot. That is CountTooling's Canvas JSON. So the exact marks can be put back on a fresh copy of the plans.
- **Remove** clears the current stamp. The pill turns back off.
