---
title: file a hydrostatic, pinpoint or gas test report
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller, primary
keywords: test report, hydrostatic, pre-test, post-test, pretest, pinpoint, gas test, BTU, house pressure, plumbing tooling, foundation, certification, RMP
---
A **Test report** is the certified paper a foundation contractor or a homeowner gets after a hydrostatic, pinpoint or gas test. It lives on the job, prefilled from the job, and prints as a real PDF on the company letterhead. It replaces the old plumbingtooling.com form, where the same customer details had to be typed again and the PDF vanished into a browser tab.

## Open it from the job

On **Jobs → Pipeline**, every row's action stack has the orange wrench, **Test report** (it used to say Plumbing Tooling). On the mobile cards it is in the {{button:outline|⋯}} sheet. The modal opens on the job's newest draft, or on a fresh report when there is none. Reports already on the job show as chips across the top — tap one to open it, or {{chip:gray|+ New}} for another.

## Fill in the test

- **Test type** — {{chip:blue|Pre-Test}} {{chip:blue|Post-Test}} {{chip:blue|Pinpoint}} {{chip:blue|Gas}}. Pre and post tests also take {{chip:yellow|Supply}} or {{chip:yellow|Sewer}}, which picks the "system tested" wording and the conclusion.
- **Test date** — defaults to today; **Yesterday** and **Today** are one tap. **Duration** offers 20 / 40 / 60 minutes.
- **Result** — {{button:green|PASS}} or {{button:red|FAIL}} for hydrostatic tests. Pinpoint and gas tests carry no verdict; pinpoint takes the location, method and findings, gas takes the **house pressure** (type PSI, in WC, oz/in² or mm WC and the other three fill themselves) and the **house utilities** list with its BTU/hr total (the **×1,000** button turns 100 into 100,000).
- **Notes** — pipe material, lead present, measured water loss, prior work by others, toilets re-installed.
- The customer, the address, the phone and the GC come from the job. The **certifier** comes from Settings.

The paper renders on the right as you type — that is exactly what the PDF prints.

:::example a sewer pre-test that passed
Pick **Pre-Test**, **Sewer**, today's date, 60 minutes, **PASS**, type "PVC. Toilets re-installed." in Notes, and **Save draft**. The preview reads *Sewer Pre-Test Hydrostatic Test Report* with the pass conclusion and Malachi's certification block.
:::

## Save, download, send

{{button:blue|Save draft}} keeps the report on the job. {{button:outline|Download PDF}} opens the paper in a new tab (or downloads it where pop-ups are blocked). A draft can be deleted from the modal's footer; a sent report cannot.

{{button:amber|Send to GC…}} opens the send sheet — the email the office used to write by hand, already filled in:

- **To** — the GC on the job (their email from the customer card), else the customer. Add more addresses with commas.
- **cc** — the standing copy from Settings (the master who certifies, say).
- **Message** — "Attached is the … report for 112 Seidel St and below is the invoice link…" with the job's **Stripe pay link** and amount. Edit it freely; *Reset to the template* brings the wording back.
- **The attachment** — the PDF, built from the report exactly as it is when you click Send.

If the job has no Stripe bill yet the sheet says **Bill first**: open **Bill Customer** on the row, create the Stripe invoice, come back and Send — or use **Send without the link** on purpose. After a send the report reads {{chip:green|Sent Sep 11}} with who got it and whether the link rode along, and the job's activity gets a line. Change the report later and **Send again…** emails a new PDF; the first one stays on file, so what the GC received is always the exact file they were sent.

:::example the Dashboard card
Drafts pile up under **Needs you** as "3 test reports are ready to send" (office roles). The card opens the first one; the ones still missing a verdict or findings are counted separately.
:::

## The wording

Every sentence on the paper — system tested, method, pressure, the PASS and FAIL conclusions, the three certifications — and the certifier's name and license live on **Settings → Jobs & billing → Test reports**. Change them once and every future report follows; a report already sent keeps the certifier it was sent with. For one report only, open *System, method, pressure, conclusion* under the notes and change the wording there.

## Notes

- A hydrostatic report needs a date, Supply or Sewer, and PASS or FAIL before it can be sent; pinpoint needs findings; gas needs a pressure or one fixture. The modal names what is missing.
- If the job has no Stripe bill yet, the modal says so: **Bill Customer** first when the report email should carry a pay link.
- The old site stays reachable from the modal's footer (**Open in Plumbing Tooling ↗**) for one release.
