---
title: keep the Division 22 codes right
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: division 22, spec section, spec book, codes, rules, ledger, pin it, no code, coverage, uncoded, order, priority, section, hydrant, eyewash
---

Every fixture name you count is filed under a Division 22 spec section. A list of rules does the filing, and you can read and change those rules yourself.

## Open the window

On a bid's **Pricing** tab, open the {{button:green|▾}} menu and pick **Division 22 codes**. The window has three tabs along the top: **Names**, **Rules** and **Sections**.

## Names

**Names** lists every fixture name you have ever counted. Uncoded names sit on top. The names on the most bids come first.

- Pick a section and tap {{button:green|Pin it}} to file one name.
- Tap {{button:gray|No code}} for things that are not Division 22 items, like DEMO.

## Rules

Each rule looks for some words in a fixture name. The rule files the names it catches under one section. Rules decide in order, the lowest number first. The first rule that catches a name decides it.

Each rule shows how it is doing.

- **Decides 12 names on 40 bids** means the rule files those names. Tap the line to see them.
- **Never decides** means an earlier rule always catches its names first. The line says which rule.
- **Catches no name yet** means no counted name has those words.

:::example A rule that never decides
A rule says it never decides, because "starts with WH-" gets its names first. Its names are wall hydrants, but "starts with WH-" files them under water heaters. Give the hydrant rule a lower order number than the "WH-" rule, and it decides first.
:::

### Add or change a rule

Tap {{button:outline|Add a rule}}, or **Edit** on a rule. Fill in what it looks for, how it matches, the section and the order. Before you save, the form lists every name whose code would change. The form also shows the coverage before and after.

The form stops you in three cases:

- The rule has no words.
- The section does not exist yet.
- Another rule already looks for the same words the same way.

The form warns you when the words are very short. "CO" also catches COPPER. The form also warns when another rule holds the same order and catches some of the same names.

### Delete a rule

Tap **Delete** on a rule. The window first says which names would lose their code. Tap {{button:red|Delete rule}} to go ahead, or **Keep it**. A deleted rule can be put back for 90 days from **Settings → Data & recovery → Recently deleted**.

## Sections

**Sections** lists every section with its rules, names and bids.

- {{button:outline|Add a section}} takes a number like 22 45 00 and a title.
- **Rename** changes a title.
- A section that still holds rules cannot be deleted. The message says how many rules it holds, so you can move them first.

A deleted section can be put back from **Recently deleted** too. Put a section back before its rules.
