/**
 * Texas city → county suggestions for the property legal panel (v2.2614).
 * Curated for the company's Central-Texas service area (same spirit as the
 * job-address locality list in txLocalityAddressSplit) — a SUGGESTION only:
 * county is where the lien affidavit files, so a person always confirms it.
 * Cities that straddle county lines map to their dominant county here.
 * Plus the County Appraisal District search URL per county for the
 * legal-description lookup.
 */

const CITY_TO_COUNTY: Record<string, string> = {
  'san antonio': 'Bexar',
  'alamo heights': 'Bexar',
  'castle hills': 'Bexar',
  'converse': 'Bexar',
  'helotes': 'Bexar',
  'kirby': 'Bexar',
  'leon valley': 'Bexar',
  'live oak': 'Bexar',
  'shavano park': 'Bexar',
  'stone oak': 'Bexar',
  'universal city': 'Bexar',
  'windcrest': 'Bexar',
  'new braunfels': 'Comal',
  'bulverde': 'Comal',
  'canyon lake': 'Comal',
  'spring branch': 'Comal',
  'seguin': 'Guadalupe',
  'cibolo': 'Guadalupe',
  'marion': 'Guadalupe',
  'schertz': 'Guadalupe',
  'san marcos': 'Hays',
  'buda': 'Hays',
  'dripping springs': 'Hays',
  'kyle': 'Hays',
  'wimberley': 'Hays',
  'boerne': 'Kendall',
  'fair oaks ranch': 'Kendall',
  'austin': 'Travis',
  'lakeway': 'Travis',
  'pflugerville': 'Travis',
  'round rock': 'Williamson',
  'georgetown': 'Williamson',
  'cedar park': 'Williamson',
  'leander': 'Williamson',
  'blanco': 'Blanco',
  'johnson city': 'Blanco',
  'fredericksburg': 'Gillespie',
  'kerrville': 'Kerr',
  'bandera': 'Bandera',
  'hondo': 'Medina',
  'castroville': 'Medina',
  'pleasanton': 'Atascosa',
  'floresville': 'Wilson',
  'la vernia': 'Wilson',
  'lockhart': 'Caldwell',
  'luling': 'Caldwell',
  'houston': 'Harris',
  'dallas': 'Dallas',
  'fort worth': 'Tarrant',
}

/** County Appraisal District search pages — where the legal description lives. */
const COUNTY_CAD_URLS: Record<string, string> = {
  Bexar: 'https://bexar.trueautomation.com/clientdb/?cid=110',
  Comal: 'https://esearch.comalad.org/',
  Guadalupe: 'https://esearch.guadalupead.org/',
  Hays: 'https://esearch.hayscad.com/',
  Kendall: 'https://esearch.kendallad.org/',
  Travis: 'https://travis.prodigycad.com/property-search',
  Williamson: 'https://search.wcad.org/',
  Blanco: 'https://esearch.blancocad.com/',
  Gillespie: 'https://esearch.gillespiecad.org/',
  Kerr: 'https://esearch.kerrcad.org/',
  Bandera: 'https://esearch.banderaproptax.org/',
  Medina: 'https://esearch.medinacad.org/',
  Atascosa: 'https://esearch.atascosacad.com/',
  Wilson: 'https://esearch.wilsoncad.org/',
  Caldwell: 'https://esearch.caldwellcad.org/',
  Harris: 'https://hcad.org/property-search',
  Dallas: 'https://www.dallascad.org/SearchAddr.aspx',
  Tarrant: 'https://www.tad.org/property-search',
}

/** Suggested county for a Texas city — '' when unknown. Case/whitespace tolerant. */
export function suggestTxCountyForCity(city: string): string {
  const key = (city ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return ''
  return CITY_TO_COUNTY[key] ?? ''
}

/** CAD property-search URL for a county — '' when we don't have one. */
export function txCountyCadSearchUrl(county: string): string {
  const key = (county ?? '').trim()
  if (!key) return ''
  const exact = COUNTY_CAD_URLS[key]
  if (exact) return exact
  const ci = Object.keys(COUNTY_CAD_URLS).find((k) => k.toLowerCase() === key.toLowerCase())
  return ci ? COUNTY_CAD_URLS[ci]! : ''
}
