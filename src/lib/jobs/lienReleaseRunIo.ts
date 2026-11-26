/**
 * The print and the writes behind the releases on the run (punch list #435, piece 5; the rule is `lienReleaseRun.ts`).
 *
 * **The print.** A saved release prints as it was saved: its `fields` are the paper, as on the Release of record tab
 * (`LienFilingTabs.tsx`). `releaseRunPaper` reads them back and refuses a row that does not hold a paper, which is
 * then printed from its own tab. `releaseRunPrintHtml` puts the ready ones in one print, a release a sheet
 * (`filingDocsPrintHtml`, as the affidavits print for the notary), each under the letterhead with its job and the
 * day. `releaseRunCopyHtml` is one release alone, the copy filed on its job (`lien_release_of_record`, the kind the
 * tab's own print files, and the kind Accounts Receivable reads a printed release from, `payoffReturnedIo.ts`).
 *
 * **The writes.** Each release is one update of its row's `fields` (`releaseFactsPatch`), every other field kept:
 * the paper is never touched. The rows are written one after another and the run keeps going past a row that fails:
 * every row comes back with whether it took and, when it did not, the reason.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { demandDate } from '../jobsDocuments/demandDate'
import { buildReleaseOfRecordBlocks, filingDocFooter, filingDocPrintHtml, filingDocsPrintHtml, type FilingDocExtras, type ReleaseOfRecordFields } from '../jobsDocuments/lienFilingDocuments'
import { releaseFactsPatch, type ReleaseFactsChange } from './lienReleaseFacts'
import { RELEASE_RUN_WORDS, type ReleaseRunLine } from './lienReleaseRun'

const PAPER_KEYS: ReadonlyArray<keyof ReleaseOfRecordFields> = ['county', 'claimantCompany', 'claimantPersonName', 'recordingNumber', 'filedDate', 'legalDescription', 'propertyAddress', 'ownerName', 'paymentDate']
/** What a release cannot print without: the claimant, the county and the instrument it releases. */
const PAPER_NEEDS: ReadonlyArray<keyof ReleaseOfRecordFields> = ['county', 'claimantCompany', 'recordingNumber']

export const RELEASE_RUN_PRINT_KIND = 'lien_release_of_record'
export const RELEASE_RUN_NO_PAPER = 'This release does not hold its paper. Print it from its own tab.'

/** The paper a saved release holds, or null when its row does not hold one. */
export function releaseRunPaper(fields: unknown): ReleaseOfRecordFields | null {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null
  const f = fields as Record<string, unknown>
  const paper = Object.fromEntries(PAPER_KEYS.map((k) => [k, typeof f[k] === 'string' ? (f[k] as string) : ''])) as ReleaseOfRecordFields
  return PAPER_NEEDS.every((k) => paper[k].trim()) ? paper : null
}

export type ReleaseRunPrintOpts = { letterhead: FilingDocExtras['letterhead']; todayYmd: string }

const extrasFor = (line: Pick<ReleaseRunLine, 'jobNumber'>, opts: ReleaseRunPrintOpts): FilingDocExtras => ({ letterhead: opts.letterhead, refItems: [`Job #${line.jobNumber}`, demandDate(opts.todayYmd)] })

export const releaseRunTitle = (line: Pick<ReleaseRunLine, 'jobNumber'>): string => `Release of Recorded Lien — Job ${line.jobNumber}`

/** One release alone, as the copy filed on its job. Null when the row holds no paper. */
export function releaseRunCopyHtml(line: Pick<ReleaseRunLine, 'jobNumber' | 'fields'>, opts: ReleaseRunPrintOpts): string | null {
  const paper = releaseRunPaper(line.fields)
  return paper ? filingDocPrintHtml(buildReleaseOfRecordBlocks(paper, extrasFor(line, opts)), releaseRunTitle(line), filingDocFooter('release_of_record')) : null
}

/** The releases that hold a paper, and the ones that do not. */
export function releaseRunPrintable<L extends Pick<ReleaseRunLine, 'fields'>>(lines: ReadonlyArray<L>): { printable: L[]; noPaper: L[] } {
  return { printable: lines.filter((l) => releaseRunPaper(l.fields)), noPaper: lines.filter((l) => !releaseRunPaper(l.fields)) }
}

/** Every release that holds a paper as one print, a release a sheet. Null with none. */
export function releaseRunPrintHtml(lines: ReadonlyArray<Pick<ReleaseRunLine, 'jobNumber' | 'fields'>>, opts: ReleaseRunPrintOpts): string | null {
  const papers = lines.flatMap((l) => {
    const paper = releaseRunPaper(l.fields)
    return paper ? [{ blocks: buildReleaseOfRecordBlocks(paper, extrasFor(l, opts)), footer: filingDocFooter('release_of_record') }] : []
  })
  return papers.length ? filingDocsPrintHtml(papers, papers.length === 1 ? 'Release of Recorded Lien' : `${papers.length} Releases of Recorded Lien`) : null
}

export type ReleaseFactsRow = { releaseId: string; fields: unknown }

export type ReleaseFactsOutcome = { releaseId: string; ok: boolean; why: string | null }

/** Keep one change on each release, past a row that fails. */
export async function keepReleaseFacts(rows: ReadonlyArray<ReleaseFactsRow>, change: ReleaseFactsChange): Promise<ReleaseFactsOutcome[]> {
  const out: ReleaseFactsOutcome[] = []
  for (const row of rows) {
    try {
      await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ fields: releaseFactsPatch(row.fields, change) } as never).eq('id', row.releaseId), 'lien releases: keep a release’s facts')
      out.push({ releaseId: row.releaseId, ok: true, why: null })
    } catch (e) {
      out.push({ releaseId: row.releaseId, ok: false, why: formatErrorMessage(e, RELEASE_RUN_WORDS.failed) })
    }
  }
  return out
}
