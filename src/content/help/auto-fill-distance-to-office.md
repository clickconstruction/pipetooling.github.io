---
title: auto-fill a bid's distance to office
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: distance to office, miles, driving distance, auto, project address, google maps, routes, office address
order: 92
---
The bid form's **Distance to Office (miles)** now fills itself from the **Project Address** — no more looking it up on Google Maps by hand.

## How it fills

- Type or paste the **Project Address** and click away — if Distance is blank, it computes automatically.
- Or hit the {{button:gray|↻ Auto}} button next to the field any time to (re)compute.
- A note under the field tells you what you got:
  - **"Driving miles via Google — from …"** — real driven miles.
  - **"≈ straight-line estimate — from …"** — a close approximation, used whenever live routing isn't available.
- A number you typed yourself is **never overwritten** — auto-fill only fills blanks; ↻ recomputes only when you ask.

## Where it measures from

Set the office once under **Settings → Templates → Office address** — saving looks up the coordinates and every bid measures from there. Until it's set, distances measure from the **Map default view** address instead, and the note shows which address was used.

:::example
Project Address "14540 HWY 105 W. Conroe, TX 77304" → click away → Distance fills with the mileage from your office, labeled with how it was measured.
:::
