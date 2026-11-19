/**
 * The number the County Clerk stamps on a filed lien (the owner's ask of 2026-11-18, from Taunya at the desk: *"she
 * would also like a place one click away from the Lien to do page to add the document number the recorders office
 * gave her back"*).
 *
 * The number lives on the filing as `recording_number`. Until now it was typed in one place, the job's Lien window
 * under **Record filing…**, and the desk named it three ways: *Recording #* on that form, *Document number* on the
 * copy that is mailed, *instrument #* on the release. The desk's own windows say **Document number**, the word the
 * mailed copy prints and the word the office uses.
 *
 * A typed number is checked before it is kept, so a slip is caught while the stamped paper is still in hand:
 *  - **a twin** is held. Two liens in one county cannot share a number, so one of the two was typed wrong.
 *  - **an odd one** is asked about and can still be saved. The county's numbers on record say how long a number is
 *    and whether it starts with the year it was filed. A clerk can change a format, so this never refuses.
 *
 * Pure: the numbers on record come in, words come out.
 */
import { formatYmdMonthDay } from './billedExpectedPay'

export const LIEN_DOC_NUMBER_WORDS = {
  label: 'Document number',
  short: 'Document no.',
  placeholder: 'the number on the clerk’s stamp',
  change: 'Change',
  anyway: 'Save it anyway',
  none: 'No document number yet.',
  noneWhy: 'Its copies cannot print without it.',
  saving: 'Saving…',
  saved: 'Number saved.',
  failed: 'the lien did not take it',
  stamped: 'Stamped lien',
  open: 'Open',
  noStamped: 'No stamped lien kept yet.',
  reprint: 'Its copies were printed with the old number. Print them again.',
} as const

/** One filed lien's number as the desk holds it, for the checks. */
export type LienDocKnown = { filingId: string; county: string; number: string; filedYmd: string; jobLabel: string }

/** What a county's numbers on record look like: how many digits, and whether each starts with the year it was filed. */
export type LienDocShape = { digits: number; year: boolean }

/** A number as it is kept: trimmed, one space where several were typed. */
export function lienDocNumberClean(typed: string): string {
  return (typed ?? '').trim().replace(/\s+/g, ' ')
}

const digitsOf = (s: string): string => (s ?? '').replace(/\D/g, '')
const sameCounty = (a: string, b: string): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
/** Two numbers are one when their letters and digits match, whatever spaces or dashes sit between them. */
const key = (s: string): string => (s ?? '').replace(/[^0-9a-z]/gi, '').toLowerCase()

/** The county's shape, from its numbers on record that are digits alone. Null with none to learn from. */
export function lienDocShape(known: ReadonlyArray<LienDocKnown>, county: string): LienDocShape | null {
  const rows = known.filter((k) => sameCounty(k.county, county) && /^[\d\s-]+$/.test(k.number.trim()) && digitsOf(k.number).length > 0)
  if (rows.length === 0) return null
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(digitsOf(r.number).length, (counts.get(digitsOf(r.number).length) ?? 0) + 1)
  // The commonest length; with a tie, the longer, since a dropped digit is the commoner slip.
  const digits = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0]
  const year = rows.every((r) => /^\d{4}-/.test(r.filedYmd) && digitsOf(r.number).startsWith(r.filedYmd.slice(0, 4)))
  return { digits, year }
}

export type LienDocCheck =
  | { kind: 'empty' }
  | { kind: 'ok' }
  /** Another lien in the county holds it: held, with the lien named. */
  | { kind: 'twin'; words: string }
  /** Not the county's usual shape: asked about, and saved on the reader's word. */
  | { kind: 'odd'; words: string }

/**
 * Check one typed number. `selfId` is the filing being changed, left out of the twin search; a lien not yet on record
 * has none. `known` is every filed lien's number the desk holds, and for a stack typed in one sitting, the rows typed
 * so far.
 */
export function lienDocCheck(input: { number: string; county: string; filedYmd: string; known: ReadonlyArray<LienDocKnown>; selfId?: string | null }): LienDocCheck {
  const number = lienDocNumberClean(input.number)
  if (!number) return { kind: 'empty' }
  const twin = input.known.find((k) => k.filingId !== (input.selfId ?? '') && sameCounty(k.county, input.county) && key(k.number) !== '' && key(k.number) === key(number))
  if (twin) return { kind: 'twin', words: `${twin.jobLabel.trim() || 'Another lien'} holds this number too. Two liens cannot share one. Check both stamps.` }
  const county = input.county.trim() ? `${input.county.trim()} County’s` : 'This county’s'
  const count = digitsOf(number).length
  const shape = lienDocShape(input.known.filter((k) => k.filingId !== (input.selfId ?? '')), input.county)
  if (!shape) {
    return count < 6 ? { kind: 'odd', words: 'That is short for a clerk’s number. Check it against the stamp.' } : { kind: 'ok' }
  }
  const usual = `${county} numbers on record have ${shape.digits} digits${shape.year ? ' and start with the year filed' : ''}.`
  if (count !== shape.digits) return { kind: 'odd', words: `${usual} This one has ${count} ${count === 1 ? 'digit' : 'digits'}. Check it against the stamp.` }
  const yyyy = /^\d{4}-/.test(input.filedYmd) ? input.filedYmd.slice(0, 4) : ''
  if (shape.year && yyyy && !digitsOf(number).startsWith(yyyy)) return { kind: 'odd', words: `${usual} This one does not start with ${yyyy}. Check it against the stamp.` }
  return { kind: 'ok' }
}

/** What follows the number on a card: *Alder County · filed Nov 16*. The parts not known are left out. */
export function lienDocFiledWords(input: { county?: string | null; filedYmd?: string | null }): string {
  const county = (input.county ?? '').trim()
  const day = (input.filedYmd ?? '').trim()
  return [county ? `${county} County` : '', day ? `filed ${formatYmdMonthDay(day)}` : ''].filter(Boolean).join(' · ')
}

/** Under a number that did not save: the reason, and that the box still holds what was typed. */
export function lienDocNotSavedWords(reason: string): string {
  const why = (reason ?? '').trim().replace(/[.\s]+$/, '')
  return `Not saved${why ? `: ${why}` : ''}. The box still holds what you typed.`
}

/** Every filed lien's number on the desk, for the checks: live affidavits with a number. */
export function lienDocKnownFromFilings(
  filingsByJob: Readonly<Record<string, ReadonlyArray<{ id: string; kind: string; county?: string | null; recording_number?: string | null; filed_at?: string | null; voided_at?: string | null }>>>,
  jobLabel: (jobId: string) => string,
): LienDocKnown[] {
  const out: LienDocKnown[] = []
  for (const [jobId, filings] of Object.entries(filingsByJob)) {
    for (const f of filings) {
      if (f.kind !== 'affidavit' || f.voided_at || !(f.recording_number ?? '').trim()) continue
      out.push({ filingId: f.id, county: (f.county ?? '').trim(), number: (f.recording_number ?? '').trim(), filedYmd: (f.filed_at ?? '').slice(0, 10), jobLabel: jobLabel(jobId) })
    }
  }
  return out
}
