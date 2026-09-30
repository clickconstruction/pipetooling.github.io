---
title: find the assemblies that include a part
category: Office
roles: dev, master_technician, assistant, estimator
keywords: takeoff, assembly, part, bids, add assembly, in assemblies, part line, bundle
order: 75
---
You put a part on a takeoff line. The app tells you which of your saved assemblies already include that part.

A takeoff is the list of parts counted for a bid. An assembly is a saved bundle of parts. So you need not add the rest of the fixture's parts one by one. You can pull in the whole assembly from right there.

## Where it shows up

On **Bids → Takeoffs**, add a part with **Add part line** as usual. A small blue link appears under the selected part, next to its type. It appears when the part belongs to at least one assembly:

:::example A selected part line
**AMERICAN STANDARD CADET PRO**

Part · Toilet · **In 3 assemblies**
:::

No link means no saved assembly includes that part.

## What clicking it does

The link opens the familiar **Add assembly** picker. It is pre-filtered to just the assemblies that include your part. A chip at the top shows the filter:

:::example Add assembly, filtered
{{chip:blue|Containing: 3" PVC closet flange ×}}

**WC rough-in** — includes 3" PVC closet flange ×1 {{button:outline-blue|Add as bundle}}

**Bath group rough-in** — includes 3" PVC closet flange ×2 {{button:outline-blue|Add as bundle}}
:::

Each row also says how many of that part the assembly uses. That count includes parts inside nested assemblies.

From here it works exactly like the normal Add assembly picker:

- **Click the assembly name** to expand it into individual part lines on that fixture.
- **{{button:outline-blue|Add as bundle}}** adds it as one bundle line priced at the assembly's supply-house price.
- Click the **×** on the chip to clear the filter and browse all assemblies.

## Tips

- Your original part line stays put. If the assembly already includes that part, delete the duplicate line you no longer need.
- The counts refresh when assemblies change. Add a part to an assembly with **Save as Assembly**. The new count shows next time the takeoff loads.
