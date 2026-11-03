---
title: send a homeowner the warranty in place of a contract
category: Office
roles: dev, master_technician, assistant, controller
keywords: warranty, residential, homeowner, contract, initials, initial each line, sign, e-sign, paper pick, contract window, warranty step, residential flow, certify the work
order: 75
---
Some homeowners balk at a contract. For those homeowners the office sends a warranty instead. The customer initials each line, certifies the work and signs. We warrant the work. The warranty binds both sides all the same, and the customer reads it as us standing behind our work.

## Pick the paper

Open the job's Contract window from the Pipeline row's chip. The chip reads {{chip:gray|No contract}} on a job with nothing on file. Above the paper sits a **Paper** pick with two choices: {{button:outline|Contract}} and {{button:outline|Warranty}}. Press **Warranty**.

The paper changes with the pick. The heading reads *Warranty for 407 E 6th St*. The amount line reads **Price**. Four lines to initial appear under the terms. The terms are the built-in warranty terms until the office adds a warranty document to the Contract Book. Tag that document `warranty` and the window takes it.

:::example The four lines they initial
*The work listed above is the work I asked for at this address.*
*The price listed is the price we agreed on, due when the work is done.*
*The labor is warranted for one year from the day the work is finished. Manufacturer warranties pass through on materials. Misuse, freezing and work by others are not covered.*
*A change to the work is priced and approved before it proceeds.*
:::

Press a line to edit it. One line per thing they initial. Click away to keep it. The work and the price come from the job, as they do on a contract. See [get a job contract signed](/help/get-a-job-contract-signed) for the paper's other lines.

## Send it

The three ways are the contract's. {{button:outline|Send a link}} emails or texts the signing link. {{button:outline|Sign here, now}} lets the homeowner sign on your phone at the kitchen table. {{button:outline|On paper}} prints the page with empty boxes to initial and rules to sign. The blue button follows the pick and says what it will do.

From the customer's thread, type `/warranty` in the reply box. The list offers the warranty out to sign on their job. Pick it and a line goes in with the link. The `{warranty}` blank in a quick reply fills the same way.

## What the homeowner does

The signing page shows the work, the price and the terms. Under the terms sit the lines to initial, each with a box. The customer types two to four letters beside each line. Then the customer types or draws a signature and presses {{button:blue|Sign the warranty}}.

The page refuses the signature until every line is initialled. The page names the line still blank. Once signed, the page shows the initials beside each line forever. The signed PDF prints them in their boxes.

## What it leaves behind

- The Pipeline chip reads {{chip:yellow|Warranty sent · opened 1× · 2d}} while the warranty is out. The chip reads {{chip:green|✍ Warranty signed Nov 3 · D. Whitfield}} once signed. The amber **No contract** nag goes quiet.
- The job's activity says *Warranty sent to …* and *Warranty signed by …*.
- The customer's thread gets a line when the paper goes and a line when it is signed.
- The customer gets the signed copy by email, with the PDF attached.

## The Warranty step on the residential flow

The residential customer flow has a **Warranty** step. The step stands aside from the lane, like the GC customer's change orders. A homeowner with no warranty never stands on it. One out to sign reads *waiting on them* on the step card, with {{button:outline|Remind them}}. A signed one reads done with its day.

The step's reminder is a text after two quiet days. The reminder stays off until the owner turns it on in Settings → Flows, like every residential reminder. See [see where a person stands and what comes next](/help/see-where-a-person-stands-and-what-comes-next) for the step card.
