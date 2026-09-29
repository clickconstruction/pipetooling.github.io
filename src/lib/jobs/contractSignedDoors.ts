/**
 * The Contract window's signed state (v2.4183): which doors a signed agreement offers and the
 * lines its rail prints — lifted from the Signed agreement view (v2.2709) when that view folded
 * into the window, so one window carries every state. Pure; the rail renders it.
 */
import { isGoogleDocsUrl, shortDocumentLabel } from './jobContractDocument'

export type SignedSource = 'contract' | 'paper' | 'estimate' | 'bid_room'

export type SignedRowLike = {
  signer_mode: string | null
  signed_document_url: string | null
  paper_upload_path: string | null
  public_token: string | null
}

export type SignedDoorsInput = {
  source: SignedSource
  /** The job_contracts row (a contract we sent, or a paper / link record); null for an estimate acceptance. */
  row: SignedRowLike | null
  /** The customer's mobile, digits only, when the job or the row has one. */
  phone: string
  /** The stored signed PDF resolved to a URL. */
  storedPdf: boolean
  /** The uploaded paper copy resolved to a URL. */
  uploadedCopy: boolean
  estimateId: string | null
  estimateNumber: number | null
}

export type SignedDoors = {
  verb: 'Signed' | 'Accepted'
  /** Copy the customer's page — the durable signing link. */
  copyLink: boolean
  textLink: boolean
  /** The filed document (a Google Doc or another link). */
  document: { label: string; sub: string; gdoc: boolean } | null
  /** Email a copy… and what goes with it. */
  emailCopy: { attachment: 'pdf' | 'link'; sub: string } | null
  /** The stored PDF, or one share-job-contract builds on demand. */
  downloadPdf: 'stored' | 'build' | null
  openUploaded: boolean
  print: boolean
  /** The estimate or bid-room proposal the acceptance lives on. */
  openEstimate: string | null
}

export function signedDoors(i: SignedDoorsInput): SignedDoors {
  const isContract = i.source === 'contract' || i.source === 'paper'
  const row = isContract ? i.row : null
  const paper = row?.signer_mode === 'paper'
  const hasLink = Boolean(row?.public_token)
  const hasTarget = isContract ? row != null : i.estimateId != null
  const docUrl = row?.signed_document_url ?? null
  const linkOnly = paper && !row?.paper_upload_path && Boolean(docUrl)
  const gdoc = isGoogleDocsUrl(docUrl)
  return {
    verb: isContract ? 'Signed' : 'Accepted',
    copyLink: hasLink,
    textLink: hasLink && i.phone.length > 0,
    document: docUrl ? { label: `Open the signed ${gdoc ? 'Google Doc' : 'document'}`, sub: shortDocumentLabel(docUrl), gdoc } : null,
    emailCopy:
      hasTarget && (!isContract || !paper || Boolean(row?.paper_upload_path) || Boolean(docUrl))
        ? { attachment: linkOnly ? 'link' : 'pdf', sub: linkOnly ? 'the link' : 'PDF attached' }
        : null,
    downloadPdf: i.storedPdf ? 'stored' : hasTarget && (!isContract || !paper) ? 'build' : null,
    openUploaded: paper && i.uploadedCopy,
    print: isContract && row != null && !paper,
    openEstimate: !isContract && i.estimateNumber != null ? `Open ${i.source === 'bid_room' ? 'proposal' : 'estimate'} #${i.estimateNumber}` : null,
  }
}

/** How it was signed, in the banner's words. */
export function signedHowLine(i: { source: SignedSource; row: Pick<SignedRowLike, 'signer_mode' | 'signed_document_url'> | null; estimateDrawn: boolean }): string {
  if (i.source === 'contract' || i.source === 'paper') {
    const m = i.row?.signer_mode
    if (m === 'paper') {
      return i.row?.signed_document_url ? `Signed outside the app · filed as a ${isGoogleDocsUrl(i.row.signed_document_url) ? 'Google Doc' : 'link'}` : 'Signed on paper, uploaded by the office'
    }
    return m === 'draw' ? 'Drawn on their phone' : m === 'in_person' ? 'Signed in person on our device' : 'Typed on their phone'
  }
  return i.estimateDrawn ? 'Drawn on the estimate page' : 'Typed on the estimate page'
}

/** The footer line: the last copy that went out, from the job's activity ledger. */
export function signedShareLine(last: { to: string[]; at: string; by: string | null } | null, stamp: (iso: string) => string): string {
  if (!last) return 'Not shared yet'
  return `↗ Shared with ${last.to.join(', ')} · ${stamp(last.at)}${last.by ? ` by ${last.by}` : ''}`
}

/** "iPhone · Safari" from a user agent, for the Device fact. */
export function abbreviateUa(ua: string | null | undefined): string {
  const s = ua ?? ''
  if (!s) return '—'
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android' : /Mac OS/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : 'Device'
  const br = /CriOS|Chrome\//.test(s) ? 'Chrome' : /FxiOS|Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'browser'
  return `${os} · ${br}`
}
