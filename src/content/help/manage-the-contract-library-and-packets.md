---
title: manage the contract library and packets
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, contract library, packets, templates, contract book, assign packets, documents, bundle, scope library, scope items, exclusions, acknowledgements, general conditions, subs
order: 76
---
Everything about your contract documents lives in one place now: the {{button:blue|Contract library}} button on **People → Contracts**. It has three tabs.

## Documents — the library itself

One entry per library document (this is the Contract Book): its text, version date, tags, and now **how many people it's been sent to**, with a {{button:blue|Send to…}} on every entry for one-off sends.

- {{button:green|Add Contract}} creates a new library document.
- {{button:outline|Edit}} changes the text — people who already **signed** keep their copy; a new unsent version is minted for them.

:::example Outside the library
Documents that were only ever sent one-off (never added to the library) show in their own section at the bottom, with their send counts. They still work — sending uses the most recent copy's text — but adding them to the library gives them one official version.
:::

## Packets — bundles you assign as a set

A **packet** (previously called a template) is a named bundle of library documents — like *All Teammates* — that you assign to a person in one step.

1. Open the **Packets** tab. The list shows each packet with its document and people counts — **0 people** shows in amber so unused packets stand out.
2. Pick a packet (or {{button:blue|+ New packet}}). Its documents are a **checkbox list of the whole library** — tick to add, untick to remove.
3. Before you save, the amber note spells out the consequences: which documents get created as {{chip:red|unsent}} copies for the assigned people, and that removals never touch signed or in-progress documents.
4. {{button:blue|Save}}.

## Scope — what a sub's work order ticks from
The **Scope** tab holds the lists a Sub Labor sheet's work order box is built from: **scope items**, **exclusions**, and the sentences a sub **confirms at signing**. One list per trade, plus an **All trades** list every sheet gets.
- Pick a trade on the left (an {{chip:yellow|empty}} note means nothing is there yet). Type a line and {{button:blue|Add}}; click any line to reword it; ↑ ↓ reorder; × removes it from the library.
- Each scope item or exclusion is a {{chip:green|default}} (pre-ticked on every new work order of that trade) or an {{chip:yellow|ask}} (shown unticked so the office decides per job). Click the chip to flip it.
- Editing changes future work orders only — sent ones keep their frozen wording.
:::example Documents for subs
The card at the bottom lists library documents whose audience is **Subs** (General Conditions is the usual one) and how many active subs are on the current version. Anyone behind or unsigned gets a {{button:blue|Send to…}} right there. Add such a document on the **Documents** tab and set its audience to *Subs*.
:::

## Assigning packets to a person

Expand the person in the list and click {{button:blue|Assign packets}}:

- Tick one or more packets — each shows its documents underneath.
- Packets they already have show a {{chip:green|assigned}} chip; **Unassign** is behind that row's ⋯ menu (Dev/Master only).
- The note tells you exactly what lands: *"Will add for Darren: … — 2 documents, created as unsent."* They count under **Needs attention** until sent.

Just need one document signed by one person? Skip packets entirely — see *send one contract to one person*.
