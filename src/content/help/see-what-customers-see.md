---
title: see what customers see
category: Office
roles: dev, master_technician, assistant, controller
keywords: what customers see, supply house, law firm, next release, every outside surface, test report sample, email me a sample, send a test report to myself, customer view, sample customer, estimate email preview, bid room preview, contract email preview, journeys, settings, customer experience, sample data
order: 65
---
What customers see shows every email and page anyone outside the company gets. Each one is drawn live with sample data.

**Settings → What customers see** shows every email and page anyone outside the company gets. That is a customer, a general contractor, a subcontractor, a supply house or the collections law firm. Each is rendered live with sample data, in the order they meet them. Since v2.3507 the whole office sees it, not only devs. You send these pages. So this is where you see them from the other side. You use it after you change a Setting. That may be the estimate copy, the public terms, the footer or the bid cover-letter defaults. You see every surface follow.

## Five audiences, and a count at the top

The strips are **Homeowner**, **General contractor**, **Subcontractor**, **Supply house** and **Collections law firm**. That is every audience the app writes to. Under the toolbar a count says how much of it renders today:

:::example The count line
{{chip:blue|39 steps across 5 audiences · 13 rendered live · 24 next release · 2 sent by another system}}
:::

Under the count, **Where people are, all at once** shows, per step, how many outside people are there. It shows how many are stuck. Stuck means agreements never opened, bid rooms never opened, portals never visited, or statements not certified. Each has its door. A **Next release** card is a surface the app already sends or serves that this tab does not render yet. The card names the surface and the release that brings it. So nothing the customer gets is missing from the map, even before it renders. A check runs on every change to the app. A new public page or a new customer email cannot ship without a place on this tab.

## Read the strips

Each strip is one audience. Each step names what sends it, for example *Estimates → Send to customer*. It names when it happens, for example *Day 0*. It names which Settings it reflects. You open an email step. Its header shows the **From** line the inbox will show, beside the **Subject**. The From line reads *Click Plumbing and Electrical <team@noreply.clicktooling.com>*. On the estimate it reads *Click Plumbing <…>*, which keeps its trade name. Staff emails are not here. They come from ClickTooling so the team can tell them apart.

:::example The homeowner's strip
{{chip:gray|Estimate email}} → {{chip:gray|Accept page}} → {{chip:gray|Thank-you}} → {{chip:gray|Bill email}} → {{chip:gray|Portal}}
:::

- A step with a small picture is **live**. It is the real page, or the real email, at phone width.
- **Sent by another system** means it is not built by this app. Staff type it themselves. That is the sub's portal link, or a quote link pasted into your own email.
- **Next release** means the surface is real and named here. It renders with a later release.
- A step that **opens as the PDF** shows a preview in the frame. Those are the bill by email, the hazmat notice and the demand letter. They also include the notice to a property owner and the lien release. A lien release is the paper that gives up a claim on the property. {{button:outline|Open the PDF ↗}} builds the document the customer would receive, from the sample.

:::example The homeowner's agreement is its own lane
{{chip:gray|Thank-you}} → {{chip:gray|Agreement email}} → {{chip:gray|Agreement PDF}} → {{chip:gray|Agreement to sign}} → {{chip:gray|Reminder}} → {{chip:gray|Signed}} → {{chip:gray|Signed copy}} → {{chip:gray|Bill email}}
:::

The **Agreement to sign** step is the customer's service agreement from the Contract sweep. It is a different document from the subcontractor's **Contract to sign** further down. Its email, its **Agreement PDF** email and its reminder are built by the same code the app sends with. The Agreement PDF email has the agreement attached to print and sign by hand, with the link underneath. On a real customer, one of the two emails did not go. That one reads *Went as a signing link* or *Went as a PDF to sign by hand*. A page handed over in person reads *Handed over on paper*. The sample page signs into the signed view without saving anything. The GC strip's **Submittal review room** is the same. A submittal is the product paperwork sent for approval. You identify and decide on the sample room and nothing is saved. So are the supply house's **Quote page** and the law firm's **Portal**. Collections paper sits at the end of the journey it belongs to. That is the demand letter, the notice to the owner of record, and the lien release.

:::example The subcontractor's strip
{{chip:gray|Portal link, texted}} → {{chip:gray|Sub portal}} → {{chip:gray|Contract email}} → {{chip:gray|Contract to sign}} → {{chip:gray|Signed}}
:::

