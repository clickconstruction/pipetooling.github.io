/**
 * The business-records affidavit (punch list #220, v2.6213, PR 6): the preset the firm asks for on every account that
 * reaches suit, so our invoices, the clock and the job thread go into evidence without calling anyone to testify.
 * Tex. R. Evid. 902(10): a record that meets Rule 803(6) or (7) is self-authenticating when an affidavit in the form
 * of subparagraph (B) rides with it and both are served on each other party at least 14 days before trial
 * (subparagraph (A)). The form is quoted from the Supreme Court's order of August 19, 2014 (Misc. Docket No.
 * 14-9174), effective for cases filed on or after September 1, 2014. Pure.
 */
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'

/** Rule 902(10)(B)'s preface, word for word. */
export const BUSINESS_RECORDS_PREFACE = 'An affidavit is sufficient if it includes the following language, but this form is not exclusive. The proponent may use an unsworn declaration made under penalty of perjury in place of an affidavit.'

/** Rule 902(10)(B)'s six paragraphs, word for word, the blanks and the bracketed alternatives as the rule prints them. */
export const BUSINESS_RECORDS_FORM: ReadonlyArray<string> = [
  'I am the custodian of records [or I am an employee or owner] of __________ and am familiar with the manner in which its records are created and maintained by virtue of my duties and responsibilities.',
  'Attached are ____ pages of records. These are the original records or exact duplicates of the original records.',
  'The records were made at or near the time of each act, event, condition, opinion, or diagnosis set forth. [or It is the regular practice of __________ to make this type of record at or near the time of each act, event, condition, opinion, or diagnosis set forth in the record.]',
  'The records were made by, or from information transmitted by, persons with knowledge of the matters set forth. [or It is the regular practice of __________ for this type of record to be made by, or from information transmitted by, persons with knowledge of the matters set forth in them.]',
  'The records were kept in the course of regularly conducted business activity. [or It is the regular practice of __________ to keep this type of record in the course of regularly conducted business activity.]',
  'It is the regular practice of the business activity to make the records.',
]

/** Rule 902(10)(A), the one line the office must not forget: the record and the affidavit go to each other party fourteen days before trial. */
export const BUSINESS_RECORDS_SERVICE_WORDS = 'The firm serves the records and this affidavit on each other party at least 14 days before trial. The rule asks for it.'

export type BusinessRecordsInput = {
  /** The company whose records they are. */
  company?: string
  /** The page count typed when known; null leaves the blank for the hand. */
  pages: number | null
  /** The Evidence rows attached, by title, named after paragraph 2 so the paper says what it carries. */
  records: ReadonlyArray<string>
  /** The affiant is the custodian (an office person) or an employee or owner; the paper says which. */
  standing: 'custodian' | 'employee' | 'owner'
}

/** The standing's words in paragraph 1. */
export function businessRecordsStandingWords(standing: BusinessRecordsInput['standing']): string {
  return standing === 'custodian' ? 'the custodian of records' : standing === 'owner' ? 'an owner' : 'an employee'
}

/**
 * The paragraphs the window writes into the statement: the rule's six with the company filled in and the plain
 * reading of each (the bracketed alternatives are for a business that keeps records another way), and after
 * paragraph 2 one more naming the records attached, since the form is not exclusive and the firm should not guess.
 */
export function businessRecordsParagraphs(input: BusinessRecordsInput): string[] {
  const company = (input.company ?? PORTAL_COMPANY.name).trim() || PORTAL_COMPANY.name
  const pages = input.pages != null && input.pages > 0 ? String(input.pages) : '____'
  const records = input.records.map((r) => r.trim()).filter(Boolean)
  const out = [
    `I am ${businessRecordsStandingWords(input.standing)} of ${company} and am familiar with the manner in which its records are created and maintained by virtue of my duties and responsibilities.`,
    `Attached are ${pages} pages of records. These are the original records or exact duplicates of the original records.`,
  ]
  if (records.length) out.push(`The records attached are: ${records.join('; ')}.`)
  out.push(
    'The records were made at or near the time of each act, event, condition, opinion, or diagnosis set forth.',
    'The records were made by, or from information transmitted by, persons with knowledge of the matters set forth.',
    'The records were kept in the course of regularly conducted business activity.',
    'It is the regular practice of the business activity to make the records.',
  )
  return out
}

/** The statement's body as the window holds it: one paragraph per line. */
export function businessRecordsBody(input: BusinessRecordsInput): string {
  return businessRecordsParagraphs(input).join('\n')
}

/** *Business Records Affidavit of Grace Lee* · *Business Records Declaration of …*. */
export function businessRecordsTitle(affiantName: string, form: 'notary' | 'declaration'): string {
  const name = affiantName.trim()
  const noun = form === 'notary' ? 'Affidavit' : 'Declaration'
  return name ? `Business Records ${noun} of ${name}` : `Business Records ${noun}`
}

/** The role line for the custodian: *custodian of records for Click Plumbing and Electrical*. */
export function businessRecordsRole(standing: BusinessRecordsInput['standing'], company = PORTAL_COMPANY.name): string {
  return standing === 'custodian' ? `custodian of records for ${company}` : standing === 'owner' ? `an owner of ${company}` : `an employee of ${company}`
}
