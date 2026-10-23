---
last_updated: 2026-10-23
---

# The Texas county map

The Legal desk's county map draws real county lines from one static file, `public/geo/tx-counties.json` (68 KB, 254 counties, GeoJSON, WGS84 longitude/latitude). Settings → Jobs & billing → **Collections law firms** uses it to color counties for a firm (punch list #144, PR 1, v2.5756); the mock-up beside `to-dos/legal-firms-by-county/`, the desk's Map lens (PR 3) and the firm portal's Who covers what (PR 4) draw the same file, so the picker and the lens can never disagree on a line.

## Source and license

- **Source**: the US Census Bureau's cartographic boundary file `cb_2023_us_county_20m` (TIGER/Line, generalized to 1:20,000,000), `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_20m.zip`.
- **License**: a work of the United States Government, in the public domain (17 U.S.C. § 105). No attribution is required; this page is the attribution anyway.
- **What was kept**: the 254 features with `STATEFP = 48`, each with `GEOID` (the five-digit county FIPS code) and `NAME` (the Census county name without the word County: *Bexar*, *Travis*, *DeWitt*), simplified with mapshaper 0.6.102 (`-simplify 35% keep-shapes`, precision 0.001, about 100 m). Nothing else from the source.

## Regenerating it

The file is generated, never hand-edited (made 2026-10-22 on the `spike/legal-desk` branch). A newer vintage only needs the year changed:

```bash
curl -sSLO https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_20m.zip && npx -y mapshaper@0.6.102 cb_2023_us_county_20m.zip -filter 'STATEFP == "48"' -filter-fields GEOID,NAME -simplify 35% keep-shapes -o format=geojson precision=0.001 public/geo/tx-counties.json
```

## How the app reads it

- `src/lib/legal/txCountyMap.ts` (pure, unit-tested) projects the features to SVG paths with a plate-carrée projection scaled by the cosine of the state's middle latitude, enough for a picker at this size, and gives each county a label point.
- `src/lib/legal/txCountyMapIo.ts` fetches the file once per page (`loadTxCounties`) and caches the projected shapes (`loadTxCountyMap`); the map's `project(lon, lat)` places a case's dot in the same units.
- `src/lib/legal/countyAt.ts` answers which county a longitude and latitude fall in (ray casting over the outer rings), so a case's venue follows its job's geocode when the property record names no county.
- `src/lib/legal/countyMapView.ts` is the view box math for zoom and pan.
- County names in `legal_firm_counties.county` are these `NAME` values, matched case-insensitively against `customer_addresses.county` and `src/lib/txCountyLookup.ts`, which spell them the same way.