The **Contract email** is the one People → Contracts → **Send for signature** sends. It is built by the same code. It shows the default opening line, **you** as the sender, and the sample sub's portal address. The real send lets you type your own opening message and subject.

## See a real person's journey

Beside {{button:outline|Sample}} there is a search box. You pick **Customer or builder**, **Subcontractor**, **Supply house** or **Law firm**. You type a name and choose one. Every step on their strips turns into what actually happened for them:

:::example Michael Palmer's agreement lane
{{chip:yellow|Agreement email · Sent Sep 3 · never opened}} → {{chip:green|Agreement to sign · Signed on paper Sep 4}} → {{chip:gray|Reminder · Not needed}} → {{chip:green|Signed · Filed from paper}} → {{chip:gray|Signed copy · Not emailed}}
:::

- The pill says where they are: **Sent**, **Opened**, **Done**, **Paid**, **Declined**, **Not yet**.
- **Open as Michael →** opens the page they hold, exactly as they see it. Your look never counts as their visit.
- A card that says *never opened* or *never sent* carries the next move. {{button:outline|Edit & re-send →}} {{button:outline|Start the sweep →}} {{button:outline|Share their portal →}} {{button:outline|Ask when they'll pay →}}. Nothing on this tab writes. Every door goes to the surface that does.
- An estimate or a sub's contract cannot be reopened from here. Their links are kept hashed. So those cards offer **Resend** instead.

The same strips sit on a customer's page as **Their journey**, under the money strip. It has *See it beside the sample →* back to this tab.

The same strips, narrowed to one job, sit in the **Job window**. You open a job and click **Their journey** under the schedule band. It starts closed. **Every job →** beside it opens the Customer page with the whole journey.

## Learn a step

Every card opens, including a **Next release** card. Under the step's name the expanded view says **what sends it**, the button or function. It says **when** in the relationship it happens. It says **what they can do there**. That is what the customer, GC, sub, house or firm can actually do on that page or from that email. {{button:outline|How to send it →}} opens the help guide for sending that surface. A step that carries contract wording lists it under **The wording on it**. Each name opens its card on **Contracts & terms**. A new person in the office can read the whole customer journey by clicking along a strip.

:::example An expanded step
{{chip:gray|Agreement to sign}} · What sends it: *Jobs → Contract sweep → Send* · When: *Same day* · What they can do there: *Read the scope, the amount and the payment line, open the full terms, and sign on the page.* {{button:outline|How to send it →}}
:::

## Open a step large

1. You tap a step. It opens below its strip.
2. You switch {{button:outline|Phone}} / {{button:outline|Desktop}} in the toolbar to see it at either width.
3. {{button:outline|Open in new tab}} opens a page on its own. Emails show their plain-text part underneath.

Pages open with a **sample token** and carry an orange *Sample* strip. You can click through them. You pick an option, sign, decline, send a request, or accept an offer. Nothing is saved. The sample customer is **Sam Sample**. The sample bid is **Cedar Bend Apartments** for **Sample Contracting**. The sample sub is **Sam's Plumbing LLC**. None of them exist in the database.

## Email yourself a test report

The ***Test report (sample)*** card sits above the strips. Its first row opens each sample paper as the PDF. The row holds {{button:outline|Sewer pre-test · PASS}} {{button:outline|Supply post-test · FAIL}} {{button:outline|Pinpoint test}} {{button:outline|Gas test}}. Its second row is {{button:outline|✉ Sewer pre-test · PASS}} and the rest. It sends that sample through the real send function to **your own login email**. You get the same subject, body, pay-link paragraph and attachment a GC gets. The subject is prefixed *[Sample]*. Nothing is stored and no job is touched. So you send one whenever you change the letterhead, the certifier, the wording or the email template. Only devs see this tab. The function refuses any other recipient.

## After a Settings change

You press {{button:outline|Refresh all}}. The tab re-reads Settings and reloads every frame.

## The submittal review room

A bid's submittals travel as one link, `/submittal?t=…`. The GC forwards it to the customer's architect. You share it from Bids → Submittals → Share. You open it from the tab's {{button:outline|Copy link}} in a private window to see it the way they do. You see the product rows in plain words, the package download, and no money anywhere. Your own signed-in opens never count as theirs. The General contractor strip shows the room with sample rows. In the open room, three products wait on an answer. One of them is a fixture of parts. After the review, each part carries its own answer. The sample rows run through the same code as a real room. So the sample says only what a real room can.
