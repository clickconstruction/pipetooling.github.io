import { HOMESTEAD_QUESTION_DOOR } from '../customers/homesteadAnswer'

/**
 * The affidavit pane's gate rows as presses (v2.7313). Pure.
 *
 * Until v2.7313 only a gate that failed had a door, so a checked fact that was wrong was a dead end: the owner, reading
 * JP372 on 2026-11-15, asked to open any row and edit what it reads. Every gate already has a home in the app — the
 * property record at the owner, the legal description or the homestead question (`onFixProperty`), the GC's customer
 * record (`onFixContractor`), Monthly notices on the job (`onShowNotices`) — so the whole row becomes the press and
 * opens that home at the right line. A failed gate keeps its named door, which says what fixing it takes; a passed one
 * shows the fact it holds and ends in a quiet *Change ›* (*See it ›* for the notice, which is read on its own tab, not
 * edited here). Nothing edits in place: the records stay the writers and the desk the reader.
 */

export type LienGateDoor = 'property_owner' | 'property_legal' | 'property_homestead' | 'contractor' | 'notices'

export type LienGateRowFacts = {
  isSub: boolean
  ownerName?: string | null
  county?: string | null
  legalDescription?: string | null
  gcName?: string | null
  gcAddress?: string | null
  /** The last notice to the owner on record, as words: `sent Sep 22`. */
  noticeSentWords?: string | null
}

/** Which homes the page wired: without `property` the owner and legal doors open Edit Job, as before; without `contractor` the GC row is words alone. */
export type LienGateRowDoors = { property: boolean; contractor: boolean }

export type LienGateRow = {
  /** The fact the row holds, after the label: the owner's name, the county and legal description, the GC and its address, the notice's day. '' when none. */
  fact: string
  door: LienGateDoor | null
  /** The words at the row's end: the failed gate's named door, or *Change ›* / *See it ›* on a passed one. '' with no door. */
  doorWords: string
  /** The press's tooltip: where the row opens. '' with no door. */
  title: string
}

const LEGAL_MAX = 48

const shortLegal = (legal: string | null | undefined): string => {
  const s = (legal ?? '').trim().replace(/\s+/g, ' ')
  return s.length > LEGAL_MAX ? `${s.slice(0, LEGAL_MAX - 1).trimEnd()}…` : s
}

const join = (parts: ReadonlyArray<string | null | undefined>): string => parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' · ')

export function lienGateRow(gate: { key: string; ok: boolean }, facts: LienGateRowFacts, doors: LienGateRowDoors): LienGateRow {
  const none: LienGateRow = { fact: '', door: null, doorWords: '', title: '' }
  const recordWords = gate.ok ? 'Change ›' : doors.property ? 'Fill in the record ›' : 'Property record ›'
  switch (gate.key) {
    case 'owner':
      return { fact: join([facts.ownerName]), door: 'property_owner', doorWords: recordWords, title: 'Opens the property record at the owner of record' }
    case 'public_owner':
      return { fact: join([facts.ownerName]), door: 'property_owner', doorWords: 'Property record ›', title: 'Opens the property record at the owner of record' }
    case 'legal':
      return { fact: join([facts.county, shortLegal(facts.legalDescription)]), door: 'property_legal', doorWords: recordWords, title: 'Opens the property record at the county and legal description' }
    case 'contractor':
      if (!facts.isSub || !doors.contractor) return none
      return { fact: join([facts.gcName, facts.gcAddress]), door: 'contractor', doorWords: gate.ok ? 'Change ›' : 'Add the address ›', title: 'Opens the general contractor’s customer record, where its address is typed' }
    case 'notice':
      if (!facts.isSub) return none
      return { fact: gate.ok ? join([facts.noticeSentWords]) : '', door: 'notices', doorWords: gate.ok ? 'See it ›' : 'Send the notice first ›', title: 'Opens Monthly notices on this job' }
    case 'homestead_answer':
      return { fact: '', door: 'property_homestead', doorWords: HOMESTEAD_QUESTION_DOOR, title: 'Opens the property record at the homestead question' }
    case 'homestead':
      return { fact: '', door: 'property_homestead', doorWords: gate.ok ? 'Change ›' : 'Property record ›', title: 'Opens the property record at the homestead question' }
    default:
      return none
  }
}
