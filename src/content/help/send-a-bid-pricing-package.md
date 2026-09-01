---
title: send a bid's pricing package to the field
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: package and send, share pricing, send pricing, bid package, job plans, address, google maps, open in maps, copy for text, send for me, copy fixtures, parts house, supply house, fixture counts
---

Package and send bundles everything the field needs to look at a bid — the job address, plans links, and the external pricing table — into one email or text.

## Open it

On Bids → Pricing with a bid open, tap {{button:green|Share}}. The modal shows exactly what the recipient will get:

- **Job address** — the bid's address with an {{button:gray|Open in Maps}} button. The recipient's copy gets the same thing: tapping the address in the email (or the Map link in a text) opens it straight in Google Maps.
- **Job plans** and **CountTooling Plans** — the links on the bid, each openable right from the modal.
- **Pricing preview** — the four columns the recipient will see (Fixture or Tie-in, Count, Sale Price, Revenue). Hidden rows stay hidden; the total still matches the Pricing tab.

No address on the bid? The package still sends without one — use **Edit bid** in that section to add it first if the crew will need directions.

## Send it

Pick a recipient (master techs appear as one-tap chips), then:

- {{button:blue|Send for me}} — ClickTooling emails the package now and logs the send.
- {{button:gray|Send via my mail}} — opens your own mail app with the text version; the table is copied to your clipboard to paste in.
- {{button:gray|Copy for text}} — copies an SMS-friendly summary (address and map link included) for Messages or WhatsApp.

:::example Getting a master tech to a new job
Wendi opens BP376's pricing, taps {{button:green|Share}}, taps the {{chip:blue|Malachi}} chip, and {{button:blue|Send for me}}. Malachi's email has the address at the top — one tap and Google Maps is routing him to the site.
:::

## Text a parts house just the fixture list

Need a supply house to price the job? Don't send them the package — it has your sale prices in it. Instead, open the {{button:green|▾}} menu beside Share and pick **Copy fixtures for text**. It copies only the fixture names and counts of the version you're viewing — no prices, no totals, no links — ready to paste into a text or email to the parts house.

The list arrives grouped by Division 22 spec section (22 11 16 Domestic Water Piping, 22 42 13 Water Closets &amp; Urinals, …) in spec-book order, so the counter can work it section by section. Fixtures the ledger doesn't recognize yet land in a "No code yet" tail at the bottom — the copy always works, and the toast tells you how many names still need a code.

It works as soon as the bid has Counts, even before you've set up a price book or labor.

:::example Getting cost pricing before the bid is priced
Wendi finishes the takeoff on BP375, opens the {{button:green|▾}} menu, taps **Copy fixtures for text**, and pastes the list into a text to her Ferguson rep. The rep prices from names and counts — Wendi's numbers stay in the building.
:::
