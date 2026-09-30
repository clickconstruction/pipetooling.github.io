---
title: auto-fill a bid's distance to office
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: distance to office, miles, driving distance, auto, project address, google maps, routes, office address
order: 92
---
The bid form fills in the distance to the office for you. It measures from the project address, so you no longer look it up on Google Maps by hand.

## How it fills

- Type or paste the **Project Address** and click away. If the field *Distance to Office (miles)* is blank, it computes on its own.
- Or tap the {{button:gray|↻ Auto}} button next to the field at any time. It computes the distance again.
- A note under the field tells you what you got:
  - *Driving miles via Google — from …* means real driven miles.
  - *≈ straight-line estimate — from …* means a close guess. You get it whenever live routing is not available.
- A number you typed yourself is **never overwritten**. Auto-fill only fills blanks. ↻ recomputes only when you ask.
- **Saving fills it too.** Say Distance is still blank when you tap {{button:blue|Save bid}} and the bid has an address. Then the app measures it and saves it with the bid. So a bid entered without touching the address field still gets its miles.

## Where it measures from

Set the office once under **Settings → Templates → Office address**. Saving looks up the coordinates. Every bid then measures from there. Until it is set, distances measure from the **Map default view** address instead. The note shows which address was used.

:::example
Project Address "14540 HWY 105 W. Conroe, TX 77304" → click away → Distance fills with the mileage from your office, labeled with how it was measured.
:::
