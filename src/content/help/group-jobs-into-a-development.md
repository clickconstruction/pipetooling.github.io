---
title: group jobs into a development
category: Office
roles: dev, master_technician, assistant
keywords: development, subdivision, group jobs, neighborhood, builder development, phase, lots, house icon, stages
order: 74
---
You put jobs from one subdivision into a development, a named group. Then you find and review them as one unit.

When you're plumbing many houses in one subdivision, the jobs belong together. Same builder, same streets, same phase. A **development** is a named group you put jobs into. You review them as one unit instead of one job at a time.

## Put a job in a development

1. Open the job and click {{button:outline|Edit}}.
2. Click the **Project | Plans | Bid | Development** row to expand it.
3. Under **Development**, pick one from the list. Or click {{button:outline|+ New development}}, type a name like *Sagebrush Phase 2*, and hit **Create**. The new development is selected automatically.
4. It saves automatically. Pick **None** to take the job back out.

:::example One list per company
Developments are shared: once anyone creates *Sagebrush Phase 2*, everyone picks it from the list. That's the point — one spelling, one group, no near-duplicate names splitting your jobs apart.
:::

## Where the development shows up

- **Jobs → Pipeline**: under the customer name in the Job column, marked with a house icon. When the GC, the general contractor, is also set, the house sits next to the GC's hard hat. Click the development name on any row to filter the whole board to it.
- **Job Detail**: under the customer name in the Customer block.
- **Pipeline search**: typing a development's name surfaces every job in it.
- **Pipeline development filter**: once any job has a development, a house-icon dropdown appears next to the search. Pick a development to see only its jobs. Every section and total follows. Pick **No development set** to see the jobs still needing one.

## Review money by development

In **Jobs → Pipeline → Billed Awaiting Payment**, open {{button:outline|GC Review}} and flip **Group by** to **By Development**. Everything awaiting payment is grouped per development: job counts, oldest age and outstanding totals. A **No development set** bucket means the grand total always matches the section. {{button:outline|Print}} on a row makes that development's statement. **Print all** makes one report of every group.

## Rename, archive, or delete a development

Admins manage the list under {{icon:gear}} **Settings → Jobs & billing → Manage developments**:

- **Rename**: click the name, type, press Enter. Every linked job follows automatically.
- **Default GC/Builder**: pick the GC that development belongs to. This is informational for now.
- **Archive**: a finished development stays on its jobs but leaves the Edit Job picker. Un-archive any time.
- **Delete**: removes the group entirely. Its jobs are un-grouped, never deleted. The confirm tells you how many jobs that affects.

## What a development does *not* change

Billing, scheduling and the customer are untouched. A development is purely a label for grouping and review. It is also separate from **Projects**, the multi-phase billing workflows. A job can have both.
