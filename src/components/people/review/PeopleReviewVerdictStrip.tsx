// The verdict strip at the top of the Review tab's ranked view: profit after
// overhead with a trend pill against the prior period, and "how gross became
// profit" as a composition bar. Presentational — every number arrives from
// `buildReviewVerdict`.

import type { ReviewVerdict } from '../../../lib/people/reviewRanked'
import { CATEGORY_TAG_INK } from '../../../lib/banking/categoryTags'
import { fmtH, fmtMoney } from '../teamSummary/formatters'

const FIXED_SEGMENT_COLOR: Record<string, string> = {
  costs: 'var(--text-faint)',
  overheadLabor: '#8b5cf6',
  burden: '#f59e0b',
  wheelsCompany: '#0f766e',
  wheelsOwn: '#4338ca',
  profit: '#15803d',
}
/** Tag segments take their family ink; the fixed four keep their colors. */
function segmentColor(s: ReviewVerdict['segments'][number]): string {
  if (s.color) return CATEGORY_TAG_INK[s.color]
  return FIXED_SEGMENT_COLOR[s.key] ?? 'var(--text-faint)'
}

const kpiShell: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.7rem 0.9rem',
  background: 'var(--surface)',
  display: 'grid',
  gap: 2,
  alignContent: 'start',
  minWidth: 0,
}
const kpiLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}
const kpiBig: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
}
const kpiSub: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

function TrendPill({ trend, loading }: { trend: ReviewVerdict['trend']; loading: boolean }) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 9px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    background: 'var(--bg-page)',
  }
  if (loading) return <span style={base}>… comparing to the prior period</span>
  if (!trend) return <span style={base}>No prior period to compare</span>
  const pct = trend.deltaPct == null ? null : Math.round(Math.abs(trend.deltaPct) * 100)
  if (trend.direction === 'up') {
    return (
      <span style={{ ...base, color: 'var(--text-green-800)', background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)' }} title={`Prior period: ${fmtMoney(trend.priorProfit)}`}>
        ↑ +{pct}% vs the prior period
      </span>
    )
  }
  if (trend.direction === 'down') {
    return (
      <span style={{ ...base, color: 'var(--text-amber-900)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' }} title={`Prior period: ${fmtMoney(trend.priorProfit)}`}>
        ↓ −{pct}% vs the prior period
      </span>
    )
  }
  return (
    <span style={base} title={`Prior period: ${fmtMoney(trend.priorProfit)}`}>
      {pct == null ? 'Nothing in the prior period to compare' : `→ Flat · ${trend.deltaPct != null && trend.deltaPct < 0 ? '−' : '+'}${pct}% vs the prior period`}
    </span>
  )
}

export function PeopleReviewVerdictStrip({
  verdict,
  periodLabel,
  priorLoading,
  ratesLoading,
}: {
  verdict: ReviewVerdict
  periodLabel: string
  priorLoading: boolean
  ratesLoading: boolean
}) {
  const profitText = verdict.profit == null ? (ratesLoading ? '…' : '—') : fmtMoney(verdict.profit)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(0, 2.2fr)',
        gap: '0.6rem',
        marginBottom: '0.75rem',
      }}
      className="people-review-verdict"
    >
      <div style={{ ...kpiShell, background: 'var(--bg-subtle)' }}>
        <div style={kpiLabel}>Profit after overhead</div>
        <div style={kpiBig}>{profitText}</div>
        <div style={kpiSub}>{periodLabel}</div>
        <div style={kpiSub}>
          <TrendPill trend={verdict.trend} loading={priorLoading && verdict.trend == null} />
        </div>
        <div style={{ ...kpiSub, marginTop: 4 }}>
          {verdict.field.count} field ·{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {verdict.field.profit == null ? '—' : fmtMoney(verdict.field.profit)}
          </span>
          {verdict.field.profitPerFieldHour != null && (
            <> · {fmtMoney(verdict.field.profitPerFieldHour)}/field h</>
          )}
          <br />
          {verdict.office.count} office & bids ·{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtH(verdict.office.overheadHours)} h · {fmtMoney(-verdict.office.overheadLabor)}
          </span>
          {verdict.none.names.length > 0 && (
            <>
              <br />
              {verdict.none.names.length} with no time
            </>
          )}
        </div>
      </div>
      <div style={kpiShell}>
        <div style={kpiLabel}>
          How {fmtMoney(verdict.gross)} gross became {profitText} profit
        </div>
        {verdict.segments.length > 0 ? (
          <>
            <div
              style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--bg-muted)', marginTop: 6 }}
              role="img"
              aria-label={verdict.segments.map((s) => `${s.label} ${fmtMoney(s.usd)} (${Math.round(s.share * 100)}%)`).join(', ')}
            >
              {verdict.segments.map((s) => (
                <span key={s.key} style={{ display: 'block', height: '100%', width: `${s.share * 100}%`, background: segmentColor(s) }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
              {verdict.segments.map((s) => (
                <span key={s.key} style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: segmentColor(s), marginRight: 5, verticalAlign: -1 }} />
                  {s.icon ? <span aria-hidden="true">{s.icon} </span> : null}{s.label} <b style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(s.usd)}</b> · {Math.round(s.share * 100)}%
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ ...kpiSub, marginTop: 6 }}>
            {ratesLoading
              ? 'Loading the 90-day overhead rate…'
              : verdict.gross <= 0
                ? 'No gross revenue in this period.'
                : 'Overhead rate unavailable — profit after overhead cannot be drawn.'}
          </div>
        )}
      </div>
    </div>
  )
}
