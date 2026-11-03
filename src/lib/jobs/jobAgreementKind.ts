/**
 * The kind of job agreement a `job_contracts` row is (the owner's call of 2026-11-02): our **contract**, or the
 * **warranty** the office sends a homeowner in place of one when a contract would put them off. The warranty reads to the
 * customer as "we are showing up for you" and binds both sides all the same: the customer initials each line and
 * certifies the work on it, and we warrant the work. Everything else is the Contract Desk's as it stands: the window,
 * the ways to get it signed, the page, the signed copy, the chip, the reminders. Pure: the words by kind, the default
 * lines a homeowner initials, the default terms, and the rules the initials meet.
 */
import { jobContractHeading, type JobForContractPrefill } from './jobContractDocument'

export type JobAgreementKind = 'contract' | 'warranty'

export const JOB_AGREEMENT_KINDS: readonly JobAgreementKind[] = ['contract', 'warranty']

/** A row's kind as the column says it; a row from before the column, or anything unknown, is a contract. */
export function jobAgreementKindOf(raw: unknown): JobAgreementKind {
  return raw === 'warranty' ? 'warranty' : 'contract'
}

export type JobAgreementWords = {
  kind: JobAgreementKind
  /** In a sentence: "the contract", "the warranty". */
  noun: string
  /** At the start of a sentence or on a chip: "Contract", "Warranty". */
  Noun: string
  /** With its article: "a contract", "a warranty". */
  a: string
  /** What the customer does with it, for the agree sentence: "agree to", "certify the work above and accept". */
  signVerb: string
  /** The signed PDF's file name stem: "Signed-agreement", "Signed-warranty". */
  fileStem: string
}

export const JOB_AGREEMENT_WORDS: Readonly<Record<JobAgreementKind, JobAgreementWords>> = {
  contract: { kind: 'contract', noun: 'contract', Noun: 'Contract', a: 'a contract', signVerb: 'agree to', fileStem: 'Signed-agreement' },
  warranty: { kind: 'warranty', noun: 'warranty', Noun: 'Warranty', a: 'a warranty', signVerb: 'certify the work above and accept', fileStem: 'Signed-warranty' },
}

/** The paper's heading by kind: "Service agreement for 407 E 6th St", "Warranty for 407 E 6th St". */
export function jobAgreementHeading(kind: JobAgreementKind, job: Pick<JobForContractPrefill, 'job_address' | 'job_name'>): string {
  if (kind === 'contract') return jobContractHeading(job)
  const addr = (job.job_address ?? '').trim()
  if (addr) return `Warranty for ${addr.split(',')[0]?.trim() || addr}`
  const name = (job.job_name ?? '').trim()
  return name ? `Warranty — ${name}` : 'Warranty'
}

/**
 * The lines a homeowner initials, as the window prefills them for a new warranty; the office edits them per job. Each is
 * one thing the customer certifies or acknowledges, in the customer's own voice. Written for a warranty sent before the
 * work, in the slot a contract would take; the office rewrites the first two for one sent at completion.
 */
export const DEFAULT_WARRANTY_INITIAL_LINES: readonly string[] = [
  'The work listed above is the work I asked for at this address.',
  'The price listed is the price we agreed on, due when the work is done.',
  'The labor is warranted for one year from the day the work is finished. Manufacturer warranties pass through on materials. Misuse, freezing and work by others are not covered.',
  'A change to the work is priced and approved before it proceeds.',
]

/** The sentence beside the signature on a warranty: what the signature means. */
export const WARRANTY_CERTIFY_SENTENCE = 'I certify the work listed above and accept this warranty.'

