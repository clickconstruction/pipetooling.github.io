/**
 * The property card's own words (v2.7488): its head, the colour of each paper's line, the public line, the quiet line
 * for the owner's other property, and what a By job row says of its property. The papers' words themselves are
 * `lienPropertyPapers.ts`'s. Pure.
 */
import { normalizePropertyKind, propertyKindWords } from './propertyKind'
import type { LienPublicStanding } from './lienPublicProperty'
import { lienPropertyJobsWords, type LienProperty, type LienPropertyAffidavitState, type LienPropertyNoticeState, type LienPropertySameOwner } from './lienPropertyPapers'

/** done: behind us. going: moving now. waits: on a person or a fact. stop: a window closed. quiet: nothing to do. */
export type LienPropertyTone = 'done' | 'going' | 'waits' | 'stop' | 'quiet'

const NOTICE_TONE: Record<LienPropertyNoticeState, LienPropertyTone> = { sent: 'done', going: 'going', waits: 'waits', missed: 'stop', none_needed: 'quiet', none: 'waits' }
const AFFIDAVIT_TONE: Record<LienPropertyAffidavitState, LienPropertyTone> = { filed: 'done', ready: 'going', waits: 'waits', held: 'waits', missed: 'stop', blocked: 'stop', none: 'quiet' }

export type LienPropertyCardHead = {
  /** The property's address, or *This property* when the record has none. */
  title: string
  /** *Owner of record: Avery and Jordan Pell · Residential · GC: Marlow Builders* */
  sub: string
  tones: Record<string, { notice: LienPropertyTone; affidavit: LienPropertyTone }>
}

export function lienPropertyCardHead(p: LienProperty): LienPropertyCardHead {
  const gcs = [...new Set(p.jobs.map((j) => j.gcName.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const kinds = new Set(p.rows.map((r) => normalizePropertyKind(r.job.propertyKind)))
  const kind = kinds.size === 1 ? propertyKindWords([...kinds][0]!) : ''
  const sub = [p.ownerName ? `Owner of record: ${p.ownerName}` : 'No owner of record yet', kind, gcs.length ? `${gcs.length === 1 ? 'GC' : 'GCs'}: ${gcs.join(', ')}` : ''].filter(Boolean).join(' · ')
  const tones: LienPropertyCardHead['tones'] = {}
  for (const j of p.jobs) tones[j.jobId] = { notice: NOTICE_TONE[j.notice.state], affidavit: AFFIDAVIT_TONE[j.affidavit.state] }
  return { title: p.address || 'This property', sub, tones }
}

/** The line a card carries when the record's public answer bears on its papers; '' when it does not. */
export function lienPropertyPublicLine(standing: LienPublicStanding | null | undefined): string {
  if (standing === 'off_path') return 'This property is answered public. Its jobs are off the lien path.'
  if (standing === 'asks') return 'The owner’s name reads as a public body. Nobody has answered yet whether this is public property.'
  return ''
}

/** *88 Fenwick Ln, Hollow Creek · 1 job*, or *a second record for this address · 1 job* when the two records read the same address. */
export function lienPropertySameOwnerWords(o: Pick<LienPropertySameOwner, 'address' | 'jobs' | 'sameAddress'>): string {
  return `${o.sameAddress ? 'a second record for this address' : o.address || 'another property'} · ${lienPropertyJobsWords(o.jobs)}`
}

export type LienPropertyRowDoor = {
  /** The property record's id, null when the job has none. */
  addressId: string | null
  /** *412 Ridgeline Dr, Hollow Creek · 7 jobs here*, the address alone for a property with one job, or *No property record*. */
  words: string
  /** The property holds more jobs than this one. */
  shared: boolean
}

/** What a By job row says of the property it stands on, over the whole book's properties (not the rows a filter left). */
export function lienPropertyRowDoor(properties: ReadonlyArray<Pick<LienProperty, 'key' | 'address' | 'jobs'>>, row: { job: { addressId?: string | null; address: string } }): LienPropertyRowDoor {
  const id = row.job.addressId ?? null
  if (!id) return { addressId: null, words: 'No property record', shared: false }
  const p = properties.find((x) => x.key === id)
  const address = p?.address || row.job.address || 'This property'
  const n = p?.jobs.length ?? 1
  return { addressId: id, words: n > 1 ? `${address} · ${lienPropertyJobsWords(n)} here` : address, shared: n > 1 }
}
