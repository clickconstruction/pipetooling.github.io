---
title: make job addresses wrap at the city name
category: Office
roles: dev
keywords: address, city, line break, wrap, stages, devine, locality, two lines, settings
order: 75
---
You add a missing city name so job addresses wrap at the city. The street goes on one line and the city on the next.

Typing a Job Address in **New Job / Edit Job** now offers live address suggestions. They are powered by Google and biased to our service area. After a few characters, a dropdown lists real addresses with the match in bold. Arrow keys and Enter take one. So does a tap. Esc dismisses. Typing straight past the list always works. A taken suggestion arrives street-comma-city. That is already the shape everything below depends on. It teaches the Map its location immediately. A typed or pasted address pins itself too. Under the field, **On the map** names the county the pin landed in. It runs once the address looks whole, or when you leave the field. A pin that looks wrong has a chip to ask Google instead. Nothing there blocks the save.

Job addresses on **Jobs → Pipeline** and **Billing** show on two lines. The street comes first, then the **City ST** part. So rows stay scannable. The split happens at a known city name, or at a comma when there is one. The same city list also splits street from city when prefilling lien documents. A lien is a legal claim on the property for unpaid work. It does the same for the AIA G702/G703 form, the standard progress-billing form. The list also powers the **Add comma** suggestion under the Job Address field in New Job / Edit Job. Paste an address like "1200 Kenney Fort Blvd Round Rock, TX 78665". A one-tap chip offers the corrected "1200 Kenney Fort Blvd, Round Rock, TX 78665". It shows a live preview of how the address will read on customer statements. The chip only fires for cities on this list. It never blocks saving. Addresses also normalize to **Title Case** automatically when a job saves. "11704 fm 1117 seguin tx" becomes "11704 FM 1117 Seguin TX". Road abbreviations like FM, IH and TX are handled properly. So are ordinals like "5th" and names like McQueeney.

The app ships with a list of Central Texas cities. San Antonio, Seguin, New Braunfels and more are on it. A job address may use a city that isn't on the list and has no comma. Then the address can't split and runs together on one line.

## Add a missing city

1. Open {{icon:gear}} **Settings → Jobs & dispatch**.
2. Expand ***Job address city line breaks (dev)***.
3. Type the missing city names, one per line, and click {{button:blue|Save}}.

:::example "1875 Co Rd 777 Devine TX"
Without "Devine" on the list this stays glued together. After adding it, the row shows "1875 Co Rd 777" with "Devine TX" on its own line — and lien prefills put "Devine" in the city field.
:::

The change applies org-wide. Your session updates immediately. Everyone else picks it up the next time the app loads. Built-in cities can't be removed. This list only adds to them.
