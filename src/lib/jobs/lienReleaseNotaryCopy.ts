/**
 * The notarized copy on a waiver signed before a notary (Print for a notary). The office files what
 * came back as a Google Drive link (v2.5925) or as the PDF itself (v2.5985, phase 0 of the
 * online-notary study: an online notary's session ends with a sealed, tamper-evident PDF, and a
 * paper notary's scan is a PDF too). The file wins: Send it attaches it in place of the rebuilt
 * page, Download PDF hands it over, and the link is what the email names when there is no file.
 * The file lives at `<release_id>/notary-copy-<ms>.pdf` (`lienReleaseNotaryCopyPdfPath`).
 */
import { lienReleaseStatus } from './lienReleaseLifecycle'

/** The largest PDF the window keeps: 4 MB, which still fits the send email once in base64 (5.5M characters). */
export const NOTARY_COPY_MAX_BYTES = 4_000_000

/** The row's notary columns; neither is in the generated types yet, so both are optional here. */
export type LienReleaseNotaryCopyRow = {
  signer_signature_mode?: string | null
  notary_copy_path?: string | null
  notary_copy_url?: string | null
}

/** What came back from the notary, as the row holds it: the stored PDF, the Drive link, either or both. Null off the notary path. */
export function lienReleaseNotaryCopy(row: LienReleaseNotaryCopyRow | null | undefined): { path: string | null; url: string | null } | null {
  if (!row || row.signer_signature_mode !== 'notary_paper') return null
  const path = (row.notary_copy_path ?? '').trim() || null
  const url = (row.notary_copy_url ?? '').trim() || null
  return path || url ? { path, url } : null
}

function megabytes(bytes: number): string {
  const mb = bytes / 1_000_000
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`
}

/** Why a picked file cannot be the notarized copy, in the window's words, or null when it can. */
export function notaryCopyFileProblem(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name.trim()))
  if (!isPdf) return 'Pick the PDF the notary sent back. A photo or a scan in another format will not attach.'
  if (file.size <= 0) return 'That PDF is empty. Pick the file the notary sent back.'
  if (file.size > NOTARY_COPY_MAX_BYTES) {
    return `That PDF is ${megabytes(file.size)}. An email carries 4 MB at most. Put it on Google Drive and paste the link instead.`
  }
  return null
}

/**
 * Whether the window opens on a waiver held out for a notary (v2.5985). Its hold is the only place the
 * notarized copy is filed, and the paper comes back days after the print, so a window opened on one of
 * its bills, or on none, resumes it. A window opened for another bill or another form is making a
 * different waiver; the held one waits under Already on this job.
 */
export function resumesNotaryHold(
  row: { status: string; voided_at: string | null; invoice_ids: readonly string[] | null; form_type: string },
  opened: { invoiceIds: readonly string[]; formType: string | null },
): boolean {
  if (lienReleaseStatus(row) !== 'out_for_notary' || row.voided_at) return false
  if (opened.formType && opened.formType !== row.form_type) return false
  return opened.invoiceIds.length === 0 || (row.invoice_ids ?? []).some((id) => opened.invoiceIds.includes(id))
}

/** The notarized file's name on a download or in the email: the waiver's own name, marked notarized. */
export function notaryCopyPdfFilename(filename: string): string {
  return `${filename.replace(/\.pdf$/i, '')}-notarized.pdf`
}
