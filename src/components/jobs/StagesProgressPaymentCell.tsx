import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { StagesMoneyBarModel } from '../../lib/stagesMoneyBar'

const PAID_COLOR = '#16a34a'
const BILLED_COLOR = '#2563eb'
const UNBILLED_COLOR = '#f59e0b'

type StagesProgressPaymentCellProps = {
  model: StagesMoneyBarModel
  /** Current pct_complete (0–100) or null; seeds the editable input / read-only label. */
  pctComplete: number | null
  pctSaving?: boolean
  /**
   * Commit a new pct (null = cleared). Fired on blur / Enter, mirroring the old
   * inline input. Omit to render pct as read-only text (later-stage tables).
   */
  onPctCommit?: (pct: number | null) => void
  /** Optional row-specific detail line (e.g. this row's invoice amount), rendered under the legend. */
  footnote?: React.ReactNode
}

function swatch(color?: string) {
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
 * Merged "Progress & payment" cell body for the Stages tables: editable % +
 * total on top, a paid/unbilled bar of the total bill, and a labeled legend.
 * Pure presentation — all math comes in via the model (see stagesMoneyBar.ts).
 */
export default function StagesProgressPaymentCell({ model, pctComplete, pctSaving, onPctCommit, footnote }: StagesProgressPaymentCellProps) {
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }
  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const amountStyle: React.CSSProperties = { fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '11rem', textAlign: 'left' }}>
      <div style={rowStyle}>
        <span style={{ whiteSpace: 'nowrap' }}>
          {onPctCommit ? (
            <>
              <input
                key={`pct-${pctComplete ?? 'null'}`}
                type="number"
                min={0}
                max={100}
                defaultValue={pctComplete != null ? pctComplete : ''}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === '') {
                    onPctCommit(null)
                    return
                  }
                  const n = Math.round(Number(v))
                  if (!Number.isNaN(n) && n >= 0 && n <= 100) {
                    onPctCommit(n)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                disabled={!!pctSaving}
                placeholder=""
                aria-label="Percent complete"
                style={{
                  width: '2.75rem',
                  padding: '0.15rem 0.25rem',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  border: 'none',
                  borderBottom: '1px solid var(--border-strong)',
                  borderRadius: 0,
                  background: 'transparent',
                }}
              />
              <span style={labelStyle}> % done</span>
            </>
          ) : pctComplete != null ? (
            <span style={labelStyle}>
              <span style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{pctComplete}</span> % done
            </span>
          ) : (
            <span style={labelStyle}>&nbsp;</span>
          )}
        </span>
        <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {model.hasBar ? `${formatUsdNoCents(model.total)} bid` : 'no bid value'}
        </span>
      </div>

      {model.hasBar ? (
        <div
          title={[
            `Paid ${formatUsdNoCents(model.paid)}`,
            model.billedUnpaid > 0 ? `billed but unpaid ${formatUsdNoCents(model.billedUnpaid)}` : null,
            model.unbilled != null
              ? `done but unbilled ${formatUsdNoCents(model.unbilled)} · not done ${formatUsdNoCents(Math.max(0, model.total - (model.valueCreated ?? 0)))}`
              : 'set % complete to see unbilled work',
          ]
            .filter(Boolean)
            .join(' · ')}
          style={{
            display: 'flex',
            height: 10,
            borderRadius: 4,
            overflow: 'hidden',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
          }}
        >
          {model.paidFrac > 0 && <div style={{ width: `${model.paidFrac * 100}%`, background: PAID_COLOR }} />}
          {model.billedFrac > 0 && <div style={{ width: `${model.billedFrac * 100}%`, background: BILLED_COLOR }} />}
          {model.unbilledFrac > 0 && <div style={{ width: `${model.unbilledFrac * 100}%`, background: UNBILLED_COLOR }} />}
        </div>
      ) : (
        <div
          title="No bid value on this job yet"
          style={{ height: 10, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        <div style={rowStyle} title="Payments received on this job">
          <span style={labelStyle}>{swatch(PAID_COLOR)}Paid</span>
          <span style={amountStyle}>{model.paid > 0 ? formatUsdNoCents(model.paid) : '—'}</span>
        </div>
        {model.billedUnpaid > 0 && (
          <div style={rowStyle} title="Invoiced to the customer but not yet paid">
            <span style={labelStyle}>{swatch(BILLED_COLOR)}Billed</span>
            <span style={amountStyle}>{formatUsdNoCents(model.billedUnpaid)}</span>
          </div>
        )}
        <div style={rowStyle} title="Work completed that hasn't been paid for yet (% done × bid − paid)">
          <span style={labelStyle}>{swatch(UNBILLED_COLOR)}Unbilled</span>
          <span style={amountStyle}>{model.unbilled != null ? formatUsdNoCents(model.unbilled) : '—'}</span>
        </div>
        <div
          style={{ ...rowStyle, borderTop: '1px solid var(--border)', paddingTop: '0.15rem' }}
          title="Bid total minus payments received"
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Owed</span>
          <span style={{ ...amountStyle, fontWeight: 600 }}>
            {model.hasBar || model.paid > 0 ? formatUsdNoCents(model.owed) : '—'}
          </span>
        </div>
      </div>
      {footnote != null && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>{footnote}</div>
      )}
    </div>
  )
}
