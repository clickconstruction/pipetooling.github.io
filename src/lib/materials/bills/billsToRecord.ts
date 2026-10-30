/**
 * Supply-house bill capture (punch list #179 PR 3, v2.6095): the bills waiting to be recorded. A PDF or a picture on a
 * house's thread with our copy kept, that nobody has answered (recorded as a bill, or *Not a bill*) and that is not on
 * an invoice row, is a bill to record: the form's picker lists them under *Start from*, the house's row counts them
 * (*2 bills to record*), and the thread offers *Record this bill* under the line. Pure; the reads are
 * `billsToRecordIo.ts`'s.
 */
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { billMedia } from './billRead'
import { threadChip } from './billWords'

/** A `message_attachments` row with its line's contact, as the read brings it. */
export interface BillCandidateRow {
  id: string
  message_id: string
  name: string
  mime: string | null
  bucket_path: string | null
  kind: string
  paper_answer: string | null
  created_at: string
  /** The line, embedded; PostgREST hands one object, or a list for a to-many. */
  messages: { contact_id: string | null; at: string | null } | Array<{ contact_id: string | null; at: string | null }> | null
}

export interface BillCandidate {
  attachmentId: string
  houseId: string
  name: string
  mime: string | null
  /** The day the line came, YYYY-MM-DD. */
  dateYmd: string
  /** "S1183420.pdf · Oct 22, on the thread" */
  chip: string
}

const lineOf = (r: BillCandidateRow): { contact_id: string | null; at: string | null } | null => (Array.isArray(r.messages) ? r.messages[0] ?? null : r.messages)

/**
 * Which house each contact's lines come from: a house's own contact (its counter, or someone named on its row) by its
 * `supply_house_id`, and a rep's contact by the rep's house (v2.6136), as the thread's `houseOfContact` reads one. A
 * rep with no house names none.
 */
export function houseOfContacts(
  houseContacts: ReadonlyArray<{ id: string; supply_house_id: string | null }>,
  reps: ReadonlyArray<{ id: string; supply_house_id: string | null }>,
  repContacts: ReadonlyArray<{ id: string; supply_house_contact_id: string | null }>,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of houseContacts) if (c.supply_house_id) out.set(c.id, c.supply_house_id)
  const houseOfRep = new Map<string, string>()
  for (const r of reps) if (r.supply_house_id) houseOfRep.set(r.id, r.supply_house_id)
  for (const c of repContacts) {
    const house = c.supply_house_contact_id ? houseOfRep.get(c.supply_house_contact_id) : undefined
    if (house) out.set(c.id, house)
  }
  return out
}

/**
 * The rows that are bills to record, newest first: a PDF or a picture with our copy, unanswered, whose line's contact is
 * one of the houses asked for, and not on an invoice row.
 */
export function billCandidates(rows: readonly BillCandidateRow[], houseOfContact: ReadonlyMap<string, string>, onRow: ReadonlySet<string>): BillCandidate[] {
  const out: BillCandidate[] = []
  for (const r of rows) {
    if (r.kind === 'link' || !r.bucket_path || r.paper_answer || onRow.has(r.id)) continue
    if (!billMedia(r.mime, r.name)) continue
    const line = lineOf(r)
    const houseId = line?.contact_id ? houseOfContact.get(line.contact_id) : undefined
    if (!houseId) continue
    const iso = line?.at ?? r.created_at
    let dateYmd = ''
    try {
      dateYmd = calendarYmdInAppTzFromIso(iso)
    } catch {
      dateYmd = ''
    }
    out.push({ attachmentId: r.id, houseId, name: r.name, mime: r.mime, dateYmd, chip: threadChip(r.name, dateYmd) })
  }
  out.sort((a, b) => b.dateYmd.localeCompare(a.dateYmd) || a.name.localeCompare(b.name))
  return out
}

/** How many wait at each house. */
export function billCountsByHouse(candidates: readonly BillCandidate[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of candidates) out.set(c.houseId, (out.get(c.houseId) ?? 0) + 1)
  return out
}

/** The ones at one house, in the picker's order. */
export function billsForHouse(candidates: readonly BillCandidate[], houseId: string): BillCandidate[] {
  return candidates.filter((c) => c.houseId === houseId)
}
