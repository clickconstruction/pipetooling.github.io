/**
 * The customer portal's letterhead (v2.5229): whose company heads the page. A customer whose every job with us is a
 * GC job we build reads Click Construction; everyone else reads the plumbing company, as before. Pure: the function
 * (`customer-portal`) and the sample portal pick it, and vitest tests it (`src/lib/portal/portalLetterhead.test.ts`).
 */
import { GC_CUSTOMER_EMAIL_FROM_NAME } from './gcCustomerEmails.ts'
import { PORTAL_COMPANY } from './portalCompany.ts'

/** The page's company block: the name, the line under the CLICK. mark, and the letterhead's right side. */
export type PortalLetterhead = {
  name: string
  tagline: string
  cityLine: string
  licenseLine: string
  phone: string
  email: string
}

/** The plumbing company's line under the mark, as the page has always drawn it. */
export const PORTAL_TAGLINE = 'Plumbing, Electrical, and HVAC'

/**
 * Click Construction's block. Its name is the one every GC customer email bears (held to `GC_COMPANY.name` by a
 * test). The city and license lines stay blank until the owner names the GC entity and its address (call 12): the
 * plumbing company's lines never stand under the GC's name. The phone is the office's.
 */
export const PORTAL_GC_LETTERHEAD: PortalLetterhead = {
  name: GC_CUSTOMER_EMAIL_FROM_NAME,
  tagline: 'Construction',
  cityLine: '',
  licenseLine: '',
  phone: PORTAL_COMPANY.phone,
  email: '',
}

/**
 * Click Construction's block for a customer whose every job is a GC job we build: at least one GC project
 * (`loadGcPortalJobs`) and no Pipeline job but its billing job (`jobs_ledger.billing_only`). Mixed, none, or a link
 * with the `gc` audience (a GC we work for, which sees no GC jobs) reads the plumbing company. `plumbing` is the
 * plumbing block, `PORTAL_COMPANY` unless a sample passes its own.
 */
export function portalLetterhead(
  args: { audience: string; gcJobCount: number; jobs: ReadonlyArray<{ billing_only?: boolean | null }> },
  plumbing: Omit<PortalLetterhead, 'tagline'> = PORTAL_COMPANY,
): PortalLetterhead {
  const allGc = args.audience !== 'gc' && args.gcJobCount > 0 && args.jobs.every((j) => j.billing_only === true)
  return allGc ? PORTAL_GC_LETTERHEAD : { ...plumbing, tagline: PORTAL_TAGLINE }
}
