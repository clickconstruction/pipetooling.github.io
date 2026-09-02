/**
 * Lien-release lifecycle kernel (v2.2619, PR 2 of the signing loop):
 * draft (autosaved, editable) → issued (snapshot locked = minted) →
 * awaiting_signature → signed; `sent_to_customer_at` and `voided_at` are
 * orthogonal stamps. Pure helpers for the modal, history chips, and the
 * signature audit line every rendering carries.
 */
import type { JobLienReleaseRow } from './lienReleaseTracking'

export type LienReleaseStatus = 'draft' | 'issued' | 'awaiting_signature' | 'signed'

export function lienReleaseStatus(row: Pick<JobLienReleaseRow, 'status'>): LienReleaseStatus {
  const s = (row.status ?? '').trim()
  return s === 'draft' || s === 'awaiting_signature' || s === 'signed' ? s : 'issued'
}

/** Fields stay editable (and autosave keeps writing) only while the row is a draft. */
export function lienReleaseIsEditable(row: Pick<JobLienReleaseRow, 'status'> | null): boolean {
  return row == null || lienReleaseStatus(row) === 'draft'
}

/** Minted = the document exists (Documents lists it; the snapshot is locked). */
export function lienReleaseIsMinted(row: Pick<JobLienReleaseRow, 'status'>): boolean {
  return lienReleaseStatus(row) !== 'draft'
}

export type LienReleaseChip = {
  label: string
  /** Maps to the app's chip palettes: amber = awaiting, green = signed/sent, gray = draft, red = voided. */
  tone: 'draft' | 'awaiting' | 'signed' | 'sent' | 'voided'
}

/** Status chips for a history row, in display order. */
export function lienReleaseChips(
  row: Pick<JobLienReleaseRow, 'status' | 'sent_to_customer_at' | 'voided_at'>,
): LienReleaseChip[] {
  if (row.voided_at) return [{ label: 'voided', tone: 'voided' }]
  const out: LienReleaseChip[] = []
  const status = lienReleaseStatus(row)
  if (status === 'draft') out.push({ label: 'draft', tone: 'draft' })
  if (status === 'awaiting_signature') out.push({ label: 'awaiting signature', tone: 'awaiting' })
  if (status === 'signed') out.push({ label: 'signed ✓', tone: 'signed' })
  if (row.sent_to_customer_at) out.push({ label: 'sent ✓', tone: 'sent' })
  return out
}

/** A signature can be requested on an editable draft or an issued-but-unsigned release. */
export function canRequestLienSignature(
  row: Pick<JobLienReleaseRow, 'status' | 'voided_at'> | null,
): boolean {
  if (row == null) return true // requesting mints the draft first
  if (row.voided_at) return false
  const s = lienReleaseStatus(row)
  return s === 'draft' || s === 'issued'
}

/** The one-line electronic-signature audit every rendering carries under the signature. */
export function lienReleaseSignatureAuditLine(row: {
  signed_at: string | null
  signer_consented_at: string | null
}): string | null {
  if (!row.signed_at) return null
  const when = new Date(row.signed_at)
  const stamp = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(when)
  return `Signed electronically in ClickTooling · ${stamp} CT${row.signer_consented_at ? ' · consent recorded' : ''}`
}
