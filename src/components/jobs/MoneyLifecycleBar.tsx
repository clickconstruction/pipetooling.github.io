import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

const PAID_COLOR = '#16a34a'
const BILLED_COLOR = '#2563eb'
const DRAFT_COLOR = '#60a5fa'
const UNBILLED_COLOR = '#f59e0b'

export { PAID_COLOR, BILLED_COLOR, DRAFT_COLOR, UNBILLED_COLOR }

/** One colored slice of the bar; `frac` is 0–1 of the whole track. */
export type BarSegment = { key: string; frac: number; color: string }

export type MoneyRow = {
  key: string
  label: string
  value: number
  /** Swatch color; omit for the neutral (empty-track) swatch. */
  dot?: string
}

function Swatch({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 2,
        marginRight: 5,
        background: color ?? 'var(--bg-subtle)',
        border: color ? undefined : '1px solid var(--border)',
        verticalAlign: 'baseline',
      }}
    />
  )
}

/**
 * The Edit-Job "Billing" Progress & payment block, styled to read exactly like
 * the Stages board's StagesProgressPaymentCell: a "% done · $X bid" top row, the
 * segmented bar with the yellow field-progress dot, then a stacked legend
 * (swatch label left, tabular amount right) closed by a bold divider row
 * (Remaining to bill, the Stages cell's "Owed" slot).
 */
export function MoneyLifecycleBar({
  hasBar,
  segments,
  pctComplete,
  total,
  rows,
  bottomRow,
  height = 10,
  barTitle,
}: {
  hasBar: boolean
  segments: BarSegment[]
  /** Field % done for the top-left readout + the yellow dot; hidden when null. */
  pctComplete?: number | null
  /** Job total — the "$X bid" top-right readout. */
  total: number
  /** Stacked legend rows in order (Paid / Billed / Draft …). */
  rows: MoneyRow[]
  /** Bold bottom row under the divider (e.g. Remaining to bill). */
  bottomRow: { label: string; value: number; title?: string }
  height?: number
  barTitle?: string
}) {
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }
  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const amountStyle: React.CSSProperties = { fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
      <div style={rowStyle}>
        <span style={{ whiteSpace: 'nowrap' }}>
          {pctComplete != null ? (
            <span style={labelStyle}>
              <span style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{pctComplete}</span> % done
            </span>
          ) : (
            <span style={labelStyle}>&nbsp;</span>
          )}
        </span>
        <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {hasBar ? `${formatUsdNoCents(total)} bid` : 'Job total: add a line item to set it'}
        </span>
      </div>

      <div
        title={
          hasBar
            ? barTitle
            : [
                'No line items yet — add one in the Line items list below to set the job total',
                pctComplete != null ? `field progress ${Math.round(pctComplete)}% (yellow dot)` : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        style={{ position: 'relative' }}
      >
        {hasBar ? (
          <div
            style={{
              display: 'flex',
              height,
              borderRadius: 4,
              overflow: 'hidden',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
            }}
          >
            {segments
              .filter((s) => s.frac > 0)
              .map((s) => (
                <div
                  key={s.key}
                  style={{
                    width: `${s.frac * 100}%`,
                    background: s.color,
                  }}
                />
              ))}
          </div>
        ) : (
          <div style={{ height, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' }} />
        )}
        {pctComplete != null ? (
          // Field-progress marker — same yellow dot as the Stages Progress & payment
          // bar; sits at pct% across the bar (0% = left edge, 100% = right edge).
          // Work progress is independent of money, so it also renders on the dashed
          // no-line-items track.
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, pctComplete))}%`,
              top: '50%',
              width: 10,
              height: 10,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: '#facc15',
              border: '1px solid #ca8a04',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        {rows.map((r) => (
          <div key={r.key} style={rowStyle}>
            <span style={labelStyle}>
              <Swatch color={r.dot} />
              {r.label}
            </span>
            <span style={amountStyle}>{r.value > 0 ? formatUsdNoCents(r.value) : '—'}</span>
          </div>
        ))}
        <div
          style={{ ...rowStyle, borderTop: '1px solid var(--border)', paddingTop: '0.15rem' }}
          title={bottomRow.title}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{bottomRow.label}</span>
          <span style={{ ...amountStyle, fontWeight: 600 }}>
            {hasBar || bottomRow.value > 0 ? formatUsdNoCents(bottomRow.value) : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
