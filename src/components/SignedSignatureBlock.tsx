/**
 * The signature block on a signed record (v2.2724, "Option A"): the mark in a
 * thin framed box tagged "Signed electronically" with the record ID, the
 * printed name and time beside it, and one facts line — consent recorded,
 * method, IP and device. Replaces the greyed-out form that used to sit on
 * signed estimates. One component for the estimate record, the contract
 * record and the customer's page; the HTML/PDF builders mirror its layout.
 */
import { ESTIMATE_ACCEPT_SIGNATURE_FONT } from './estimates/EstimateAcceptTypedSignatureLine'
import { describeUserAgent, signatureMethodLabel, type SignatureMethod } from '../lib/signedRecordId'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

export type SignedSignatureBlockProps = {
  printedName: string
  signedAtIso: string | null
  method: SignatureMethod | string | null
  /** Which page the mark was made on — changes the method wording. */
  surface?: 'estimate' | 'contract'
  consentedAtIso: string | null
  /** The clause the signer agreed to, shown after "Consent recorded ·". */
  consentSummary?: string
  ip?: string | null
  userAgent?: string | null
  recordId: string
  /** Drawn signature (signed URL). When set it replaces the cursive name. */
  drawSignatureUrl?: string | null
  drawSignatureLoading?: boolean
  /** Section heading above the frame; null hides it. */
  heading?: string | null
  /** Tighter paddings for cards/strips. */
  compact?: boolean
}

function stamp(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)} CT`
}

export function SignedSignatureBlock({
  printedName,
  signedAtIso,
  method,
  surface = 'contract',
  consentedAtIso,
  consentSummary = 'agreed to do business electronically and to these terms',
  ip,
  userAgent,
  recordId,
  drawSignatureUrl,
  drawSignatureLoading,
  heading = 'Customer signature',
  compact = false,
}: SignedSignatureBlockProps) {
  const name = printedName.trim() || '—'
  const isPaper = method === 'paper'
  const device = describeUserAgent(userAgent)
  const when = stamp(signedAtIso)
  return (
    <section aria-label="Signature record" style={{ marginTop: compact ? '0.75rem' : '1.25rem' }}>
      {heading ? (
        <div style={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-orange-700)', marginBottom: compact ? '0.5rem' : '0.75rem' }}>{heading}</div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-block', padding: compact ? '0.55rem 0.9rem 0.45rem' : '0.7rem 1.1rem 0.55rem', border: '1.5px solid var(--text-orange-700)', borderRadius: 6, minWidth: 180, maxWidth: '100%' }}>
          <span style={{ position: 'absolute', top: -8, left: 10, padding: '0 6px', background: 'var(--surface)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-orange-700)', whiteSpace: 'nowrap' }}>
            {isPaper ? 'Signed on paper' : 'Signed electronically'}
          </span>
          {drawSignatureLoading ? (
            <div style={{ height: compact ? 36 : 48, display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading signature…</div>
          ) : drawSignatureUrl ? (
            <img src={drawSignatureUrl} alt={`Signature of ${name}`} style={{ display: 'block', maxHeight: compact ? 44 : 60, maxWidth: 260, width: 'auto', height: 'auto' }} />
          ) : (
            <div style={{ fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT, fontSize: compact ? '1.9rem' : '2.6rem', lineHeight: 1, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320, paddingRight: 4 }}>{name}</div>
          )}
          <span style={{ position: 'absolute', bottom: -8, right: 10, padding: '0 6px', background: 'var(--surface)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.64rem', letterSpacing: '0.03em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{recordId}</span>
        </div>
        <div style={{ textAlign: 'right', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: compact ? '0.85rem' : '0.95rem', color: 'var(--text-strong)' }}>{name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{when ?? '—'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', marginTop: compact ? '0.6rem' : '0.85rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          {consentedAtIso || isPaper ? (
            <span aria-hidden style={{ display: 'inline-flex', width: 14, height: 14, borderRadius: 3, background: 'var(--text-green-700)', color: 'white', fontSize: '0.6rem', alignItems: 'center', justifyContent: 'center' }}>✓</span>
          ) : null}
          <span>
            <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>{isPaper ? 'On file' : consentedAtIso ? 'Consent recorded' : 'Signed'}</b>
            {!isPaper && consentedAtIso ? ` · ${consentSummary}` : ''}
          </span>
        </span>
        <span>{signatureMethodLabel(method, surface)}</span>
        {ip || device ? <span>{[ip, device].filter(Boolean).join(' · ')}</span> : null}
      </div>
    </section>
  )
}

export default SignedSignatureBlock
