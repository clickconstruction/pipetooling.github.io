---
title: file a hydrostatic, pinpoint or gas test report
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller, primary
keywords: test report, test reports, send test report, resend, documents page, filed, hydrostatic, pre-test, post-test, pretest, pinpoint, gas test, BTU, house pressure, plumbing tooling, foundation, certification, RMP
---
A **Test report** is the certified paper a foundation contractor or a homeowner gets after a hydrostatic, pinpoint or gas test. It lives on the job, prefilled from the job, and prints as a real PDF on the company letterhead. It replaces the old plumbingtooling.com form, where the same customer details had to be typed again and the PDF vanished into a browser tab.

## How it works at a glance

1. **The tech clocks out** with a Status Report or Job Complete that says the test was run — "Hydrostatic test passed." on a job named *Johnson Pretest*. That sentence becomes a **draft** on the job: type from the job name, PASS or FAIL from the wording, date from the report. Notes, EOD and Walk reports never draft one, and you can always start a report by hand.
2. **The Dashboard says so** — {{chip:yellow|3 test reports are ready to send}} under **Needs you** for office roles. The card opens the first draft.
3. **You glance and send** — the paper is already filled in; check the verdict and the notes, then {{button:amber|Send to GC…}}. The email goes out with the PDF, the job's Stripe pay link and the standing cc, and the job's activity gets a line.
4. **The GC sees it** on their portal statement, with a **View report** button that opens the exact PDF they were emailed.

Everything below is the detail of those four steps.

## Open it from the job

On **Jobs → Pipeline**, every row's action stack has the orange wrench, **Test report** (it used to say Plumbing Tooling). On the mobile cards it is in the {{button:outline|⋯}} sheet. The modal opens on the job's newest draft, or on a fresh report when there is none. Reports already on the job show as chips across the top — tap one to open it, or {{chip:gray|+ New}} for another.

## Fill in the test

- **Test type** — {{chip:blue|Pre-Test}} {{chip:blue|Post-Test}} {{chip:blue|Pinpoint}} {{chip:blue|Gas}}. Pre and post tests also take {{chip:yellow|Supply}} or {{chip:yellow|Sewer}}, which picks the "system tested" wording and the conclusion.
- **Test date** — defaults to today; **Yesterday** and **Today** are one tap. **Duration** offers 20 / 40 / 60 minutes. On the paper the date sits in *Test details* for hydrostatic tests, leads *Test results* on a pinpoint, and leads *House pressure* on a gas test.
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

- **GC** — the contractor who ordered the test. If the job already has one, their name is here; if not, search for them: their email fills To and **Set … as the GC on this job** links them for good, so the next report and the portal already know. A GC with no email on file gets a **Save … on their customer card** checkbox under To.
- **To** — the GC's email, else the customer's. Add more addresses with commas.
- **cc** — the standing copy from Settings (the master who certifies, say).
- **Message** — "Attached is the … report for 112 Seidel St and below is the invoice link…" with the job's **Stripe pay link** and amount. Edit it freely; *Reset to the template* brings the wording back.
- **The attachment** — the PDF, built from the report exactly as it is when you click Send.

The **Send** button itself is in the modal's bottom bar, next to Save draft — it is never further down the page than your thumb. It stays gray until the report has what it needs (a verdict, findings or a pressure, and a To address); the sheet names what is missing.

If the job has no Stripe bill yet the sheet says **Bill first**: open **Bill Customer** on the row, create the Stripe invoice, come back and Send — or use **Send without the link** on purpose. After a send the report reads {{chip:green|Sent Sep 11}} with who got it and whether the link rode along, and the job's activity gets a line. Change the report later and **Send again…** emails a new PDF; the first one stays on file, so what the GC received is always the exact file they were sent. Sending the same report to someone else works the same way — **Send again…**, change To, Send.

:::example the Dashboard card
Drafts pile up under **Needs you** as "3 test reports are ready to send" (office roles). The card opens the first one; the ones still missing a verdict or findings are counted separately.
:::

## Letting PASS reports send themselves

**Settings → Jobs & billing → Test reports → Sending** has two choices. *A person sends every report* (the default) is everything above. *Send PASS reports automatically* means a hydrostatic PASS the tech filed goes to the GC on its own fifteen minutes later — the PDF, the pay link, the standing cc — and the job's activity reads "Sent automatically". It only fires when the job has a Stripe bill and a GC with an email on file; FAIL results, pinpoint and gas tests, and anything missing those keep waiting on the Dashboard for you. Open and send a draft yourself inside the fifteen minutes and it is never sent twice.

## What the customer sees

Once a report is sent it shows on the customer's (or the GC's) portal statement, on the job it belongs to — {{chip:green|PASS}} or {{chip:red|FAIL}}, the date, who certified — with a **View report** button that opens the exact PDF they were emailed. A **Test reports** card lower on the page keeps every sent report, paid jobs included. Drafts never appear there. Preview both on **Settings → What customers see**.

## Where they are filed

**Documents → Jobs** lists every test report under its job, next to the job's invoices and contracts — *Sewer Pre-Test Hydrostatic test report · tested Sep 10* with {{chip:green|PASS}} or {{chip:red|FAIL}} and {{chip:green|Sent Sep 11}} or {{chip:yellow|Draft}}. Click a sent one and the exact PDF the GC received opens; click a draft and the Test report modal opens on it. The search box at the top finds them by "test report", "hydrostatic", "gas", "PASS" or the job.

## The wording

Every sentence on the paper — system tested, method, pressure, the PASS and FAIL conclusions, the three certifications — and the certifier's name and license live on **Settings → Jobs & billing → Test reports**. Change them once and every future report follows; a report already sent keeps the certifier it was sent with. For one report only, open *System, method, pressure, conclusion* under the notes and change the wording there.

## Notes

- A hydrostatic report needs a date, Supply or Sewer, and PASS or FAIL before it can be sent; pinpoint needs findings; gas needs a pressure or one fixture. The modal names what is missing.
- If the job has no Stripe bill yet, the modal says so: **Bill Customer** first when the report email should carry a pay link.
- The old site stays reachable from the modal's footer (**Open in Plumbing Tooling ↗**) for one release.
