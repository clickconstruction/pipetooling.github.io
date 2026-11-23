import { formatWorkDateYmdMonthDayShort, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { partyPaperName } from '../contracts/paperParty'
import { plainSentence, val } from '../valuesInPlace'
import type { PartyRecordTable } from './paperPartyPick'

/**
 * A second signer at the same company (punch list #403, the owner's third decision of 2026-11-22). A company's paper is
 * filed under the company's own contact, so the same paper sent to a second person there used to land on the first
 * person's copy: their name was replaced and their link stopped. Now **Send a paper** says who already has the paper
 * out, and offers to send it to them again or to send a second copy to someone else. These are its pure parts: which
 * copies are out, and the words of the choice.
 */

/** The column of `contacts` that points at each kind of record a paper can be with. */
export const PARTY_CONTACT_COLUMN: Record<PartyRecordTable, string> = {
  customers: 'customer_id',
  customer_contact_persons: 'customer_contact_person_id',
  supply_houses: 'supply_house_id',
  supply_house_contacts: 'supply_house_contact_id',
}

/** A business's own contact carries no name. A person's contact is the one row that points at them. */
export function partyContactIsOwn(table: PartyRecordTable): boolean {
  return table === 'customers' || table === 'supply_houses'
}

/** A paper's row as far as this reads it. */
export type PartyPaperRow = { id: string; person_name: string; document_name: string; status: string; sent_at: string | null }

/**
 * The copies of one paper a party has out: sent and not signed, newest first. A copy that was made and never sent is
 * not out, and a signed one is done.
 */
export function partyPapersOut<T extends PartyPaperRow>(personDocuments: readonly T[], contactId: string | null | undefined, documentName: string): T[] {
  if (!contactId) return []
  const stored = partyPaperName(contactId)
  return personDocuments
    .filter((d) => d.person_name === stored && d.document_name === documentName && d.status === 'sent')
    .slice()
    .sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))
}

/** A copy that is out, with who it went to. */
export type PartyCopyOut = { docId: string; signerName: string; signerTitle: string; signerEmail: string; sentAt: string | null }

/** Who a copy went to, in a word or two: their name, else their address, else *someone*. */
export function copyOutWho(copy: Pick<PartyCopyOut, 'signerName' | 'signerEmail'>): string {
  return copy.signerName.trim() || copy.signerEmail.trim() || 'someone'
}

/** The day a copy went, as *Nov 20* in the company's time zone, or '' when the row keeps no time. */
export function copyOutSentDay(sentAt: string | null): string {
  if (!sentAt) return ''
  const ymd = calendarYmdInAppTzFromIso(sentAt)
  return ymd ? formatWorkDateYmdMonthDayShort(ymd) : ''
}

/**
 * *Lena Park already has this paper out, sent Nov 20.* One sentence a copy, with who and the day marked as values
 * (`val`), so the window draws them apart from the words (`ValueSentence`).
 */
export function copyOutSentence(copy: PartyCopyOut): string {
  const day = copyOutSentDay(copy.sentAt)
  return `${val('who', copyOutWho(copy))} already has this paper out${day ? `, sent ${val('day', day)}` : ''}.`
}

/** The same sentence as plain words. */
export function copyOutLine(copy: PartyCopyOut): string {
  return plainSentence(copyOutSentence(copy))
}

/** The window's title: the paper, and that it is already out with this company. */
export function copiesOutTitle(documentName: string): string {
  return `${documentName} is already out`
}

/** What the window says under its title: the company, then each copy. */
export function copiesOutLead(partyName: string, count: number): string {
  const who = partyName.trim() || 'This company'
  return count === 1 ? `${who} has one copy waiting on a signature.` : `${who} has ${count} copies waiting on a signature.`
}

/** *Send it to Lena Park again*: the press that sends the same copy again. */
export function sendAgainLabel(copy: Pick<PartyCopyOut, 'signerName' | 'signerEmail'>): string {
  return `Send it to ${copyOutWho(copy)} again`
}

/** What sending again does, under its press. */
export const SEND_AGAIN_HINT = 'They get a new signing link. The link sent before stops working.'

/** The press that makes a second copy for another person at the same company. */
export const SECOND_COPY_LABEL = 'Send a second copy to someone else'

/** What a second copy does, under its press. */
export const SECOND_COPY_HINT = 'The copy that is out stays as it is, with its own link. Each person signs their own.'
