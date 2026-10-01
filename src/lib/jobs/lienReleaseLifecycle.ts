/**
 * Lien-release lifecycle kernel (v2.2619, PR 2 of the signing loop):
 * draft (autosaved, editable) → issued (snapshot locked = minted) →
 * awaiting_signature → signed; `sent_to_customer_at` and `voided_at` are
 * orthogonal stamps. Pure helpers for the modal, history chips, and the
 * signature audit line every rendering carries.
 */
import type { JobLienReleaseRow } from './lienReleaseTracking'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

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

/**
 * The audit sentence every signed rendering carries under the signature block (v2.4285 — one
 * sentence that says how, who, when and whose screen; the statutes are the renderer's second
 * line, `LIEN_WAIVER_ESIGN_LINE`): "Drawn by Malachi Whites in ClickTooling on Sep 30, 2026 at
 * 9:19 PM CT, on Robert’s screen, consent recorded." Without the signer's name on the row (rows
 * signed before v2.2619's loop) it opens "Signed electronically in ClickTooling on …".
 */
export function lienReleaseSignatureAuditLine(
  row: {
    signed_at: string | null
    signer_consented_at: string | null
    signer_printed_name?: string | null
    signer_signature_mode?: string | null
  },
  /** v2.4274: the leader signed on someone else's screen — named in the sentence ("on Taunya’s screen"). */
  onDeviceOf?: string | null,
): string | null {
  if (!row.signed_at) return null
  const when = new Date(row.signed_at)
  const day = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(when)
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(when)
  const device = (onDeviceOf ?? '').trim()
  const name = (row.signer_printed_name ?? '').trim()
  const how = row.signer_signature_mode === 'draw' ? 'Drawn' : row.signer_signature_mode === 'type' ? 'Typed' : null
  const opener = name && how ? `${how} by ${name} in ClickTooling` : name ? `Signed electronically by ${name} in ClickTooling` : 'Signed electronically in ClickTooling'
  return `${opener} on ${day} at ${clock} CT${device ? `, on ${device}’s screen` : ''}${row.signer_consented_at ? ', consent recorded' : ''}.`
}

/**
 * A signed row as the renderers' signature (v2.4285 — the one place every re-rendering reads it:
 * the window's print and PDF, the Documents page, the cleared-releases queue, the signature inbox,
 * the email's regenerated PDF). The mode is the row's, so the audit sentence tells the truth; the
 * drawn PNG is not on the row, so a drawn re-rendering shows the printed name in the cursive face —
 * the stored signed PDF carries the ink itself.
 */
export function lienReleaseRowSignature(
  row: Pick<JobLienReleaseRow, 'status' | 'signed_at' | 'signer_consented_at' | 'signer_printed_name' | 'signer_signature_mode'>,
  onDeviceOf?: string | null,
): { mode: 'type' | 'draw'; printedName: string; pngDataUrl: null; auditLine: string; signedYmd: string | null } | null {
  if (lienReleaseStatus(row) !== 'signed' || !row.signer_printed_name) return null
  return {
    mode: row.signer_signature_mode === 'draw' ? 'draw' : 'type',
    printedName: row.signer_printed_name,
    pngDataUrl: null,
    auditLine: lienReleaseSignatureAuditLine(row, onDeviceOf) ?? '',
    signedYmd: row.signed_at ? calendarYmdInAppTzFromIso(row.signed_at) : null,
  }
}

/** Theme-token chip colors per lifecycle tone — shared by the modal history and Documents rows. */
export function lienReleaseChipColors(tone: LienReleaseChip['tone']): {
  background: string
  color: string
  border?: string
} {
  switch (tone) {
    case 'awaiting':
      return { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
    case 'signed':
    case 'sent':
      return { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'voided':
      return { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  }
}
