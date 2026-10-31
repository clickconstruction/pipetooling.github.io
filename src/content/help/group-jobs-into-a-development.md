---
title: group bids and jobs into a development
category: Office
roles: dev, master_technician, assistant, estimator
keywords: development, subdivision, group jobs, group bids, neighborhood, builder development, phase, lots, house icon, stages, bid board, address, put it in
order: 74
---
You put bids and jobs from one site into a development, a named group. Then you find and review them as one unit.

When one site has many moving pieces, the bids and jobs belong together. Same builder, same streets, same phase. A **development** is a named group you put bids and jobs into. You review them as one unit instead of one record at a time.

## Put a job in a development

1. Open the job and click {{button:outline|Edit}}.
2. Click the **Project | Plans | Bid | Development** row to expand it.
3. Under **Development**, pick one from the list. Or click {{button:outline|+ New development}}, type a name like *Sagebrush Phase 2*, and hit **Create**. The new development is selected automatically.
4. It saves automatically. Pick **None** to take the job back out.

## Put a bid in a development

1. Open the bid and click {{button:outline|Edit}}.
2. At the top right, beside **Project**, find **Development**.
3. Pick one from the list. Or click {{button:outline|+ New development}}, type a name, and hit **Create**.
4. The pick saves automatically. Pick **None** to take the bid back out.

When you make a job from a won bid, the job takes the bid's development. The development comes along with the customer and the address. You do not pick it a second time.

:::example One list per company
Developments are shared: once anyone creates *Sagebrush Phase 2*, everyone picks it from the list. That's the point — one spelling, one group, no near-duplicate names splitting your bids and jobs apart.
:::

## Let the address do it

A saved bid or job with no development may share its address with records that are in one. The form then shows one line under **Development**. The line reads like *4 bids and 6 jobs at this address are in Harlow Ranch*. Click {{button:outline|Put it in Harlow Ranch}} and the record is in.

The match reads the address alone. Spelling, capitals and a zip code do not matter. A different street number is a different address, so nothing is guessed.

## Where the development shows up

- **Jobs → Pipeline**: under the customer name in the Job column, marked with a house icon. When the GC, the general contractor, is also set, the house sits next to the GC's hard hat. Press the development name on any row to open the development's page. To see only one development's jobs, use the house dropdown by the search.
- **Job Detail**: under the customer name in the Customer block.
- **Pipeline search**: typing a development's name surfaces every job in it.
- **Pipeline development filter**: once any job has a development, a house-icon dropdown appears next to the search. Pick a development to see only its jobs. Every section and total follows. Pick **No development set** to see the jobs still needing one.
- **Bids → Bid Board**: under the GC on the row, marked with the same house icon. Open the row and the development reads beside the GC.
- **Bid Board search**: typing a development's name surfaces every bid in it.
- **Bid Board development filter**: once any bid has a development, a house-icon dropdown appears next to the search. Pick a development to see only its bids. Pick **No development set** to see the bids still needing one.
- **Bid window**: under the bid number on the Bid tab.

## Review money by development

In **Jobs → Pipeline → Billed Awaiting Payment**, open {{button:outline|GC Review}} and flip **Group by** to **By Development**. Everything awaiting payment is grouped per development: job counts, oldest age and outstanding totals. A **No development set** bucket means the grand total always matches the section. {{button:outline|Print}} on a row makes that development's statement. **Print all** makes one report of every group.

## Rename, archive, or delete a development

Admins manage the list under {{icon:gear}} **Settings → Jobs & billing → Manage developments**:

- **Rename**: click the name, type, press Enter. Every linked bid and job follows automatically.
- **Default GC/Builder**: pick the GC that development belongs to. This is informational for now.
- **Archive**: a finished development stays on its bids and jobs but leaves the pickers. Un-archive any time.
- **Delete**: removes the group entirely. The development's bids and jobs are un-grouped, never deleted. The confirm tells you how many jobs that affects.

## What a development does *not* change

Billing, scheduling, pricing and the customer are untouched. A development is purely a label for grouping and review. A development is also separate from **Projects**, the multi-phase billing workflows. A bid or a job can have both.
