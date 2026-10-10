/**
 * A trade partner company's paper (GC mode, the Board's B6-b-i): a `person_contract_documents` row keyed to the
 * company (`company_id`), under a name no person can have. The database holds the shape both ways
 * (`person_contract_documents_company_paper`); this is the one place the app and the functions build or read the
 * name. Dependency-free: the app imports it straight from here.
 */

/** The start of a company's stored name: `gc-company:<company id>`. */
export const COMPANY_PAPER_PREFIX = 'gc-company:'

/** A company's stored name on its papers. */
export function companyPaperName(companyId: string): string {
  return `${COMPANY_PAPER_PREFIX}${companyId}`
}

/** True for a company's paper: its stored name starts with the prefix (the database keeps the company with it). */
export function isCompanyPaperName(name: string | null | undefined): boolean {
  return (name ?? '').startsWith(COMPANY_PAPER_PREFIX)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The company a stored name is for. Null for a person's name, or a stored name that is not well formed. */
export function companyIdFromPaperName(name: string | null | undefined): string | null {
  if (!isCompanyPaperName(name)) return null
  const id = (name ?? '').slice(COMPANY_PAPER_PREFIX.length)
  return UUID.test(id) ? id : null
}

/** Who a paper is for, in words: the person's name, or the company's for a company's paper ("a trade partner company" when unknown). */
export function paperForName(personName: string, companyName?: string | null): string {
  if (!isCompanyPaperName(personName)) return personName
  const name = (companyName ?? '').trim()
  return name === '' ? 'a trade partner company' : name
}
