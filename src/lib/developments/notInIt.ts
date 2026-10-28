/**
 * Not in it yet (punch list #208): the suggestion by address. A development has no address
 * column; its members do. When a saved bid or job has no development and its address matches
 * the addresses of records that are in one, the form offers one line, *4 bids and 6 jobs at
 * this address are in Harlow Ranch*, with **Put it in Harlow Ranch**. PR 1 draws the line on
 * Edit Bid and Edit Job; the Development page's own *not in it* line (PR 3) reads the same
 * functions, so the two never disagree about who is at the address.
 *
 * The match is on normalized addresses: case, punctuation and spacing are dropped, a trailing
 * zip code is dropped, and the common street suffixes are spelled one way, so *Gun Dog Trl,
 * Neeses SC 29107* and *gun dog trail, neeses, sc* are the same place. Nothing else is guessed:
 * a different street number is a different address.
 */
import { pluralNoun } from '../batchWords'

/** A bid or a job that is in a development, with the address the match reads. */
export type DevelopmentMember = {
  kind: 'bid' | 'job'
  id: string
  address: string | null | undefined
  developmentId: string | null | undefined
}

/** The developments rows the forms already load: the name, and whether it still takes new members. */
export type DevelopmentNameRow = { id: string; name: string | null; archived_at?: string | null }

/** What the line says: the development, and how many of each kind share the address. */
export type DevelopmentAddressSuggestion = {
  developmentId: string
  name: string
  bids: number
  jobs: number
}

/** Street suffixes spelled one way, so an abbreviation and the full word match. */
const SUFFIXES: Readonly<Record<string, string>> = {
  rd: 'road',
  st: 'street',
  dr: 'drive',
  ln: 'lane',
  trl: 'trail',
  tr: 'trail',
  ave: 'avenue',
  av: 'avenue',
  blvd: 'boulevard',
  hwy: 'highway',
  ct: 'court',
  cir: 'circle',
  pkwy: 'parkway',
  pl: 'place',
  ter: 'terrace',
  terr: 'terrace',
  way: 'way',
  loop: 'loop',
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
}

/**
 * One address as a comparison key: lowercase, letters and digits only, one space between
 * words, a trailing zip code (12345 or 12345-6789) dropped, suffixes spelled out. Empty for a
 * blank address, so a blank never matches a blank.
 */
export function normalizeAddressKey(address: string | null | undefined): string {
  const flat = (address ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return ''
  const withoutZip = flat.replace(/\s\d{5}(?:-\d{4})?$/, '')
  return withoutZip
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => SUFFIXES[w] ?? w)
    .join(' ')
}

/**
 * The development whose members share this record's address, or null: the record already has
 * a development, the address is blank, nobody at the address is in one, or the only ones
 * are in a development that is archived or unnamed. When members at the address sit in more
 * than one development, the one with the most of them is named, the other left to the person.
 * The record itself (`selfId`) is never counted, in case the list is a beat behind a save.
 */
export function suggestDevelopmentByAddress(args: {
  address: string | null | undefined
  developmentId: string | null | undefined
  selfId?: string | null
  members: readonly DevelopmentMember[]
  developments: readonly DevelopmentNameRow[]
}): DevelopmentAddressSuggestion | null {
  if (args.developmentId) return null
  const key = normalizeAddressKey(args.address)
  if (!key) return null
  const nameOf = new Map<string, string>()
  for (const d of args.developments) {
    if (d.archived_at) continue
    const name = (d.name ?? '').trim()
    if (name) nameOf.set(d.id, name)
  }
  const tally = new Map<string, { bids: number; jobs: number }>()
  for (const m of args.members) {
    if (!m.developmentId || !nameOf.has(m.developmentId)) continue
    if (args.selfId && m.id === args.selfId) continue
    if (normalizeAddressKey(m.address) !== key) continue
    const t = tally.get(m.developmentId) ?? { bids: 0, jobs: 0 }
    if (m.kind === 'bid') t.bids += 1
    else t.jobs += 1
    tally.set(m.developmentId, t)
  }
  let best: DevelopmentAddressSuggestion | null = null
  for (const [developmentId, t] of tally) {
    const candidate = { developmentId, name: nameOf.get(developmentId) ?? '', bids: t.bids, jobs: t.jobs }
    if (!best || candidate.bids + candidate.jobs > best.bids + best.jobs) best = candidate
  }
  return best
}

/**
 * The words on the form: the line a first-timer reads (one sentence, under 20 words) and the
 * button that acts. *4 bids and 6 jobs at this address are in Harlow Ranch.* · **Put it in
 * Harlow Ranch**. A side with nothing is left out: *3 bids at this address are in Harlow Ranch.*
 */
export function developmentSuggestionWords(s: DevelopmentAddressSuggestion): { line: string; button: string } {
  const parts: string[] = []
  if (s.bids > 0) parts.push(`${s.bids} ${pluralNoun('bid', s.bids)}`)
  if (s.jobs > 0) parts.push(`${s.jobs} ${pluralNoun('job', s.jobs)}`)
  const who = parts.join(' and ')
  const verb = s.bids + s.jobs === 1 ? 'is' : 'are'
  return {
    line: `${who} at this address ${verb} in ${s.name}.`,
    button: `Put it in ${s.name}`,
  }
}
