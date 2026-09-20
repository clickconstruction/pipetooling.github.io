/**
 * Signing it on paper, PR 4 (v2.3642): the two things the pane used to call "terms", told apart.
 * **This job** — scope, amount and the payment line — belongs to one agreement. **Standard terms**
 * — the numbered legal paragraphs — are one Contract Book document every agreement sent afterwards
 * carries. Pure labels and rules; the modal and the pane do the I/O.
 */
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export type StandardTermsDoc = {
  id: string
  document_name: string
  book_body_html: string | null
  book_body_format: string
  book_version_date: string | null
}

/** "Service agreement · v. Sep 20" — the built-in wording has no version, and says so. */
export function standardTermsLabel(doc: Pick<StandardTermsDoc, 'document_name' | 'book_version_date'> | null): string {
  if (!doc) return 'Built-in service agreement terms'
  const v = doc.book_version_date ? formatWorkDateYmdMonthDayShort(doc.book_version_date) : ''
  return v ? `${doc.document_name} · v. ${v}` : doc.document_name
}

/** What an edit reaches, said out loud before the office types a word. */
export function standardTermsReachLine(openJobs: number): string {
  const keep = 'Agreements already sent or signed keep the wording they went out with.'
  // Opened from one job's Contract window there is no sweep to count.
  if (openJobs <= 0) return `This wording goes on every agreement sent from now on, not only this job's. ${keep}`
  const jobs = openJobs === 1 ? 'the 1 job' : `all ${openJobs} jobs`
  return `This wording goes on every agreement sent from now on — ${jobs} still waiting in this sweep included. ${keep}`
}

/** Why the edit cannot be saved, or null when it can. */
export function standardTermsSaveBlocker(input: { name: string; body: string; originalBody: string; originalName: string }): string | null {
  if (!input.name.trim()) return 'The document needs a name.'
  if (!input.body.trim()) return 'The terms cannot be blank — every agreement prints them.'
  if (input.body === input.originalBody && input.name.trim() === input.originalName.trim()) return 'Nothing changed yet.'
  return null
}
