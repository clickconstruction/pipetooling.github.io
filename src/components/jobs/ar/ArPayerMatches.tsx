/**
 * "Who paid you" (AR refresh PR 3, v2.3381): the matched payer's open bills
 * as a list the eye can compare — amount · job · where · age cue · Stripe
 * tag — the exact match tinted green and first, the one-check-several-bills
 * combo as one row that fills several lines, and the amount-only matches
 * from other customers under their own heading. Lifted out of the first
 * allocation line, where the same data was a row of chips. Every row keeps
 * the "Apply allocation: …" name the render suites find it by.
 */
import type { CSSProperties } from 'react'
import type { ArDepositCustomerMatch } from '../../../lib/jobs/arDepositCustomerMatch'
import { bankPaymentTargetDetailLead, bankPaymentTargetPrimaryLabel, formatBankPaymentTargetDollars, type BankPaymentTarget } from '../../../lib/jobsStagesBoard'

export type ArPayerMatchesProps = {
  match: ArDepositCustomerMatch | null
  /** The matched payer's open bills, deposit-amount matches first. */
  payerTargets: BankPaymentTarget[]
  /** Keys whose remaining equals the deposit's remaining. */
  amountMatchKeys: Set<string>
  /** The unique set of the payer's bills that sums to the deposit, when one exists. */
  combo: BankPaymentTarget[] | null
  /** The deposit's remaining balance — the combo row's headline. */
  depositRemaining: number
  /** Amount-only matches from other customers. */
  outsideTargets: BankPaymentTarget[]
  canApply: boolean
  onPick: (targetKey: string) => void
  onPickCombo: (targets: BankPaymentTarget[]) => void
}

const rowStyle = (highlight: boolean, disabled: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(80px, auto) minmax(0, 1fr) auto',
  gap: '0 0.75rem',
  alignItems: 'center',
  width: '100%',
  textAlign: 'left',
  padding: '0.45rem 0.6rem',
  marginTop: 4,
  border: `1px solid ${highlight ? 'var(--border-green)' : 'var(--border)'}`,
  borderRadius: 6,
  background: highlight ? 'var(--bg-green-tint)' : 'var(--surface)',
  color: 'var(--text-700)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.8125rem',
  lineHeight: 1.35,
})

const eyebrow: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 2 }

export function StripeTag() {
  return (
    <span title="Sent through Stripe — picking it asks for the paid-outside-Stripe confirmation" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-purple-700, #635bff)', border: '1px solid currentColor', borderRadius: 999, padding: '0 6px', marginLeft: 6, verticalAlign: 1 }}>
      Stripe
    </span>
  )
}

function BillRow({ t, highlight, canApply, onPick }: { t: BankPaymentTarget; highlight: boolean; canApply: boolean; onPick: (key: string) => void }) {
  const dollars = formatBankPaymentTargetDollars(t.remaining)
  const primary = bankPaymentTargetPrimaryLabel(t)
  const detail = bankPaymentTargetDetailLead(t)
  return (
    <button type="button" disabled={!canApply} onClick={() => onPick(t.key)} aria-label={`Apply allocation: ${dollars} · ${primary}`} style={rowStyle(highlight, !canApply)}>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{dollars}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--text-strong)' }}>{primary}</span>
        {detail ? <span style={{ color: 'var(--text-muted)' }}> · {detail}</span> : null}
        {t.stripeHosted ? <StripeTag /> : null}
      </span>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: highlight ? 'var(--text-green-700)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>{highlight ? '✓ matches this deposit' : ''}</span>
    </button>
  )
}

export function ArPayerMatches({ match, payerTargets, amountMatchKeys, combo, depositRemaining, outsideTargets, canApply, onPick, onPickCombo }: ArPayerMatchesProps) {
  const hasPayer = match != null && payerTargets.length > 0
  if (!hasPayer && outsideTargets.length === 0) return null
  return (
    <div data-testid="ar-payer-matches" style={{ marginBottom: '0.9rem' }}>
      {hasPayer ? (
        <>
          <div style={eyebrow}>Who paid you</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {match.source === 'counterparty' ? 'From ' : match.source === 'note' ? 'Note mentions ' : 'Memo mentions '}
            <strong style={{ color: 'var(--text-700)' }}>{match.name}</strong>
            {' — their open bills'}
          </div>
          {combo ? (
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onPickCombo(combo)}
              aria-label={`Fill ${combo.length} allocations: ${combo.map((t) => `${formatBankPaymentTargetDollars(t.remaining)} ${t.hcpNumber}`).join(' + ')}`}
              style={{ ...rowStyle(true, !canApply), borderStyle: 'dashed' }}
            >
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>
                {combo.length} bills = {formatBankPaymentTargetDollars(depositRemaining)}
              </span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {combo.map((t) => `${formatBankPaymentTargetDollars(t.remaining)} · ${t.hcpNumber || '—'}`).join('  +  ')}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>fills {combo.length} allocation lines</span>
            </button>
          ) : null}
          {payerTargets.map((t) => (
            <BillRow key={t.key} t={t} highlight={amountMatchKeys.has(t.key)} canApply={canApply} onPick={onPick} />
          ))}
        </>
      ) : null}
      {outsideTargets.length > 0 ? (
        <>
          <div style={{ ...eyebrow, marginTop: hasPayer ? 10 : 0 }}>{hasPayer ? 'Also matches the deposit amount' : 'Matches deposit amount'}</div>
          {outsideTargets.map((t) => (
            <BillRow key={t.key} t={t} highlight={false} canApply={canApply} onPick={onPick} />
          ))}
        </>
      ) : null}
    </div>
  )
}
