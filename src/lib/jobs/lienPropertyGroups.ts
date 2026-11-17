/**
 * By job, gathered by property (v2.7493): the rows a filter left, under a head per property that holds more than one
 * job, then the properties with one job each, then the jobs with no property record. Most properties hold one job,
 * so those rows keep one plain head and read as the ungrouped list does.
 *
 * A head's count, money and tally are the whole property's (`buildLienProperties` over the whole book), never the
 * filtered rows': a filter must not make a property look smaller than it is. When a filter hides some of its jobs the
 * head says how many are shown. Pure.
 */
import { formatUsdNoCents } from './jobFormatting'
import { lienPropertyJobsWords, type LienProperty } from './lienPropertyPapers'
import type { LienTimelineBookRow } from './lienTimelineBook'

export type LienBookGroup = 'none' | 'property'

export type LienPropertySection = {
  kind: 'property' | 'singles' | 'no_record'
  /** The property record's id for a property's section; the kind for the other two. */
  key: string
  /** The head's first words: the address, *One job each* or *No property record*. */
  title: string
  /** The rest of the head: the owner, the count, the money and the tally. */
  words: string
  /** The property record to open the card on; null for the two sections that are no one property. */
  addressId: string | null
  rows: LienTimelineBookRow[]
}

export const LIEN_GROUP_SINGLES_TITLE = 'One job each'
export const LIEN_GROUP_NO_RECORD_TITLE = 'No property record'

function propertyHeadWords(p: LienProperty, shown: number): string {
  return [p.ownerName, lienPropertyJobsWords(p.jobs.length), `${formatUsdNoCents(p.openBalance)} open`, p.tally, shown < p.jobs.length ? `${shown} shown` : ''].filter(Boolean).join(' · ')
}

/**
 * The shown rows in sections. A property's section stands where its first shown row stood, so the property whose
 * next date is soonest leads, as the ungrouped list's first row does.
 */
export function groupLienBookByProperty(shown: ReadonlyArray<LienTimelineBookRow>, properties: ReadonlyArray<LienProperty>): LienPropertySection[] {
  const byKey = new Map(properties.map((p) => [p.key, p] as const))
  const sections = new Map<string, LienPropertySection>()
  const singles: LienTimelineBookRow[] = []
  const bare: LienTimelineBookRow[] = []
  for (const r of shown) {
    const id = r.job.addressId ?? ''
    const p = id ? byKey.get(id) : undefined
    if (!id) bare.push(r)
    else if (!p || p.jobs.length < 2) singles.push(r)
    else {
      const s = sections.get(id)
      if (s) s.rows.push(r)
      else sections.set(id, { kind: 'property', key: id, title: p.address || 'This property', words: '', addressId: id, rows: [r] })
    }
  }
  const out: LienPropertySection[] = [...sections.values()].map((s) => ({ ...s, words: propertyHeadWords(byKey.get(s.key)!, s.rows.length) }))
  if (singles.length) out.push({ kind: 'singles', key: 'singles', title: LIEN_GROUP_SINGLES_TITLE, words: singles.length === 1 ? '1 property' : `${singles.length} properties`, addressId: null, rows: singles })
  if (bare.length) out.push({ kind: 'no_record', key: 'no_record', title: LIEN_GROUP_NO_RECORD_TITLE, words: lienPropertyJobsWords(bare.length), addressId: null, rows: bare })
  return out
}
