import { JUSTICE_COURT_LIMIT } from '../jobsDocuments/demandLetter'
import { formatLegalMoney } from './legalPacket'

/**
 * Which court (v2.4764, step 1 of the owner's justice-court plan, 2026-10-06): the
 * county, the $20,000 justice court limit, the two venue bases TRCP 502.4 gives a
 * plumbing bill, and the one thing a justice court cannot do. The precinct reads
 * *not yet* until the office's court map (steps 2–5) exists. Pure words; the grid,
 * the matter's *Where to file* block and the printed packet read one rule.
 */

/** Gov't Code § 27.031: fees count toward the limit, interest and costs do not. */
export function justiceCourtCap(balance: number): { within: boolean; words: string; chip: string } {
  const within = Number.isFinite(balance) && balance <= JUSTICE_COURT_LIMIT
  const limit = formatLegalMoney(JUSTICE_COURT_LIMIT).replace(/\.00$/, '')
  return within
    ? { within, words: `${formatLegalMoney(balance)} is within the justice court limit (${limit}, Gov't Code § 27.031; fees count, interest does not).`, chip: `within ${limit}` }
    : { within, words: `${formatLegalMoney(balance)} is over the justice court limit (${limit}) — county or district court.`, chip: `over ${limit} · county court` }
}

export type VenuePlace = {
  basis: 'work' | 'defendant'
  /** `Where the work was done` · `Where the defendant is` */
  basisWords: string
  county: string
  /** Null until the office's court map names it. */
  precinct: string | null
  /** The address (the work) or the name and address (the defendant). */
  where: string
  jobLabels: string[]
}

export const PRECINCT_NOT_YET = 'precinct not yet'
export const PRECINCT_NOT_YET_TITLE = 'The office is drawing its justice precincts on its own map; the county is on the record today.'

/** `Guadalupe County · Justice Court, Precinct 2` · `Guadalupe County · justice precinct not yet` · `county not on the record`. */
export function courtWords(p: Pick<VenuePlace, 'county' | 'precinct'>): string {
  if (!p.county) return 'county not on the record'
  return p.precinct ? `${p.county} County · Justice Court, Precinct ${p.precinct}` : `${p.county} County · justice ${PRECINCT_NOT_YET}`
}

/**
 * TRCP 502.4: the defendant may be sued where the contract was to be performed (the job
 * site) or where the defendant resides. One place per distinct property, then the payer.
 */
export function venuePlaces(input: {
  properties: ReadonlyArray<{ address: string; county: string; jobLabels: ReadonlyArray<string> }>
  payer: { name: string; address: string; county: string }
}): VenuePlace[] {
  const out: VenuePlace[] = []
  const seen = new Set<string>()
  for (const p of input.properties) {
    const key = `${p.county}|${p.address}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ basis: 'work', basisWords: 'Where the work was done', county: p.county, precinct: null, where: p.address, jobLabels: [...p.jobLabels] })
  }
  out.push({ basis: 'defendant', basisWords: 'Where the defendant is', county: input.payer.county, precinct: null, where: [input.payer.name, input.payer.address].filter(Boolean).join(', '), jobLabels: [] })
  return out
}

/** § 27.031(b): a justice court cannot foreclose a lien on land; the foreclosure is a district-court suit in the property's county. */
export function lienForeclosureLine(counties: ReadonlyArray<string>): string {
  const names = [...new Set(counties.filter(Boolean))]
  const where = names.length === 0 ? "the property's county" : names.length === 1 ? `${names[0]} County` : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]} County`
  return `A lien foreclosure goes to district court in ${where} — a justice court cannot foreclose a lien on land (Gov't Code § 27.031(b)).`
}

export const VENUE_SOURCE_LINE = "County from the property record; the precinct comes with the office's court map. TRCP 502.4 gives either venue and the choice is counsel's. Confirm with the clerk before filing."

/** The printed packet's one paragraph. */
export function whereToFileText(input: { balance: number; places: ReadonlyArray<VenuePlace> }): string {
  const cap = justiceCourtCap(input.balance).words
  const places = input.places.map((p) => `${p.basisWords}: ${courtWords(p)}${p.where ? ` (${p.where})` : ''}.`).join(' ')
  return `${cap} ${places} ${lienForeclosureLine(input.places.filter((p) => p.basis === 'work').map((p) => p.county))} ${VENUE_SOURCE_LINE}`
}
