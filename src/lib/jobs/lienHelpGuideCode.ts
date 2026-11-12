import { qrMatrix } from '../../../supabase/functions/_shared/qrMatrix'
import { bytesToBase64, qrPngBytes } from '../../../supabase/functions/_shared/qrPng'
import { APP_ORIGIN } from '../appOrigin'
import { helpShareUrl } from '../helpShareCard'
import { lienDeskHref } from '../lien/lienDeskRoute'
import { lienWindowHref } from './stagesDeepLinks'

/**
 * The codes a lien help sheet prints (punch list #314). One in its corner opens the full guide on a phone (change 11).
 * One beside the steps after the notary opens the place in the app where the filing and the mail receipts are recorded
 * (change 5, as the owner turned it): a cover sheet's opens its own job's affidavit tab, a batch sheet's the Affidavits
 * list. Drawn here, not in `lienHelpSheet.ts`, so the sheet's kernel stays words and HTML; the caller hands the markup in.
 */

/** The guide a lien help sheet points at. `lienHelpGuideCode.test.ts` holds it to a guide that exists. */
export const LIEN_HELP_GUIDE_SLUG = 'file-a-lien-and-never-miss-its-deadlines'

/** The guide's public address: its share page, which opens the guide for a signed-in reader. */
export function lienHelpGuideUrl(): string {
  return helpShareUrl(APP_ORIGIN, LIEN_HELP_GUIDE_SLUG)
}

/**
 * The quiet edge a code to record is drawn with, in modules. A job's address is long, and its code prints small in the
 * one free corner of the cover sheet; the white page around it is the rest of the edge, so the picture spends its
 * width on the code.
 */
export const LIEN_HELP_RECORD_CODE_QUIET = 2

/** An address as a code's markup; '' when it cannot be drawn as a code (it is empty, or too long for the largest code). */
function codeMarkup(url: string, quiet?: number): string {
  const modules = qrMatrix(url)
  return modules ? `<img alt="" src="data:image/png;base64,${bytesToBase64(qrPngBytes(modules, quiet === undefined ? {} : { quiet }))}"/>` : ''
}

const drawn = new Map<string, string>()

/** Drawn once for an address and kept: a batch print asks for the same code on every pass of its memo. */
function codeFor(url: string, quiet?: number): string {
  const kept = drawn.get(url)
  if (kept !== undefined) return kept
  const markup = codeMarkup(url, quiet)
  drawn.set(url, markup)
  return markup
}

/** The code as markup for the sheet's corner; '' when the address cannot be drawn as a code. Drawn once and kept. */
export function lienHelpGuideCode(): string {
  return codeFor(lienHelpGuideUrl())
}

/**
 * Where a cover sheet's code lands: the job's Lien window on the affidavit tab, which has a phone layout. The tab
 * offers **Record filing…** until the paper is on file and **Record service…** after, so one code serves both steps.
 */
export function lienHelpRecordUrl(jobId: string): string {
  return `${APP_ORIGIN}${lienWindowHref(jobId, 'affidavit')}`
}

/** The cover sheet's code for one job; '' with no job, or when the address cannot be drawn. */
export function lienHelpRecordCode(jobId: string): string {
  return jobId.trim() ? codeFor(lienHelpRecordUrl(jobId.trim()), LIEN_HELP_RECORD_CODE_QUIET) : ''
}

/** Where a batch sheet's code lands: the Lien desk's Affidavits list, each job a press from its own affidavit tab. */
export function lienHelpBatchRecordUrl(): string {
  return `${APP_ORIGIN}${lienDeskHref({ kind: 'affidavit' })}`
}

/** The batch sheet's code. */
export function lienHelpBatchRecordCode(): string {
  return codeFor(lienHelpBatchRecordUrl(), LIEN_HELP_RECORD_CODE_QUIET)
}

/** Where a notice's help sheet lands: the job's Lien window on the § 53.056 notice tab, where **Save & record sends…** is. */
export function lienHelpNoticeRecordUrl(jobId: string): string {
  return `${APP_ORIGIN}${lienWindowHref(jobId, 'notice')}`
}

/** The notice sheet's code for one job; '' with no job, or when the address cannot be drawn. */
export function lienHelpNoticeRecordCode(jobId: string): string {
  return jobId.trim() ? codeFor(lienHelpNoticeRecordUrl(jobId.trim()), LIEN_HELP_RECORD_CODE_QUIET) : ''
}

/** The guide the run's first page points at. `lienHelpGuideCode.test.ts` holds it to a guide that exists. */
export const LIEN_RUN_GUIDE_SLUG = 'send-lien-notices-from-the-lien-desk'

/** The run guide's public address. */
export function lienRunGuideUrl(): string {
  return helpShareUrl(APP_ORIGIN, LIEN_RUN_GUIDE_SLUG)
}

/** The code on *Today's mail*, the run's first page; '' when the address cannot be drawn. */
export function lienRunGuideCode(): string {
  return codeFor(lienRunGuideUrl())
}
