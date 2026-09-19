---
title: see what customers see
category: Office
roles: dev, master_technician, assistant, controller
keywords: what customers see, supply house, law firm, next release, every outside surface, test report sample, email me a sample, send a test report to myself, customer view, sample customer, estimate email preview, bid room preview, contract email preview, journeys, settings, customer experience, sample data
order: 65
---
**Settings → What customers see** shows every email and page anyone outside the company gets — a customer, a general contractor, a subcontractor, a supply house or the collections law firm — rendered live with sample data, in the order they meet them. Since v2.3507 the whole office sees it, not only devs: if you send these pages, this is where you see them from the other side. Use it after you change a Setting — the estimate copy, the public terms, the footer, the bid cover-letter defaults — to see every surface follow.

## Five audiences, and a count at the top

The strips are **Homeowner**, **General contractor**, **Subcontractor**, **Supply house** and **Collections law firm** — every audience the app writes to. Under the toolbar a count says how much of it renders today:

:::example The count line
{{chip:blue|39 steps across 5 audiences · 13 rendered live · 24 next release · 2 sent by another system}}
:::

Under the count, **Where people are, all at once** shows, per step, how many outside people are there and how many are stuck — agreements never opened, bid rooms never opened, portals never visited, statements not certified — each with its door. A **Next release** card is a surface the app already sends or serves that this tab does not render yet. The card names the surface and the release that brings it, so nothing the customer gets is missing from the map even before it renders. A check runs on every change to the app: a new public page or a new customer email cannot ship without a place on this tab.

## Read the strips

Each strip is one audience. Each step names what sends it (*Estimates → Send to customer*), when it happens (*Day 0*), and which Settings it reflects.

:::example The homeowner's strip
{{chip:gray|Estimate email}} → {{chip:gray|Accept page}} → {{chip:gray|Thank-you}} → {{chip:gray|Bill email}} → {{chip:gray|Portal}}
:::

- A step with a small picture is **live**: the real page, or the real email, at phone width.
- **Sent by another system** means it is not built by this app (the bill email comes from Stripe), or staff type it themselves (the sub's portal link, a quote link pasted into your own email).
- **Next release** means the surface is real and named here, and renders with a later release.
- A step that **opens as the PDF** — the bill by email, the hazmat notice, the demand letter, the notice to a property owner, the lien release — shows a preview in the frame and {{button:outline|Open the PDF ↗}} builds the document the customer would receive, from the sample.

:::example The homeowner's agreement is its own lane
{{chip:gray|Thank-you}} → {{chip:gray|Agreement email}} → {{chip:gray|Agreement to sign}} → {{chip:gray|Reminder}} → {{chip:gray|Signed}} → {{chip:gray|Bill email}}
:::

The **Agreement to sign** step is the customer's service agreement from the Contract sweep — a different document from the subcontractor's **Contract to sign** further down. Its email and reminder are built by the same code the app sends with; the sample page signs into the signed view without saving anything. The GC strip's **Submittal review room** is the same: identify and decide on the sample room and nothing is saved. So are the supply house's **Quote page** and the law firm's **Portal**. Collections paper — the demand letter, the notice to the owner of record, the lien release — sits at the end of the journey it belongs to.

:::example The subcontractor's strip
{{chip:gray|Portal link, texted}} → {{chip:gray|Sub portal}} → {{chip:gray|Contract email}} → {{chip:gray|Contract to sign}} → {{chip:gray|Signed}}
:::

The **Contract email** is the one People → Contracts → **Send for signature** sends, built by the same code: it shows the default opening line, **you** as the sender, and the sample sub's portal address. The real send lets you type your own opening message and subject.

## See a real person's journey

Beside {{button:outline|Sample}} there is a search box. Pick **Customer or builder**, **Subcontractor**, **Supply house** or **Law firm**, type a name, and choose one. Every step on their strips turns into what actually happened for them:

:::example Michael Palmer's agreement lane
{{chip:yellow|Agreement email · Sent Sep 3 · never opened}} → {{chip:green|Agreement to sign · Signed on paper Sep 4}} → {{chip:gray|Reminder · Not needed}} → {{chip:green|Signed · Filed from paper}}
:::

- The pill says where they are: **Sent**, **Opened**, **Done**, **Paid**, **Declined**, **Not yet**.
- **Open as Michael →** opens the page they hold, exactly as they see it. Your look never counts as their visit.
- A card that says *never opened* or *never sent* carries the next move: {{button:outline|Edit & re-send →}} {{button:outline|Start the sweep →}} {{button:outline|Share their portal →}} {{button:outline|Ask when they'll pay →}}. Nothing on this tab writes; every door goes to the surface that does.
- An estimate or a sub's contract cannot be reopened from here (their links are kept hashed), so those cards offer **Resend** instead.

The same strips sit on a customer's page as **Their journey**, under the money strip, with *See it beside the sample →* back to this tab.

The same strips, narrowed to one job, sit in the **Job window**: open a job and click **Their journey** under the schedule band. It starts closed; **Every job →** beside it opens the Customer page with the whole journey.

## Learn a step

Every card opens, including a **Next release** card. Under the step's name the expanded view says **what sends it** (the button or function), **when** in the relationship it happens, and **what they can do there** — what the customer, GC, sub, house or firm can actually do on that page or from that email. {{button:outline|How to send it →}} opens the help guide for sending that surface. A new person in the office can read the whole customer journey by clicking along a strip.

:::example An expanded step
{{chip:gray|Agreement to sign}} · What sends it: *Jobs → Contract sweep → Send* · When: *Same day* · What they can do there: *Read the scope, the amount and the payment line, open the full terms, and sign on the page.* {{button:outline|How to send it →}}
:::

## Open a step large

1. Tap a step. It opens below its strip.
2. Switch {{button:outline|Phone}} / {{button:outline|Desktop}} in the toolbar to see it at either width.
3. {{button:outline|Open in new tab}} opens a page on its own; emails show their plain-text part underneath.

Pages open with a **sample token** and carry an orange *Sample* strip. You can click through them — pick an option, sign, decline, send a request, accept an offer — and nothing is saved. The sample customer is **Sam Sample**, the sample bid is **Cedar Bend Apartments** for **Sample Contracting**, the sample sub is **Sam's Plumbing LLC**; none of them exist in the database.

## Email yourself a test report

The **Test report (sample)** card sits above the strips. Its first row opens each sample paper — {{button:outline|Sewer pre-test · PASS}} {{button:outline|Supply post-test · FAIL}} {{button:outline|Pinpoint test}} {{button:outline|Gas test}} — as the PDF. Its second row, {{button:outline|✉ Sewer pre-test · PASS}} and the rest, sends that sample through the real send function to **your own login email**: the same subject, body, pay-link paragraph and attachment a GC gets, with the subject prefixed *[Sample]*. Nothing is stored and no job is touched, so send one whenever you change the letterhead, the certifier, the wording or the email template. Only devs see this tab, and the function refuses any other recipient.

## After a Settings change

Press {{button:outline|Refresh all}}. The tab re-reads Settings and reloads every frame.

## The submittal review room

A bid's submittals travel as one link, `/submittal?t=…`, that the GC forwards to the customer's architect (Bids → Submittals → Share). Open it from the tab's {{button:outline|Copy link}} in a private window to see it the way they do: the product rows in plain words, the package download, no money anywhere. Your own signed-in opens never count as theirs. There is no sample token for the room yet; use BP398 ZZ Test.
