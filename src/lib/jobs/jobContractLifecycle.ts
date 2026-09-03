/**
 * Job-contract lifecycle kernel (Contract Desk PR 2): draft (autosaved,
 * editable) → sent (token minted, fields locked) → signed; voided is terminal
 * and "Void & redo" supersedes with a fresh draft. Pure helpers for the
 * modal, the history rows, and the audit line every signed rendering carries.
 */
import type { Database } from '../../types/database'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type JobContractRow = Database['public']['Tables']['job_contracts']['Row']

export type JobContractStatus = 'draft' | 'sent' | 'signed' | 'voided'

export function jobContractStatus(row: Pick<JobContractRow, 'status' | 'voided_at'>): JobContractStatus {
  if (row.voided_at) return 'voided'
  const s = (row.status ?? '').trim()
  return s === 'sent' || s === 'signed' || s === 'voided' ? s : 'draft'
}

/** Fields stay editable (and autosave keeps writing) only while the row is a draft. */
export function jobContractIsEditable(row: Pick<JobContractRow, 'status' | 'voided_at'> | null): boolean {
  return row == null || jobContractStatus(row) === 'draft'
}

/** Live = the one row the modal works on: a draft or a sent contract that is not voided. */
export function jobContractIsLive(row: Pick<JobContractRow, 'status' | 'voided_at'>): boolean {
  const s = jobContractStatus(row)
  return s === 'draft' || s === 'sent'
}

export type JobContractChip = {
  label: string
  tone: 'draft' | 'sent' | 'signed' | 'voided'
}

export function jobContractChips(
  row: Pick<JobContractRow, 'status' | 'voided_at' | 'signer_mode' | 'send_count' | 'view_count'>,
): JobContractChip[] {
  const s = jobContractStatus(row)
  if (s === 'voided') return [{ label: 'voided', tone: 'voided' }]
  if (s === 'draft') return [{ label: 'draft', tone: 'draft' }]
  if (s === 'sent') {
    const opened = row.view_count > 0 ? ` · opened ${row.view_count}×` : ''
    return [{ label: `sent${row.send_count > 1 ? ` ×${row.send_count}` : ''}${opened}`, tone: 'sent' }]
  }
  return [{ label: row.signer_mode === 'paper' ? 'on file · paper' : 'signed ✓', tone: 'signed' }]
}

/** Theme-token chip colors per tone — shared by the modal history and Documents rows. */
export function jobContractChipColors(tone: JobContractChip['tone']): {
  background: string
  color: string
  border?: string
} {
  switch (tone) {
    case 'sent':
      return { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
    case 'signed':
      return { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'voided':
      return { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  }
}

/** The customer's page. The token is the credential; the origin is whatever domain the office is on. */
export function jobContractSigningUrl(origin: string, rawToken: string): string {
  return `${origin.replace(/\/$/, '')}/contract/sign?t=${encodeURIComponent(rawToken)}`
}

export function formatContractStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/** The one-line electronic-signature audit under every signed rendering. */
export function jobContractSignatureAuditLine(row: {
  signed_at: string | null
  signer_printed_name: string | null
  signer_mode: string | null
  signer_consented_at: string | null
}): string | null {
  if (!row.signed_at) return null
  const stamp = formatContractStamp(row.signed_at)
  const who = (row.signer_printed_name ?? '').trim()
  if (row.signer_mode === 'paper') return `Signed on paper${who ? ` by ${who}` : ''}${stamp ? ` · recorded ${stamp} CT` : ''}`
  const how = row.signer_mode === 'draw' ? 'drawn' : row.signer_mode === 'in_person' ? 'in person' : 'typed'
  return `Signed electronically${who ? ` by ${who}` : ''} (${how})${stamp ? ` · ${stamp} CT` : ''}${
    row.signer_consented_at ? ' · consent recorded' : ''
  }`
}
