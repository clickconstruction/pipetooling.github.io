---
title: send a bid's pricing package to the field
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: package and send, share pricing, send pricing, bid package, job plans, address, google maps, open in maps, copy for text, send for me, copy fixtures, parts house, supply house, supply house list, fixture counts
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

## Send a supply house the fixture list

Need a supply house to price the job? Don't send them the package — it has your sale prices in it. Instead, open the {{button:green|▾}} menu beside Share and pick **Supply house list**. It copies only fixture names and counts — no prices, no totals, no links — ready to paste into a text or email to the parts house.

A prepare screen opens first so you're never copying blind:

- **Scope it to the vendor** — one tap on {{chip:blue|Whole job}}, {{chip:blue|Pipe &amp; fittings}}, or {{chip:blue|Fixtures &amp; equipment}} ticks whole sections; fine-tune with the checkbox on any section or row. Scoping applies to that copy only — the bid never changes.
- **Fix codes on the spot** — names the ledger doesn't recognize sit at the top with a section picker and {{button:green|Pin it}}; a pin codes that name on every bid, forever.
- **See the paste** — the preview pane shows the exact text, updating as you toggle. {{button:green|Copy}} puts precisely that on your clipboard.

The list arrives grouped by Division 22 spec section (22 11 16 Domestic Water Piping, 22 42 13 Water Closets &amp; Urinals, …) in spec-book order, so the counter can work it section by section. Anything still uncoded rides in a "No code yet" tail — the copy never blocks on an incomplete ledger.

:::example Sending just the pipe to the supply house
Wendi opens BP339, picks **Supply house list**, taps {{chip:blue|Pipe &amp; fittings}} — the preview drops the fixtures and the gas tail, showing 37 items of pipe and fittings — and hits {{button:green|Copy 37 items}}. The supply house gets exactly the scope they price, nothing else.
:::

## Teach the ledger the missing codes

When the toast says some names have no code, open the same {{button:green|▾}} menu and pick **Division 22 codes**. The audit shows every fixture name you've ever counted, run through the ledger — uncoded names on top, sorted by how many bids they appear on:

- Pick a section for a name and tap {{button:green|Pin it}} — that name is coded everywhere, instantly: past bids and every future one.
- Some things aren't Division 22 buyout items at all (DEMO, safety line items). Tap {{button:gray|No code}} and they stop counting as gaps.
- The coverage bar shows how close the ledger is to knowing everything. Pin the top few names and it jumps.

:::example Clearing the gas rows
Wendi copies BP339's fixtures and the toast says 36 names have no code. She opens **Division 22 codes**, sees "11/2IN 90 GAS" at the top (17 bids), picks the section the specs use for gas piping, and pins it. Every gas fitting on every bid now files under that section — one pin, done forever.
:::

It works as soon as the bid has Counts, even before you've set up a price book or labor.

:::example Getting cost pricing before the bid is priced
Wendi finishes the takeoff on BP375, opens the {{button:green|▾}} menu, taps **Supply house list**, and pastes the list into a text to her Ferguson rep. The rep prices from names and counts — Wendi's numbers stay in the building.
:::

## Plug the vendor's reply back in

When the supply house answers — a text, an email, notes from a phone call — you don't retype it into a spreadsheet. Open the same {{button:green|▾}} menu and pick **Plug in a quote**:

1. Pick the supply house, the rep if you want, and the **good until** date from the quote.
2. Paste the reply into the left pane exactly as it came — "4" cast iron 18.90/ft", "wc carriers no stock til Oct", any shape — and tap {{button:blue|Match to fixtures}}.
3. Each line lands on the fixture it names, with the original text beside it so you can check the guess: a green ✓ means it matched cleanly, a **?** means confirm it. "No stock" phrasing marks the part **can't supply** automatically. Fix a fixture with the dropdown, fix a price by typing over it, drop a line with the ×.
4. {{button:green|Save quote → compare}} keeps the raw paste with the quote, so you can always see what the vendor actually said.

Box and per-foot pricing is handled — "$368/box of 50" is stored as $7.36 each — so every house ends up in the same units.

## Compare quotes and pick the winners

Once a quote is saved, a {{chip:blue|Quotes (1)}} chip sits beside Share. It opens the comparison:

- Parts run down the left, **grouped by Division 22 section**; one column per supply house; the best live price wears a ★.
- A quote past its good-until date stays visible but goes gray and crossed out, and loses its ★ — stale prices can't win quietly.
- **Tap a price to pick it** for that part. The picked total at the bottom recomputes at today's counts.
- The **Last quoted** column remembers what each house said the last time anyone asked about that same part name — on any bid — so you can smell a high number before you commit.

:::example Two houses, one order
Wendi plugs in Ferguson's reply, then Moore Supply's. The compare shows Ferguson better on cast iron, Moore better on copper. She taps her picks line by line, and the picked total shows what the split order costs at today's counts.
:::
