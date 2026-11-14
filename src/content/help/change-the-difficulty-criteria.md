---
title: change the difficulty criteria a GC is rated on
category: Bids & Estimating
roles: dev
keywords: difficulty, difficulty criteria, difficult gc, gc rating, rate the gc, how they are to work with, scales, rungs, sentences, versions, publish, draft, points, field and superintendent, their office, paying
---

A GC is rated once, on its record, in sentences a person picks from. The sentences, the scales they sit on and the points each one gives are the criteria. Only a dev changes them. The office sets what a point costs on the Bid Board, not here.

The card sits at Settings → **Difficulty criteria**. It shows the published version and every version before it.

## What a version holds

A version is a list of scales. Each scale has a name, a key, a source and a scope. The key never changes once published. It is what carries a GC's rating from one version to the next. The source says who gives the points. **Picked by a person** means someone picks a rung. **Read from their bills** means the app reads the GC's pay speed. The scope says where the scale lives. **On the GC** is read by every bid to them. **On the bid, not the GC** is picked for one bid.

Under each scale sit its rungs. A rung is a number of points and one sentence. The first rung is 0. Each rung has more points than the one before it. The last rung is the scale's maximum.

## Start a draft

:::steps

1. Press {{button:outline|Start a draft}}. The draft is a copy of the published version.
2. Change the words, the points, the rungs or the scales. {{button:outline|Add a rung}} puts one more rung after the last. {{button:outline|Add a scale}} adds a new scale with two empty rungs.
3. Type a note on what changed and why. The list of versions shows it.
4. Press {{button:outline|Save the draft}}. A saved draft waits as long as you like.

:::

The chip at the top counts the changes against the published version. Open the fold under the editor to read each one.

## Preview the GC card

Press {{button:outline|Preview the GC card}}. The card draws the draft as a GC's record will show it, with sample picks. The picks save nothing.

## Publish

Press {{button:blue|Publish version 2}}. A window lists every change. Confirm it and the draft becomes the next version. A published version never changes again. Start a new draft to change the words after that.

The press stays grey while the draft breaks a rule. The rules are listed above it. Every scale needs a name and a key. A picked scale needs at least two rungs. Every rung needs a sentence. Points go up rung by rung from 0.

## What a new version does to old ratings

A rating made under an older version carries to the new one where the key and the points still exist. A rung you removed leaves that scale unrated on every GC that picked it. The GC's card says so. A scale you removed leaves every GC unrated on it. A new scale starts unrated everywhere. Nothing is recomputed from old words onto new words.

A bid already priced keeps its version, its words and its lines. A new version reaches only bids priced after it.

## Discard a draft

Press {{button:outline|Discard the draft}}. Every change in it is lost. The published version stays as it is.
