---
title: make job addresses wrap at the city name
category: Office
roles: dev
keywords: address, city, line break, wrap, stages, devine, locality, two lines, settings
order: 75
---
Typing a Job Address in **New Job / Edit Job** now offers live address suggestions (powered by Google, biased to our service area): after a few characters a dropdown lists real addresses with the match in bold — arrow keys and Enter (or a tap) take one, Esc dismisses, and typing straight past the list always works. A taken suggestion arrives street-comma-city, already the shape everything below depends on, and teaches the Map its location immediately.

Job addresses on **Jobs → Pipeline** and **Billing** show on two lines — street first, then the **City ST** part — so rows stay scannable. The split happens at a known city name (or a comma when there is one). The same city list also splits street vs city when prefilling lien documents and the AIA G702/G703 form — and powers the **Add comma** suggestion under the Job Address field in New Job / Edit Job: paste an address like "1200 Kenney Fort Blvd Round Rock, TX 78665" and a one-tap chip offers the corrected "1200 Kenney Fort Blvd, Round Rock, TX 78665", with a live preview of how the address will read on customer statements. The chip only fires for cities on this list, and it never blocks saving. Addresses also normalize to **Title Case** automatically when a job saves — "11704 fm 1117 seguin tx" becomes "11704 FM 1117 Seguin TX", with road abbreviations (FM, IH, TX), ordinals ("5th"), and names like McQueeney handled properly.

The app ships with a list of Central Texas cities (San Antonio, Seguin, New Braunfels, and more). When a job address uses a city that isn't on the list — and has no comma — the address can't split and runs together on one line.

## Add a missing city

1. Open {{icon:gear}} **Settings → Jobs &amp; dispatch**.
2. Expand **Job address city line breaks (dev)**.
3. Type the missing city names, one per line, and click {{button:blue|Save}}.

:::example "1875 Co Rd 777 Devine TX"
Without "Devine" on the list this stays glued together. After adding it, the row shows "1875 Co Rd 777" with "Devine TX" on its own line — and lien prefills put "Devine" in the city field.
:::

The change applies org-wide: your session updates immediately, and everyone else picks it up the next time the app loads. Built-in cities can't be removed — this list only adds to them.
