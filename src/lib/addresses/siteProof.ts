/**
 * The proof for a site's client (punch list #439, piece 5, part 5a): the list of everyone bound. The client must be
 * shown who signed, so the packet names each outside company that signed a paper for the site, with who signed and
 * the day, then each company that was asked and has not signed. Our own people are counted, never named.
 *
 * It reads the rows **Papers for this site** already reads (`sitePapers.ts`): nothing new is asked of the database
 * for the companies. The count of our own people is the site's secrecy (piece 4), read when the packet opens.
 *
 * Part 5a is the list, looked at and printed. **Download** (part 5b, `siteProofPdf.ts`) is the list and the signed
 * copies as one PDF. **Send to the client** and the client's own page are later parts.
 *
 * Pure: no React, no supabase.
 */
import { pluralNoun } from '../batchWords'
import { replacedPaperIds, type PartyPaperRow } from '../contracts/partyPapers'
import { shortDay } from '../jobs/jobPapers'
import { val } from '../valuesInPlace'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { rowIsInSiteScope, type SiteScope } from './sitePapers'

/** One company's paper on the packet. */
export type ProofLine = {
  id: string
  /** The company the paper is with, as the paper keeps its name. */
  company: string
  /** The paper's own name. */
  paper: string
  /** *Lena Park, Branch manager*: who signed, or who was asked. '' when the paper kept no name. */
  signer: string
  /** *Nov 20*: the day it was signed, or the day it was sent. '' with no day. */
  day: string
}

/** The packet's list: the signed, the oldest first as a client reads a record, then the asked, the longest wait first. */
export type SiteProof = { signed: ProofLine[]; asked: ProofLine[] }

const signerWords = (row: PartyPaperRow): string => {
  const name = (row.signer_printed_name ?? '').trim() || (row.signer_name ?? '').trim()
  const title = (row.signer_title ?? '').trim()
  return name && title ? `${name}, ${title}` : name
}

/**
 * The packet's list for a site. A paper a newer one replaced is left out, and so is one that was made and never
 * sent: nobody was asked. A paper filed as received counts as signed.
 */
export function siteProof(rows: ReadonlyArray<PartyPaperRow>, scope: SiteScope): SiteProof {
  const replaced = replacedPaperIds(rows)
  const seen = new Set<string>()
  const signed: Array<ProofLine & { at: string }> = []
  const asked: Array<ProofLine & { at: string }> = []
  for (const row of rows) {
    if (!row.id || seen.has(row.id) || replaced.has(row.id)) continue
    if (row.party_contact_id == null || !rowIsInSiteScope(row, scope)) continue
    seen.add(row.id)
    const base = {
      id: row.id,
      company: (row.party_name ?? '').trim() || (row.signing_for ?? '').trim() || 'A company',
      paper: (row.document_name ?? '').trim() || 'A paper',
      signer: signerWords(row),
    }
    if (row.status === 'signed' || row.status === 'received') {
      const ymd = row.signed_at ? row.signed_at.slice(0, 10) : ''
      signed.push({ ...base, day: shortDay(ymd || null), at: ymd })
    } else if (row.status === 'sent') {
      const ymd = row.sent_at ? calendarYmdInAppTzFromIso(row.sent_at) : ''
      asked.push({ ...base, day: shortDay(ymd || null), at: ymd })
    }
  }
  const byDay = (a: { at: string; company: string; id: string }, b: { at: string; company: string; id: string }) =>
    a.at.localeCompare(b.at) || a.company.localeCompare(b.company) || a.id.localeCompare(b.id)
  const strip = ({ at: _at, ...line }: ProofLine & { at: string }): ProofLine => line
  return { signed: signed.sort(byDay).map(strip), asked: asked.sort(byDay).map(strip) }
}

/** The block is drawn once a company has signed or been asked. A site nobody was asked for has nothing to prove yet. */
export function proofDraws(proof: SiteProof): boolean {
  return proof.signed.length + proof.asked.length > 0
}

/** The companies on a list, each once: two papers of one company are one company bound. */
export function proofCompanies(lines: ReadonlyArray<ProofLine>): number {
  return new Set(lines.map((l) => l.company.toLowerCase())).size
}

/** The block's heading and the packet's: the client by name when the page knows it. */
export function proofHeading(clientName: string | null | undefined): string {
  const client = (clientName ?? '').trim()
  return client ? `The proof for ${client}` : 'The proof for this site’s client'
}

/** The block's one line: how many companies signed and how many were asked, each count a value. */
export function proofCountSentence(proof: SiteProof): string {
  const signed = proofCompanies(proof.signed)
  const asked = proofCompanies(proof.asked)
  const first = `${val('count', String(signed))} ${pluralNoun(['company', 'companies'], signed)} signed.`
  return asked > 0 ? `${first} ${val('count', String(asked))} asked, not yet signed.` : first
}

/** What the packet knows of our own people, read from the site's secrecy when the packet opens. */
export type ProofOwnPeople =
  /** Secrecy is off for the site, or the database has none yet: our own people are not asked, and the packet says nothing. */
  | { kind: 'not-asked' }
  /** Secrecy is on and both counts were read. */
  | { kind: 'counted'; signed: number; asked: number }
  /** Secrecy is on and a count could not be read. The packet says so, and guesses nothing. */
  | { kind: 'unread' }

/** The packet's words about our own people, or null when they are not asked. Workers are counted, not named. */
export function ownPeopleWords(own: ProofOwnPeople): string | null {
  if (own.kind === 'not-asked') return null
  if (own.kind === 'unread') return 'Our own people sign before a job at this site opens to them. Their count could not be read just now.'
  return `${own.signed} of ${own.asked} have signed. A job at this site stays shut to a person until they sign. Workers are counted, not named.`
}

/** Every word of the block and the packet. */
export const SITE_PROOF_WORDS = {
  /** Under the count: what the packet is, and what it is not yet. */
  lead: 'A list of every company that signed a paper for this site, to show the client.',
  make: 'Make the packet',
  /** The packet window's name, and its two presses. */
  windowLabel: 'The packet, as it prints',
  print: 'Print',
  close: 'Close',
  signed: 'Signed',
  asked: 'Asked, not yet signed',
  ownPeople: 'Our own people',
  nobodySigned: 'No company has signed yet.',
  columns: { company: 'Company', signer: 'Signed by', askedOf: 'Sent to', paper: 'Paper', signedDay: 'Signed', sentDay: 'Sent' },
  /** Under the packet on the screen, never on paper: where the signed copies come from. */
  downloadAdds: 'This is the list. Download adds the signed copies.',
} as const

/** The packet's foot: *As of Nov 27.* The day is the company's own. */
export function asOfWords(todayYmd: string): string {
  const day = shortDay(todayYmd)
  return day ? `As of ${day}.` : ''
}

/** Who may look at the packet and print it: whoever reads the site's papers. Sending it is part 5b's. */
export { canReadPartyPapers as canMakeProof } from '../contracts/partyPapers'
