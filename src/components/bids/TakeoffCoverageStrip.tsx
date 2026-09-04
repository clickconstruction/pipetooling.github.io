import type { ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import type { TakeoffCoverageSummary } from '../../lib/bids/takeoffCoverage'

/**
 * The coverage strip New 1 and New 2 share (docs/TAKEOFFS_REFRESH_PLAN.md):
 * the Workbench `stat` idiom — Costed N of M with a bar · Materials · $0 lines ·
 * Bundles · Overrides — with an action slot on the right. Materials is the
 * same number the Labor tab and the Workbench show (`summarizeTakeoffCoverage`).
 */
export function TakeoffCoverageStrip({
  coverage,
  onClickUncosted,
  onClickZeroPrice,
  compact,
  children,
}: {
  coverage: TakeoffCoverageSummary
  /** Click on the Costed tile — New 2 filters to uncosted; New 1 jumps to the next one. */
  onClickUncosted?: () => void
  onClickZeroPrice?: () => void
  /** Drop the Bundles / Overrides tiles (New 1's narrower header). */
  compact?: boolean
  children?: ReactNode
}) {
  const tile = (key: string, label: string, value: string, opts?: { color?: string; bg?: string; onClick?: () => void; title?: string; bar?: number }) => (
    <button
      key={key}
      type="button"
      onClick={opts?.onClick}
      disabled={!opts?.onClick}
      title={opts?.title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '0.45rem 0.9rem',
        minWidth: '6.5rem',
        borderRight: '1px solid var(--border)',
        background: opts?.bg ?? 'transparent',
        border: 'none',
        borderRadius: 0,
        textAlign: 'left',
        cursor: opts?.onClick ? 'pointer' : 'default',
        color: 'inherit',
        font: 'inherit',
      }}
    >
      <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: opts?.color ?? 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: opts?.color ?? 'var(--text-strong)' }}>{value}</span>
      {opts?.bar != null ? (
        <span style={{ display: 'block', height: 5, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden', marginTop: 3 }}>
          <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, opts.bar))}%`, background: opts.bar >= 100 ? 'var(--text-green-700)' : 'var(--text-amber-700)' }} />
        </span>
      ) : null}
    </button>
  )
  const allCosted = coverage.fixtures > 0 && coverage.costed === coverage.fixtures
  return (
    <div
      data-testid="takeoff-coverage-strip"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      {tile('costed', 'Costed', `${coverage.costed} of ${coverage.fixtures}`, {
        color: allCosted ? 'var(--text-green-700)' : 'var(--text-amber-700)',
        bg: allCosted ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
        bar: coverage.costedPct,
        onClick: onClickUncosted,
        title: onClickUncosted ? `${coverage.uncostedIds.length} fixture${coverage.uncostedIds.length === 1 ? '' : 's'} with no lines yet` : undefined,
      })}
      {tile('materials', 'Materials', `$${formatCurrency(coverage.materialsTotal)}`, { title: 'Σ count × qty × price — what Pricing uses as this bid\'s material cost' })}
      {tile('zero', '$0 lines', String(coverage.zeroPriceLineIds.length), {
        color: coverage.zeroPriceLineIds.length > 0 ? 'var(--text-red-700)' : undefined,
        onClick: coverage.zeroPriceLineIds.length > 0 ? onClickZeroPrice : undefined,
        title: coverage.zeroPriceLineIds.length > 0 ? 'Lines with no catalog price' : undefined,
      })}
      {!compact ? tile('bundles', 'Bundles', String(coverage.bundleLineCount)) : null}
      {!compact ? tile('overrides', 'Overrides', String(coverage.overrideLineCount), { title: 'Lines priced away from the catalog\'s lowest' }) : null}
      <div style={{ flex: 1 }} />
      {children ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem' }}>{children}</div> : null}
    </div>
  )
}
