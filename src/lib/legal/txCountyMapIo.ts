import { projectCounties, type CountyFeatureCollection, type CountyMap } from './txCountyMap'

/** Where the build serves the county file (docs/TX_COUNTY_MAP.md). */
export const TX_COUNTIES_URL = '/geo/tx-counties.json'

let cached: Promise<CountyMap> | null = null

/** The projected county map, fetched and projected once per page. A failed fetch is not cached, so the next open tries again. */
export function loadTxCountyMap(width = 600): Promise<CountyMap> {
  if (!cached) {
    cached = fetch(TX_COUNTIES_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`county map ${res.status}`)
        return projectCounties((await res.json()) as CountyFeatureCollection, width)
      })
      .catch((err: unknown) => {
        cached = null
        throw err
      })
  }
  return cached
}
