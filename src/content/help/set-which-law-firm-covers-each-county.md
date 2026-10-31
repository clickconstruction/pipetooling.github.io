---
title: set which law firm covers each county
category: Billing & Money
roles: dev
keywords: legal, attorney, law firm, collections, county, counties, venue, territory, map, texas, settings, jobs and billing, who covers, zoom, cases, dots, share, shared, first call, stripes
where: /settings?tab=settings-jobs#settings-legal-firm
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

## When another firm already covers the county

A county keeps the color of the firm that covers it. Click it while a different firm is picked, and the app asks how the picked firm should cover it.

- **Share it.** Both firms cover the county. The firm that had it stays first call.
- **Make the picked firm first call.** Both firms cover the county. New releases there go to the picked firm.
- **Move it.** The picked firm takes the county. The other firm stops covering it.

Press {{button:outline|Leave it}} to change nothing.

## What first call means

Two firms can share a county. One of them is its first call. The Legal desk picks the first call for a release in that county. The office can still switch a release to the other firm. Click a county your picked firm shares to take it off for that firm. When the first call comes off, the other firm becomes first call.

Sharing, moving or clearing a county changes new releases only. An account already with a firm stays with that firm.

## Add the second firm

Press {{button:outline|Add a firm}} under the firm cards. Fill in the name, the handling person, the email and the fee model. Press {{button:dark|Add firm}}. The new firm shows on the map with its own color and no counties yet.

## What the colors mean

- A colored county has a firm. The legend under the map names each color.
- A striped county has two firms. The first call's color sits under thin lines in the other firm's color.
- A gray county has no firm yet. The app never guesses a firm for it.

Each firm's card lists its counties in words, for a quick read without the map. A county the firm covers without being first call has the word also after its name.

## What comes next

The Legal desk reads each account's county and picks that county's first call from this map. An account in a gray county reads *No firm covers* that county. The desk cannot release it until you color the county. While no county is colored at all, the one firm takes every account. The desk's **Map** view shows the same counties with every case. A dev can open this block over the desk with its **Firms…** button. Read [manage who at the law firm gets emails](/help/manage-who-at-the-law-firm-gets-emails) for each firm's people.
