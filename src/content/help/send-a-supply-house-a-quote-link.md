---
title: send a supply house a quote link
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: quote link, rfq, supply house, vendor prices, price request, quote page, parts pricing, ferguson, moore supply
---

Texting a parts list works, but then the rep texts prices back and someone retypes them. A **quote link** skips the retyping.

The rep is your contact at the supply house. With a quote link, the vendor opens a page on their phone and types prices straight in. The quote lands on your bid, ready to compare.

## Send the link

1. On **Bids → Pricing**, you open the {{button:green|Supply house prices (RFQ) ▾}} menu beside Share. RFQ means request for quote. You pick **Supply house prices**. The button used to be a bare ▾, but the menu is the same.
2. You scope the list like always: {{chip:blue|Whole job}}, {{chip:blue|Pipe &amp; fittings}}, or hand-picked rows.
3. In the strip above the footer, you **pick the supply house** the link is for. You set a **needed by** date if there's a deadline. Then you tap {{button:blue|Copy with quote link}}.
   - Picking the house also shows what they've quoted before. The line reads like *Moore Supply has last-quoted prices for 12 of these 63 items · newest 3 days ago*. So you know which vendor already knows this scope.
   - Only suppliers you quote from are listed. Some vendors are really an insurer, a rental yard or a payee-only account. Such a vendor is hidden here once someone ticks **Not a supplier we quote from** on its card. The card is under Materials → Supply Houses. The vendor stays there for bills and POs, the purchase orders.
4. You paste into your text or email like always. The list now ends with a `Price it here:` link.

The request is made **when you copy it**. The link goes onto your clipboard first. Only then does the request appear on the desk. Your browser may block the clipboard. Then the link shows in a box to copy by hand. You tap {{button:blue|Link is ready — I copied it}} to save the request. Or you tap {{button:outline|Cancel}}, and nothing is created. No request ever exists that you didn't get a link for.

The link is addressed to that one house. You send a separate link to each vendor you're pricing against.

## Or let ClickTooling send the emails

Next to the copy buttons, **Send by email…** opens the request composer. Each house shows its **contacts as chips**. You tap a chip to CC that contact. You tap the chip again to make that contact the To. A CC'd contact gets a copy of the email when it goes out. There is exactly one To per house. Tapping the To un-sets it, so a typed address can take over. A typed address offers to be **remembered as that house's contact**. Contacts are managed on the supply house form itself.

You set needed-by and add a one-line note. You can also **include the job plans link**, since cut sheets sell fixtures. A cut sheet is the maker's page for the product. Then you **preview every email exactly as it will send** before anything goes out. Each house gets one email and one link. CCs ride the same message. Replies come straight to your inbox.

{{gif:rfq-desk-and-compose.gif|The desk sorts by what needs you. Then a new request: tick the house, and the contact chip is already To. Preview the exact email}}

The **RFQs chip** by Share then becomes your desk. Every request shows as a trail: {{chip:green|Sent}} → {{chip:green|Delivered}} → {{chip:yellow|Viewed}} → {{chip:gray|Quoted}}. Bounced addresses show in red. You fix them right on the row and resend. A one-tap **Nudge** rests 24 hours between sends. Nudge shows you the reminder before it goes. A coverage bar answers "which items does nobody have priced yet?". **Close link** is for when you're done asking. Close link asks you first. A closed request is never gone for good. The closed list at the bottom of the desk shows each one with a {{button:outline|Reopen link}}. Reopen link makes the supply house's page work again.

{{gif:send-a-supply-house-a-quote-link.gif|Pick the house, set needed-by, Copy with quote link. The toast confirms and an RFQ sent chip appears by Share}}

## What the vendor sees

A plain page, no login, built for a phone at the counter:

{{gif:supply-house-quote-page.gif|The vendor types prices, taps can't supply where they don't carry it, and hits Send quote}}

- Every part shows with its count. Each line has a price box, a **can't supply** button and a note field. The price box says `$ each`, or `$ per ft` on a footage line. The job plans link shows when you included one.
- If they've priced these parts for us before, the page offers **"Fill with last time's prices"**. One tap fills the prices in. Then the vendor changes what moved. A repeat quote takes about ninety seconds.
- The footer at the bottom keeps score as they type, in three lines shown together. The first line reads ***"2 of 3 lines answered — partial is fine"***. The second line says whether freight and a good-until date were given. That line reads ***"No freight quoted · no expiry date"*** until they are. The third line reads **"Saves on this phone as you go"**. Getting interrupted ten lines in loses nothing, and the page says so where their thumb is.
- Partial answers are fine. The vendor adds their name, how long prices are good, and freight if any. Then the vendor hits **Send quote**.
- If the send fails, say from bad signal at the counter, their prices stay on the screen. The button reads **Try again**. There is nothing to retype.
- Vendors only ever see names and counts: **no prices of yours are on that page**.

:::example The counter guy quotes between customers
Wendi texts Moore Supply the pipe scope with a quote link. Danny at the counter opens it, prices nine lines, gets pulled away, and comes back after lunch — everything's still there. He marks the carriers "can't supply", hits Send, and Wendi's Quotes chip turns green.
:::

## Watching for the answer

- While a link is out with nothing back yet, an amber {{chip:yellow|RFQs · 1 waiting}} chip sits by Share.
- The desk sorts by **what needs you**. Bounced addresses come first. You fix them right on the row and resend. Then come requests whose needed-by is closing in. Then come ones nobody has opened in two days. Each of those rows has a plain-words reason chip. A coverage bar answers "which items does nobody have priced yet?".
- The moment a vendor submits, the {{chip:blue|Quotes (1)}} chip turns **green**. You open it to compare. See *get supply house prices on a bid* for the compare view.
- Vendors can reopen the link to send a **revised quote**. The newest one is what compare shows.
- Rep texted prices back instead of using the link? **Plug in a quote**, in the same menu, matches their lines to your fixtures. The match works even when the names don't quite agree. "shower tub combos 3 @ $900" finds *Shower/tub combo*. "kitchen sinks" finds *Kitchen sink*. See *get supply house prices on a bid*.

## When links die

You mark the bid lost, and every quote link on the bid shows ***"This pricing request has been closed. Nothing needed — thanks for looking."***

**Close link** on the desk does the same for one supply house's link. A stale text in someone's phone can't collect prices for a job that's gone. If the vendor already typed prices on that phone, the closed page lists them under ***"Your typed prices stayed on this phone — nothing was sent"***. So the vendor's work never looks thrown away. Nothing reaches your bid. Reopening the link from the desk brings the form back, with those prices still in it.