/** Built-in warranty terms, used until the office adds a Warranty document to the Contract Book (audience customer). */
export const DEFAULT_JOB_WARRANTY_TERMS_PLAIN = `1. The work. Contractor will do the work listed above at the property listed, in a workmanlike manner and in accordance with applicable codes. Work not listed is not included.

2. The warranty. Contractor warrants its labor for one year from the day the work is finished. Manufacturer warranties on materials and equipment pass through to the Customer to the extent the manufacturer permits. The warranty does not cover damage from misuse, neglect, freezing, acts of God, or work performed by others.

3. Warranty service. The Customer calls or texts the office and Contractor returns to look at no charge. Work the warranty covers is corrected at no charge. Work it does not cover is priced in writing before it proceeds.

4. Changes. Additional or changed work is priced in writing and approved by the Customer before it proceeds. An approved change becomes part of this warranty.

5. Payment. The price listed above is due as stated above. Materials remain Contractor's property until paid for in full.

6. Electronic signature. The parties agree to conduct this transaction electronically. Typed initials and a typed or drawn signature on this document have the same force and effect as handwritten ones.`

/** One initialled line as the row keeps it: the line's words as the customer read them, and the initials typed. */
export type InitialEntry = { line: string; initials: string }

/** Two to four letters, as initials are typed: "DW", "D.W." with the dots taken off, never a word. */
export const INITIALS_SHAPE = /^[A-Za-z]{2,4}$/

/** Initials as typed, with dots and spaces taken off and in capitals: "d.w." reads "DW". */
export function cleanInitials(raw: string): string {
  return raw.replace(/[.\s]/g, '').toUpperCase()
}

export const INITIAL_LINES_MAX = 12
export const INITIAL_LINE_MAX_CHARS = 400

/**
 * What the office's initial lines still need before the warranty goes: at least one line, no more than twelve, none
 * blank and none over 400 characters. Null when they are ready.
 */
export function initialLinesProblem(lines: readonly string[]): string | null {
  const kept = lines.map((l) => l.trim())
  if (kept.length === 0) return 'Add at least one line for them to initial.'
  if (kept.length > INITIAL_LINES_MAX) return `Keep it to ${INITIAL_LINES_MAX} lines to initial.`
  if (kept.some((l) => !l)) return 'A line to initial cannot be blank.'
  if (kept.some((l) => l.length > INITIAL_LINE_MAX_CHARS)) return `A line to initial holds at most ${INITIAL_LINE_MAX_CHARS} characters.`
  return null
}

/**
 * What the customer's initials still need before the signature counts: initials on every line, each two to four
 * letters. Null when every line is initialled. `typed` runs in the lines' order; a line with nothing typed is missing.
 */
export function initialsProblem(lines: readonly string[], typed: readonly string[]): string | null {
  if (lines.length === 0) return null
  const missing = lines.findIndex((_, i) => !cleanInitials(typed[i] ?? ''))
  if (missing >= 0) return lines.length === 1 ? 'Initial the line above to continue.' : `Initial every line to continue. Line ${missing + 1} is still blank.`
  const odd = lines.findIndex((_, i) => !INITIALS_SHAPE.test(cleanInitials(typed[i] ?? '')))
  if (odd >= 0) return `Initials are two to four letters. Line ${odd + 1} reads "${(typed[odd] ?? '').trim()}".`
  return null
}

/** The entries the row keeps once `initialsProblem` is null: each line with its cleaned initials. */
export function initialEntries(lines: readonly string[], typed: readonly string[]): InitialEntry[] {
  return lines.map((line, i) => ({ line: line.trim(), initials: cleanInitials(typed[i] ?? '') }))
}

/** The row's `initials` as kept, tolerant of an older or malformed value: an entry needs a line and initials with letters. */
export function parseInitials(raw: unknown): InitialEntry[] {
  if (!Array.isArray(raw)) return []
  const out: InitialEntry[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const line = typeof o.line === 'string' ? o.line.trim() : ''
    const initials = typeof o.initials === 'string' ? cleanInitials(o.initials) : ''
    if (line && initials) out.push({ line, initials })
  }
  return out
}

/** The office's initial lines as the row's `fields.initial_lines` keeps them: strings only, trimmed, blanks dropped. */
export function parseInitialLines(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : []
}
