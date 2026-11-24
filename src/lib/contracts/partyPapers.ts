/**
 * The party's own page (punch list #403, step 4): which papers belong to a customer or a supply house, and what each
 * one's line says there.
 *
 * A paper is with a party when its `party_contact_id` names a contact of that party. For a customer that is the
 * customer's own contact or the contact of a person at that customer. For a supply house it is the house's own contact
 * or the contact of one of its reps, a rep who was archived among them, since their paper is still the house's.
 *
 * The page lists every kind of paper, a W-9 and a certificate among them, and every state, a paper that was made and
 * never sent among them. `agreements_on_file` lists agreements that were sent, so the page reads the papers' own table
 * and each table's own row security answers: the office's four roles read every paper, and an estimator reads an
 * outside company's (`paper_is_outside_company`).
 *
 * Pure: no React, no supabase. The reads are `partyPapersIo.ts`; the list is `components/contracts/PartyPapers.tsx`.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { pluralNoun } from '../batchWords'
import { emptyWords, type EmptyWords } from '../emptyWords'
import { val } from '../valuesInPlace'
import { paperSignerLine, signingForBeside } from './paperParty'

// ── Who reads the list ────────────────────────────────────────────────────────────────────────────────────────────────

/** The office's four roles, who send a paper and read every one. */
export function canSendPartyPapers(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

/** Who a party's papers are listed for: the four roles and the estimator (the owner's call 4). */
export function canReadPartyPapers(role: string | null | undefined): boolean {
  return canSendPartyPapers(role) || role === 'estimator'
}

/**
 * Who opens a signed paper's record from its line: the four roles, and an estimator who is not in training (punch
 * list #403, the owner's second decision of 2026-11-22). A training estimator reads the line and opens nothing: the
 * record's form answers, its signature and its signed file are all closed to them, so the line carries no press.
 */
export function canOpenSignedRecord(role: string | null | undefined, readOnly: boolean): boolean {
  if (canSendPartyPapers(role)) return true
  return role === 'estimator' && !readOnly
}

// ── Which papers are a party's ────────────────────────────────────────────────────────────────────────────────────────

/** The record a page is for. */
export type PartyRecord = { kind: 'customer' | 'supply_house'; id: string }

/** The columns of a contact that say which record it is. */
export type PartyContactRow = {
  id: string
  customer_id: string | null
  customer_contact_person_id: string | null
  supply_house_id: string | null
  supply_house_contact_id: string | null
}

/**
 * Whether a contact is one of a party's: the party's own contact, or the contact of one of its people. `peopleIds` are
 * the people at the customer (`customer_contact_persons`) or the reps of the house (`supply_house_contacts`).
 */
export function contactIsOfParty(contact: PartyContactRow, party: PartyRecord, peopleIds: ReadonlySet<string>): boolean {
  if (!party.id) return false
  if (party.kind === 'customer') {
    return contact.customer_id === party.id || (contact.customer_contact_person_id != null && peopleIds.has(contact.customer_contact_person_id))
  }
  return contact.supply_house_id === party.id || (contact.supply_house_contact_id != null && peopleIds.has(contact.supply_house_contact_id))
}

/** The contacts that are a party's, each once, in the order given. */
export function partyContactIds(party: PartyRecord, peopleIds: ReadonlyArray<string>, contacts: ReadonlyArray<PartyContactRow>): string[] {
  const people = new Set(peopleIds)
  const out: string[] = []
  for (const c of contacts) {
    if (c.id && !out.includes(c.id) && contactIsOfParty(c, party, people)) out.push(c.id)
  }
  return out
}

/** One paper, as the page reads it from `person_contract_documents`. */
export type PartyPaperRow = {
  id: string
  document_name: string | null
  doc_type: string | null
  status: string | null
  party_contact_id: string | null
  signer_name: string | null
  signer_title: string | null
  signer_printed_name: string | null
  /** The business the paper says the signer signs for, in words. */
  signing_for?: string | null
  /** A date, `YYYY-MM-DD`. */
  signed_at: string | null
  sent_at: string | null
  created_at: string | null
  signer_last_viewed_at: string | null
  supersedes_person_contract_document_id: string | null
}

/** The moment a paper sorts on: the day it was signed, the moment it was sent, or the moment it was made. */
function happened(row: PartyPaperRow): string {
  if (row.status === 'signed' && row.signed_at) return `${row.signed_at.slice(0, 10)}T12:00:00`
  return row.sent_at ?? row.created_at ?? ''
}

/** The papers that are with one of a party's contacts, each once, newest first. A paper with no party is never one. */
export function papersOfParty(rows: ReadonlyArray<PartyPaperRow>, contactIds: ReadonlyArray<string>): PartyPaperRow[] {
  const mine = new Set(contactIds)
  const seen = new Set<string>()
  const out: PartyPaperRow[] = []
  for (const r of rows) {
    if (!r.id || seen.has(r.id)) continue
    if (r.party_contact_id == null || !mine.has(r.party_contact_id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out.sort((a, b) => happened(b).localeCompare(happened(a)) || b.id.localeCompare(a.id))
}

/** The papers a newer one took the place of: the ids some other row of the list supersedes. */
export function replacedPaperIds(rows: ReadonlyArray<PartyPaperRow>): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    if (r.supersedes_person_contract_document_id) out.add(r.supersedes_person_contract_document_id)
  }
  return out
}

// ── What a line says ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Where a paper stands: made and never sent, out to be signed, signed, or replaced by a newer one. */
export type PartyPaperTone = 'unsent' | 'waiting' | 'signed' | 'ended'

/** A state chip's pair per tone, theme tokens only. The three the Agreements tab has, and a quiet one for *not sent*. */
export const PARTY_PAPER_TONE_COLORS: Readonly<Record<PartyPaperTone, { background: string; color: string }>> = {
  unsent: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
  waiting: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  signed: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  ended: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
}

/** The kind of paper in a word or two, for the line's tag. A kind the kernel does not know reads *Paper*. */
export function partyPaperKindWords(docType: string | null | undefined): string {
  switch ((docType ?? '').trim()) {
    case 'agreement':
      return 'Agreement'
    case 'w9':
      return 'W-9'
    case 'coi':
      return 'Insurance certificate'
    case 'license':
      return 'License'
    default:
      return 'Paper'
  }
}

export type PartyPaperLine = {
  id: string
  /** The kind, for the tag. */
  kind: string
  /** The paper's own name, else its kind. */
  name: string
  state: { words: string; tone: PartyPaperTone }
  /** *Lena Park signs, Branch manager*, then *signed by Lena Park, Branch manager*. '' when the paper kept no signer. */
  signer: string
  /**
   * *signing for Haddad Engineering*: the business the paper names, when it is not the party whose page this is. ''
   * when the paper kept none or names this party.
   */
  signingFor: string
  /** *Signed ⟪day|Nov 20⟫*, *Sent …*, *Made …*, the day marked with `val`. '' with no day. */
  day: string
  /** Whether a press opens its signed record. Only a signed paper has one. */
  opens: boolean
}

function ymdWords(ymd: string, todayYmd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? formatWorkDateYmdMonthDayShort(ymd) : formatWorkDateYmdFriendly(ymd)
}

/**
 * One paper's line. The state's words are the Agreements tab's own for a paper that waits or is signed
 * (`agreementStateChip`), so a line here and its line there never disagree. A paper that was made and never sent reads
 * *not sent*, which the tab has no line for. `todayYmd` is the company's day. `partyName` is the name of the party whose
 * page this is, today: a paper that names another business says so.
 */
export function partyPaperLine(row: PartyPaperRow, replaced: ReadonlySet<string>, todayYmd: string, partyName?: string | null): PartyPaperLine {
  const kind = partyPaperKindWords(row.doc_type)
  const signed = row.status === 'signed' || row.status === 'received'
  const sent = row.status === 'sent'
  let state: PartyPaperLine['state']
  if (replaced.has(row.id)) state = { words: 'replaced by a newer one', tone: 'ended' }
  else if (row.status === 'received') state = { words: 'received ✓', tone: 'signed' }
  else if (signed) state = { words: 'signed ✓', tone: 'signed' }
  else if (sent) state = { words: row.signer_last_viewed_at != null ? 'viewed, not signed' : 'never opened', tone: 'waiting' }
  else state = { words: 'not sent', tone: 'unsent' }

  let day = ''
  if (signed && row.signed_at) {
    const words = ymdWords(row.signed_at.slice(0, 10), todayYmd)
    day = words ? `Signed ${val('day', words)}` : ''
  } else if (sent && row.sent_at) {
    const words = ymdWords(calendarYmdInAppTzFromIso(row.sent_at), todayYmd)
    day = words ? `Sent ${val('day', words)}` : ''
  } else if (!signed && !sent && row.created_at) {
    const words = ymdWords(calendarYmdInAppTzFromIso(row.created_at), todayYmd)
    day = words ? `Made ${val('day', words)}` : ''
  }

  return {
    id: row.id,
    kind,
    name: (row.document_name ?? '').trim() || kind,
    state,
    signer: paperSignerLine({ name: row.signer_name, title: row.signer_title, printedName: row.signer_printed_name }, row.status === 'signed'),
    // With no party name to hold it against, the line says nothing: it never names the page's own party as another's.
    signingFor: partyName?.trim() ? signingForBeside(row.signing_for, [partyName, row.signer_name, row.signer_printed_name]) : '',
    day,
    opens: row.status === 'signed',
  }
}

/** The lines of a party's papers, newest first, from the rows the read answered. */
export function partyPaperLines(rows: ReadonlyArray<PartyPaperRow>, contactIds: ReadonlyArray<string>, todayYmd: string, partyName?: string | null): PartyPaperLine[] {
  const mine = papersOfParty(rows, contactIds)
  const replaced = replacedPaperIds(mine)
  return mine.map((r) => partyPaperLine(r, replaced, todayYmd, partyName))
}

/** *⟪count|1⟫ paper*, *⟪count|3⟫ papers*, the count marked with `val`. */
export function partyPaperCountWords(n: number): string {
  return `${val('count', String(n))} ${pluralNoun('paper', n)}`
}

// ── The empty list ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Where a paper is sent from: Documents → Agreements, and its **Send a paper** press. */
export const PARTY_PAPERS_SEND_PAGE = { label: 'Agreements', to: '/documents?tab=agreements', tail: 'is where Send a paper sends one.' } as const

/** What an empty list says to someone who reads and does not send. */
export const PARTY_PAPERS_READER_TAIL = 'The office sends one from Documents.'

/**
 * The empty list's words. The office reads the page that fills it, with the press. An estimator reads that the office
 * sends one, and gets no press, since sending is the four roles'.
 */
export function partyPapersEmptyWords(canSend: boolean): EmptyWords {
  if (canSend) return emptyWords({ kind: 'data', noun: 'papers', page: { label: PARTY_PAPERS_SEND_PAGE.label, tail: PARTY_PAPERS_SEND_PAGE.tail } })
  return { main: emptyWords({ kind: 'data', noun: 'papers', page: { label: '' } }).main, next: '', tail: PARTY_PAPERS_READER_TAIL }
}
