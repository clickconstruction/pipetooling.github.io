/**
 * One row of the AR billed-line picker (v2.3383): amount in its own column, the
 * job number and name on the first line, who pays · where · which line on the
 * second, the Stripe tag or the deposit-match check on the right. The closed
 * trigger uses `ArBilledLineTrigger` — one line, the same three facts.
 */
import type { CSSProperties } from 'react'
import type { ArBilledLineRowParts } from '../../../lib/jobs/arBilledLineOptions'
import { StripeTag } from './ArPayerMatches'

const clip: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

export function ArBilledLineOption({ parts, amountMatch }: { parts: ArBilledLineRowParts; amountMatch: boolean }) {
  return (
    <span
      style={{
        display: 'grid',
        gridTemplateColumns: '92px minmax(0, 1fr) auto',
        gridTemplateRows: 'auto auto',
        columnGap: 12,
        rowGap: 1,
        alignItems: 'baseline',
        lineHeight: 1.3,
      }}
    >
      {/* Every cell is placed by hand: auto-placement seats row-spanning cells first, which put the tags in the job column. */}
      <span
        style={{
          gridColumn: 1,
          gridRow: '1 / span 2',
          alignSelf: 'center',
          textAlign: 'right',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-strong)',
          whiteSpace: 'nowrap',
        }}
      >
        {parts.dollars}
      </span>
      <span style={{ ...clip, gridColumn: 2, gridRow: 1, color: 'var(--text-strong)' }}>
        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{parts.number}</span>
        <span style={{ fontWeight: 600, marginLeft: 8 }}>{parts.title}</span>
      </span>
      <span
        style={{
          gridColumn: 3,
          gridRow: '1 / span 2',
          alignSelf: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {amountMatch ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-green-700)' }}>✓ matches this deposit</span>
        ) : null}
        {parts.stripe ? <StripeTag /> : null}
      </span>
      <span style={{ ...clip, gridColumn: 2, gridRow: 2, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {parts.secondary || ' '}
      </span>
    </span>
  )
}

/** The closed trigger after a pick: `$250.00 · 1015 · Montolongo Post Test` with the Stripe tag. */
export function ArBilledLineTrigger({ parts }: { parts: ArBilledLineRowParts }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{parts.dollars}</span>
      <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{parts.number}</span>
      <span style={clip}>{parts.title}</span>
      {parts.stripe ? <StripeTag /> : null}
    </span>
  )
}
