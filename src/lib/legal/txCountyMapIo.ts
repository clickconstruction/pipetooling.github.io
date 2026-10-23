import { projectCounties, type CountyFeatureCollection, type CountyMap } from './txCountyMap'

/** Where the build serves the county file (docs/TX_COUNTY_MAP.md). */
export const TX_COUNTIES_URL = '/geo/tx-counties.json'

let cachedFile: Promise<CountyFeatureCollection> | null = null
let cachedMap: Promise<CountyMap> | null = null

/** The county file, fetched once per page. A failed fetch is not cached, so the next open tries again. */
export function loadTxCounties(): Promise<CountyFeatureCollection> {
  if (!cachedFile) {
    cachedFile = fetch(TX_COUNTIES_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`county map ${res.status}`)
        return (await res.json()) as CountyFeatureCollection
      })
      .catch((err: unknown) => {
        cachedFile = null
        throw err
      })
  }
  return cachedFile
}

/** The projected county map, once per page. */
export function loadTxCountyMap(width = 600): Promise<CountyMap> {
  if (!cachedMap) {
    cachedMap = loadTxCounties()
      .then((fc) => projectCounties(fc, width))
      .catch((err: unknown) => {
        cachedMap = null
        throw err
      })
  }
  return cachedMap
}
