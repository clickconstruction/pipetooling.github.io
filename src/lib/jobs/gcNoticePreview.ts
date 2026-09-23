import { buildLienNoticeBlocks, filingLetterheadFromIssuer, type FilingDocBlock, type FilingDocExtras, type LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import { demandDate, demandMoney } from '../jobsDocuments/demandLetter'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { fillCoverLetter, type GcNoticeJob, affidavitMonthWord, type CoverLetterKind } from './gcOnNotice'
import { runCoverNoteBlocks } from './lienDeskRun'
import { buildLienNoticeFieldsForJob, describeNoticeMonths, lienNoticeCoverNote } from './lienNoticeDraft'
import { payPageBlocks, type PayPageAssets, type PayPageCopy, type PayPageRow } from './lienNoticePayPage'

/**
 * Put a GC on notice — reading a notice before it is approved (v2.3668).
 *
 * The run writes ONE notice per job, naming all of that job's months, and
 * mails two copies: the owner's (a cover page, then the § 53.056 form) and the
 * original contractor's (the form only). This builds those pages from the
 * window's live state with the same builders the desk and the run print from
 * (`buildLienNoticeFieldsForJob`, `runCoverNoteBlocks`, `buildLienNoticeBlocks`),
 * so what is read is what `approveAll` will save. Pure; the HTML is the caller's.
 */

export type GcNoticePreviewCopy = 'owner' | 'original_contractor'

export type GcNoticePreviewInput = {
  job: Pick<GcNoticeJob, 'jobId' | 'claimAmount' | 'months' | 'isBilled'>
  /** "273 · Dudley (Lennox)" */
  label: string
  jobNumber: string
  jobName: string | null | undefined
  jobAddress: string | null | undefined
  gcName: string
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
  /** Step 3, as it stands now: the letter's template and whether it is ticked. */
  includeLetter: boolean
  letter: string
  /** Print the § 53.254(g) statement under the form (v2.3744). */
  homesteadStatement?: boolean
  /** The letter's fills (v2.3745): the stale-month footnote, the phone to call, and which letter this property gets. */
  staleNote?: string
  phone?: string
  letterKind?: CoverLetterKind
  /** The pay page's rows and codes (punch list #35, PR 3), when the job has unpaid bills — page 3 of the owner's copy. */
  pay?: { rows: readonly PayPageRow[]; assets: PayPageAssets }
}

export type GcNoticePreviewPage = { key: 'cover' | 'notice' | 'pay'; label: string; blocks: FilingDocBlock[] }

export type GcNoticePreview = {
  fields: LienNoticeFields
  /** Which cover the owner's copy carries: the run's letter, or the standard note when the letter is unticked or empty. */
  cover: 'letter' | 'note'
  pages: Record<GcNoticePreviewCopy, GcNoticePreviewPage[]>
}

export function buildGcNoticePreview(input: GcNoticePreviewInput): GcNoticePreview {
  const months = input.job.months.map((m) => m.key)
  const fields = buildLienNoticeFieldsForJob({
    jobName: input.jobName,
    jobAddress: input.jobAddress,
    originalContractorName: input.gcName,
    openBalance: input.job.claimAmount,
    contactPerson: input.contactPerson,
    issuer: input.issuer,
    todayYmd: input.todayYmd,
    homesteadStatement: input.homesteadStatement,
  })
  const extras: FilingDocExtras = {
    letterhead: filingLetterheadFromIssuer(input.issuer),
    refItems: [`Job #${input.jobNumber}`, months.length ? `Work months ${describeNoticeMonths(months)}` : '', demandDate(input.todayYmd)].filter(Boolean),
  }
  const useLetter = input.includeLetter && input.letter.trim().length > 0
  const coverBlocks = runCoverNoteBlocks({
    label: input.label,
    months,
    fields,
    extras,
    coverNote: useLetter ? null : lienNoticeCoverNote(fields.claimantName, months),
    coverLetter: useLetter ? fillCoverLetter(input.letter.trim(), { property: (input.jobAddress ?? '').trim(), months: describeNoticeMonths(months), job: input.jobNumber, amount: demandMoney(fields.claimAmount), staleNote: input.staleNote ?? '', contact: fields.contactPerson, phone: (input.phone ?? '').trim(), affidavitMonth: affidavitMonthWord(input.letterKind ?? 'commercial') }) : null,
  })
  const copyBlocks = (who: string) => buildLienNoticeBlocks(fields, { ...extras, refItems: [...(extras.refItems ?? []), `Copy for: ${who}`] })
  // The pay page, as the run prints it behind this copy (empty for a copy it does not go to, or with nothing to pay).
  const payPages = (copy: PayPageCopy, who: string): GcNoticePreviewPage[] => {
    if (!input.pay || input.pay.rows.length === 0) return []
    const blocks = payPageBlocks({
      rows: input.pay.rows,
      assets: input.pay.assets,
      copy,
      copyLabel: who,
      gcName: input.gcName,
      claimantName: fields.claimantName,
      contactPerson: fields.contactPerson,
      phone: (input.phone ?? '').trim(),
      extras,
    })
    return blocks.length ? [{ key: 'pay', label: 'pay codes', blocks }] : []
  }
  const ownerPages: GcNoticePreviewPage[] = [
    ...(coverBlocks.length ? [{ key: 'cover' as const, label: useLetter ? 'cover letter' : 'cover note', blocks: coverBlocks }] : []),
    { key: 'notice' as const, label: 'the notice', blocks: copyBlocks('owner of record') },
    ...payPages('owner', 'owner of record'),
  ]
  return {
    fields,
    cover: useLetter ? 'letter' : 'note',
    pages: {
      owner: ownerPages,
      original_contractor: [{ key: 'notice', label: 'the notice', blocks: copyBlocks('original contractor') }, ...payPages('original_contractor', 'original contractor')],
    },
  }
}

/** The line under the copy toggle: what this copy carries, in order. */
export function gcNoticeCopyLine(copy: GcNoticePreviewCopy, preview: Pick<GcNoticePreview, 'cover' | 'pages'>, isBilled: boolean): string {
  const hasPay = preview.pages[copy].some((pg) => pg.key === 'pay')
  if (copy === 'owner') {
    return `${preview.cover === 'letter' ? 'The cover letter' : 'The standard cover note'}, then the notice${hasPay ? ', then the pay codes' : ''}${isBilled ? ` — the unpaid ${hasPay ? 'invoices follow' : 'invoice follows'} in the packet` : ''}`
  }
  return hasPay ? 'The statutory form, then the pay codes' : "The GC's copy carries the statutory form only"
}

/** The rows a notice will be written for — a public owner has none, nor does a job with nothing left to name. */
export function gcNoticePreviewableJobs<T extends Pick<GcNoticeJob, 'readiness' | 'months'>>(jobs: ReadonlyArray<T>): T[] {
  return jobs.filter((j) => j.readiness !== 'public_owner' && j.months.length > 0)
}

/** "Page 1 of 2 · cover letter" */
export function gcNoticePageLabel(index: number, total: number, label: string): string {
  return `Page ${index + 1} of ${total} · ${label}`
}

/** ‹ and › stop at the ends — a run is read once through, not in a loop. */
export function stepGcNoticePreview(index: number, delta: -1 | 1, total: number): number {
  return Math.min(Math.max(index + delta, 0), Math.max(total - 1, 0))
}
