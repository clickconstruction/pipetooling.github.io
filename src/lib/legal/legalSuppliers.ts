/**
 * Supply houses on a Legal desk account (punch list #175, v2.5835). The Lien window has
 * carried **Supply houses on this job** since v2.4404, read from Materials → Held for
 * suppliers; the Legal desk showed nothing about a job's suppliers, so a case could list
 * "the supplier's balance" as still to find while the app held it. This kernel lines the
 * account's jobs up against that same read (`buildLienSupplierJobs`), in the account's
 * job order, keeping only the jobs that bought something, and words the section's
 * summary. Pure: no React, no supabase.
 */
import { lienSupplierMark, type LienSupplierJob } from '../jobs/lienJobSuppliers'
import { formatUsdNoCents } from '../jobs/jobFormatting'

export type LegalSupplierJobLike = {
  jobId: string
  jobLabel: string
  /** What the payer still owes us on the job — the card's verdict line compares it to the houses. */
  openBalance: number
  /** '' | 'residential' | 'non_residential', the job's own property record. */
  propertyKind: string
}

export type LegalSupplierJobLine = LegalSupplierJobLike & { suppliers: LienSupplierJob }

/** The account's jobs that bought from a supply house, in the account's order; a job with no invoices is left out. */
export function legalSupplierJobs(jobs: ReadonlyArray<LegalSupplierJobLike>, byJob: ReadonlyMap<string, LienSupplierJob>): LegalSupplierJobLine[] {
  const out: LegalSupplierJobLine[] = []
  for (const j of jobs) {
    const suppliers = byJob.get(j.jobId)
    if (!suppliers || suppliers.houses.length === 0) continue
    out.push({ ...j, suppliers })
  }
  return out
}

/**
 * One line over the section: *2 houses owed $13,058 on 891 · 1 house, all paid on 892*.
 * '' when no job bought anything.
 */
export function legalSuppliersSummaryWords(lines: ReadonlyArray<LegalSupplierJobLine>): string {
  return lines
    .map((l) => {
      const mark = lienSupplierMark(l.suppliers)
      const n = l.suppliers.houses.length
      const words = mark ? mark.words.replace(/ · job account$/, '') : `${n} ${n === 1 ? 'house' : 'houses'}, all paid`
      return `${words} on ${l.jobLabel}`
    })
    .join(' · ')
}

/** What the account's houses are still owed, across every job; 0 when nothing. */
export function legalSuppliersOwed(lines: ReadonlyArray<LegalSupplierJobLine>): number {
  return lines.reduce((s, l) => s + l.suppliers.owed, 0)
}

/** The gap line's words when a house is owed: *Supply houses are still owed $13,058 on these jobs.* */
export function legalSuppliersOwedWords(owed: number): string {
  return owed > 0.005 ? `Supply houses are still owed ${formatUsdNoCents(owed)} on these jobs.` : ''
}

export const LEGAL_SUPPLIERS_EMPTY_WORDS = 'No supply house sold materials on these jobs, by our books.'
export const LEGAL_SUPPLIERS_LOADING_WORDS = 'Reading the supplier books…'
/** The muted line under the section: where the figures come from, and why a paid account can still read owed. */
export const LEGAL_SUPPLIERS_NOTE = 'From Materials → Held for suppliers, the same books as the Lien window’s card. A payment the books never learned of still reads owed here until it is marked paid: Mark paid… on the house’s row writes the same check the Supply houses tab does. The house keeps its own calendar, so its notice day is our estimate unless the house told us.'
