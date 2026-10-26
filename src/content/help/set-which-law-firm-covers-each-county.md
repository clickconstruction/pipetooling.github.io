---
title: set which law firm covers each county
category: Billing & Money
roles: dev
keywords: legal, attorney, law firm, collections, county, counties, venue, territory, map, texas, settings, jobs and billing, who covers, zoom, cases, dots
where: /settings?tab=settings-jobs
---
You color counties on a Texas map so each collections law firm covers its own area. A collections suit is filed in the county where the customer is. So the firm for an account is the firm that covers that county.

Open **Settings**, then **Jobs & billing**, then **Collections law firms**. Only a dev sees this card.

## Pick a firm, then click counties

:::steps

1. Press a firm's card on the left. The card gets a colored edge. That color is the firm's on the map.
2. Click a county on the map. The county takes the firm's color.
3. Click the same county again to clear it. No firm covers it then.
4. Press {{button:dark|Save counties}}. The line under the map says how many counties changed before you press it.

:::

{{button:outline|Undo changes}} puts the map back the way it was saved.

## Move around the map

The map opens on Central Texas. Press {{button:outline|All of Texas}} to see the whole state. Press {{button:outline|Central Texas}} to come back.

Scroll on the map to zoom where the pointer is. Pinch on a phone. Press {{button:outline|+}} or {{button:outline|−}} to step in or out. Drag the map to move it. A drag never colors a county.

County names show once you zoom in close enough. A colored county keeps its name longer.

## See where today's cases sit

Each small dot is one Collections account at its job's address. The dot's color says where the account stands. Amber needs a dev's eyes. Green is with the firm. Gray is given up on. Red sits in a county no firm covers yet.

The card under the firm cards lists what is in the county under your pointer. Move the pointer to a county and the card shows that county's cases, each with its balance. Click a dot to hold that case on the card while you keep coloring. Click another dot to hold that one instead. A dot click never colors a county.

Each case on the card has an **Open on the desk** link. The link opens the Legal desk on that account.

The dots are for reference while you color. The Legal desk's own **Map** view works the cases. Read [review a collections account before it goes to your attorney](/help/review-a-collections-account-before-it-goes-to-your-attorney#see-every-case-on-the-map).

## When another firm already holds the county

A county keeps the color of the firm that holds it. Click it while a different firm is picked, and the app asks before it moves. Say yes and the county moves to the picked firm. Say no and nothing changes.

Moving a county changes new releases only. An account already with the old firm stays with the old firm.

## Add the second firm

Press {{button:outline|Add a firm}} under the firm cards. Fill in the name, the handling person, the email and the fee model. Press {{button:dark|Add firm}}. The new firm shows on the map with its own color and no counties yet.

## What the colors mean

- A colored county has a firm. The legend under the map names each color.
- A gray county has no firm yet. The app never guesses a firm for it.

Each firm's card lists its counties in words, for a quick read without the map.

## What comes next

The Legal desk reads each account's county and picks the firm from this map. An account in a gray county reads *No firm covers* that county. The desk cannot release it until you color the county. While no county is colored at all, the one firm takes every account. The desk's **Map** view shows the same counties with every case. A dev can open this block over the desk with its **Firms…** button. Read [manage who at the law firm gets emails](/help/manage-who-at-the-law-firm-gets-emails) for each firm's people.
