---
title: draw the justice precincts on the map
category: Office
roles: dev, master_technician, assistant, controller
keywords: map, court areas, justice precinct, justice of the peace, small claims, county, legal portal, venue, draw, polygon
---
The Map page can hold our own map of justice precincts. A small claim is filed in a county and a precinct. The precinct comes from where the address sits on the county's map. Draw each precinct once, and the app knows the precinct for every address inside it.

## Open the mode

Open **Map**. Click {{button:outline|Court areas}} on the toolbar. The button is there for the office. A panel opens under the map. Anyone on the page can see the precincts without the mode. They tap the {{chip:blue|Precincts}} chip over the map, and a place's card then names its justice court. The panel counts the pinned addresses inside a drawn area. It also counts the ones outside every area, and the ones on a line.

## Draw a precinct

Zoom the map to the county. Keep the county's own precinct map open beside you. Pick the polygon tool at the top left of the map. Click along the precinct's edge, and click the first point again to close the shape. The panel asks for the county and the precinct. Write the precinct the way the county writes it, such as 2, 1-2 or 3. Add a label if you like, such as Seguin. Write where you drew it from, such as the county's map and its year. Click {{button:blue|Save the area}}. The shape stays on the map with its name. {{button:outline|Discard the shape}} throws the shape away.

## Fix or remove one

Each area is listed under its county with where it came from and the day it was drawn. Click its name to fly the map to it. {{button:outline|Rename}} changes its words. {{button:outline|Remove}} takes it off the map after you confirm. To change the shape itself, remove it and draw it again.

## Put the addresses in their precincts

Every night the app puts each property record in its precinct from these areas. Click {{button:outline|Classify now}} to do it at once. The panel then counts the records placed. It also counts the ones outside every area, and the ones on a line. A precinct typed by hand on a property record is never changed by the map.

## What the layer is for

Counties come from the geocoder already. This map is for precincts only. A precinct in two pieces is one area drawn as one shape. The law firm's portal shows each job's precinct from this map. A property record shows it too, under **Justice precinct**, with where it came from. Type over it there to settle a precinct by hand. An address within about a hundred metres of a line between two precincts names both, for a person to settle.

:::example Where to start
The counties with the most jobs first. A county that publishes its precinct file will be imported, so draw by hand only where the county publishes a map to read by eye.
:::
