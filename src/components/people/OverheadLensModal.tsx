import { useEffect } from 'react'
import {
  overheadLensRateWithExtraDenominator,
  overheadLensSensitivity,
  type OverheadLensKey,
  type OverheadLensSeries,
} from '../../lib/overheadLensSeries'

/**
 * People → Overhead lens modal (v2.2674): the arithmetic behind Method A / B /
 * C with today's numbers, where each number comes from, the rate week by week
 * across the 90-day window with a rolling line, and the levers that move it
 * (sized from the kernel's sensitivity math). Presentational — the tab feeds
 * it what its 90-day effect already computed.
 */

export type OverheadLensDetail = {
  series: Record<OverheadLensKey, OverheadLensSeries>
  denominators: { fieldHours: number; invoicedRevenueUsd: number; fieldLaborUsd: number }
  /** Closed, unapproved field-session hours in the window — Method A/C's missing denominator. */
  pendingFieldHours: number
  /** Approved sessions on a non-office job that ALSO carry a bid — counted in the pool and the field denominators. */
  overlapSessions: number
}

type Pool = { officeLaborUsd: number; bidLaborUsd: number; officePartsUsd: number; totalUsd: number }

const money = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`
const money2 = (v: number): string => `$${v.toFixed(2)}`
const hours = (v: number): string => `${Math.round(v).toLocaleString('en-US')} hr`

const LENS: Record<
  OverheadLensKey,
  { name: string; color: string; denLabel: string; denRule: string; blurb: string }
> = {
  A: {
    name: 'A · per field hour',
    color: 'var(--text-blue-500)',
    denLabel: 'billable field hours',
    denRule:
      'Approved, clocked-out sessions on any jobs-ledger job except the office job, in the same 90 days. Hours count even when the person has no wage on file.',
    blurb: 'Every field hour must carry this much overhead. Steady even when billing is lumpy; maps straight onto hourly rates.',
  },
  B: {
    name: 'B · per revenue $',
    color: '#22c55e',
    denLabel: 'invoices sent',
    denRule:
      'jobs_ledger_invoices.amount with sent_to_customer_at inside the window, bucketed to Chicago calendar days. Stripe TEST-mode invoices excluded. Sent — not paid.',
    blurb: 'Add this percentage to any quote regardless of labor mix. Tied to money actually invoiced, so it swings with billing rhythm.',
  },
  C: {
    name: 'C · per labor $',
    color: '#f59e0b',
    denLabel: 'direct field labor $',
    denRule:
      "The same field sessions as Method A × each person's field hourly wage from pay config (dual-rate people: the field rate). No wage on file prices at $0 — hours count in A but vanish here.",
    blurb: 'Every wage dollar carries this much overhead — the classic construction multiplier. Expensive crews carry more.',
  },
}

function fmtRate(lens: OverheadLensKey, r: number | null): string {
  if (r == null) return '—'
  if (lens === 'A') return `${money2(r)}/hr`
  if (lens === 'B') return `${(r * 100).toFixed(1)}%`
  return `${money2(r)} / $1`
}

const W = 760
const H = 180
const ML = 52
const MR = 10
const MT = 12
const MB = 26

function shortMd(ymd: string): string {
  const m = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(ymd.slice(5, 7))] ?? ''
  return `${m} ${Number(ymd.slice(8, 10))}`
}

export function OverheadLensModal({
  lens,
  windowLabel,
  pool,
  rates,
  detail,
  onClose,
}: {
  lens: OverheadLensKey
  windowLabel: string
  pool: Pool | null
  rates: Record<OverheadLensKey, number | null>
  detail: OverheadLensDetail | null
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cfg = LENS[lens]
  const rate = rates[lens]
  const poolUsd = pool?.totalUsd ?? 0
  const den =
    detail == null
      ? null
      : lens === 'A'
        ? detail.denominators.fieldHours
        : lens === 'B'
          ? detail.denominators.invoicedRevenueUsd
          : detail.denominators.fieldLaborUsd
  const denText = den == null ? '—' : lens === 'A' ? hours(den) : money(den)
  const sens = den == null ? null : overheadLensSensitivity(poolUsd, den)

  // "What moves it": each row = direction, lever, sized effect at today's point.
  const fmtDelta = (delta: number | null): string => {
    if (delta == null) return '—'
    const sign = delta < 0 ? '−' : '+'
    const abs = Math.abs(delta)
    if (lens === 'B') return `${sign}${(abs * 100).toFixed(2)} pts`
    return `${sign}$${abs.toFixed(lens === 'C' ? 3 : 2)}`
  }
  const perPool1k = sens?.perPoolDollar == null ? null : sens.perPoolDollar * 1000
  const levers: Array<{ dir: 'down' | 'up'; text: string; effect: string }> =
    lens === 'A'
      ? [
          { dir: 'down', text: 'Approve pending field time — it only counts once approved', effect: `+100 hr → ${fmtDelta(sens?.perDenominatorUnit == null ? null : sens.perDenominatorUnit * 100)}` },
          { dir: 'down', text: 'Cut office-job parts spend or office hours', effect: `−$1,000 pool → ${fmtDelta(perPool1k == null ? null : -perPool1k)}` },
          { dir: 'down', text: 'Move office time onto billable jobs — it leaves the pool AND grows the hours', effect: 'double effect' },
          { dir: 'up', text: 'More estimating (bid) hours that don’t turn into jobs', effect: `+$1,000 pool → ${fmtDelta(perPool1k)}` },
          { dir: 'up', text: 'Idle or unclocked field days — fewer hours, same pool', effect: 'denominator shrinks' },
        ]
      : lens === 'B'
        ? [
            { dir: 'down', text: 'Bill finished work now — Ready-to-bill jobs sitting unbilled shrink this denominator', effect: `+$10,000 invoiced → ${fmtDelta(sens?.perDenominatorUnit == null ? null : sens.perDenominatorUnit * 10000)}` },
            { dir: 'down', text: 'Cut office parts or bid labor', effect: `−$1,000 pool → ${fmtDelta(perPool1k == null ? null : -perPool1k)}` },
            { dir: 'up', text: 'A quiet billing week — the denominator drops before the pool does', effect: 'lumpy by nature' },
            { dir: 'up', text: 'Estimating spend on bids that don’t close', effect: `+$1,000 pool → ${fmtDelta(perPool1k)}` },
          ]
        : [
            { dir: 'down', text: 'Give unpriced people a wage — their hours then add real dollars here', effect: 'see the maintenance strip' },
            { dir: 'down', text: 'Approve pending field time (priced at each person’s wage)', effect: `+$10,000 labor → ${fmtDelta(sens?.perDenominatorUnit == null ? null : sens.perDenominatorUnit * 10000)}` },
            { dir: 'down', text: 'Cut office labor or parts', effect: `−$1,000 pool → ${fmtDelta(perPool1k == null ? null : -perPool1k)}` },
            { dir: 'up', text: 'Raises with the same pool actually LOWER this ratio — a drop is not savings', effect: 'multiplier, not cost' },
          ]

  const whatIf = (() => {
    if (!detail || den == null) return null
    if (lens === 'A' && detail.pendingFieldHours > 0) {
      const r = overheadLensRateWithExtraDenominator(poolUsd, den, detail.pendingFieldHours)
      return r == null
        ? null
        : `If the ${hours(detail.pendingFieldHours)} of pending field time were approved today (pool unchanged), A would read ${fmtRate('A', r)} instead of ${fmtRate('A', rate)}.`
    }
    if (lens === 'B') return 'Sent is not paid: an invoice counts the day it goes out, and a big one falls out of the window 90 days later.'
    if (lens === 'C' && detail.pendingFieldHours > 0)
      return `${hours(detail.pendingFieldHours)} of field time is pending approval — none of its wages are in this denominator yet.`
    return null
  })()

  const series = detail?.series[lens] ?? null
  const chart = (() => {
    if (!series || series.weeks.length === 0) return null
    const vals = series.weeks.map((w) => w.rate).filter((v): v is number => v != null)
    const rollVals = series.rolling.map((r) => r.rate).filter((v): v is number => v != null)
    const max = Math.max(...vals, ...rollVals, rate ?? 0, 1e-9) * 1.15
    const y = (v: number) => H - MB - (v / max) * (H - MT - MB)
    const n = series.weeks.length
    const bw = (W - ML - MR) / n
    const dayX = (i: number) => ML + ((i + 0.5) / series.rolling.length) * (W - ML - MR)
    const linePath = series.rolling
      .map((r, i) => (r.rate == null ? null : `${dayX(i).toFixed(1)} ${y(r.rate).toFixed(1)}`))
      .reduce<string>((acc, pt) => (pt == null ? acc : acc ? `${acc} L ${pt}` : `M ${pt}`), '')
    // Nice-step gridlines (1/2/2.5/5 × 10^k) so a $/hr axis reads $5, $10, $15 — works for fractions (Method B) too.
    const rawStep = (max / 1.15) / 3
    const pow = 10 ** Math.floor(Math.log10(rawStep))
    const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= rawStep) ?? rawStep
    const ticks: number[] = []
    for (let t = step; t < max; t += step) ticks.push(t)
    return { max, y, n, bw, linePath, ticks }
  })()

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="overhead-lens-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        onMouseDown={stop}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 'min(880px, 100%)',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: '1rem 1.25rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h2 id="overhead-lens-modal-title" style={{ margin: 0, fontSize: '1.125rem', color: cfg.color }}>
            {cfg.name}
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{windowLabel}</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-muted)',
              font: 'inherit',
              padding: '0.2rem 0.6rem',
              cursor: 'pointer',
            }}
          >
            Close ✕
          </button>
        </div>
        <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{cfg.blurb}</p>

        {/* The arithmetic, with today's numbers */}
        <div
          style={{
            margin: '0.75rem 0',
            padding: '0.7rem 0.9rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-page)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem 1rem',
            alignItems: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-strong)' }}>{money(poolUsd)}</strong>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>90-day pool</span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>÷</span>
          <span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-strong)' }}>{denText}</strong>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cfg.denLabel}</span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>=</span>
          <strong style={{ fontSize: '1.35rem', color: cfg.color }}>{fmtRate(lens, rate)}</strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem' }}>
          <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Numerator — the pool
            </h3>
            {pool ? (
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.15rem 0.75rem', fontSize: '0.8125rem' }}>
                <dt style={{ color: 'var(--text-muted)' }}>Office labor (the office job)</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(pool.officeLaborUsd)}</dd>
                <dt style={{ color: 'var(--text-muted)' }}>Bid labor (sessions on a bid)</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(pool.bidLaborUsd)}</dd>
                <dt style={{ color: 'var(--text-muted)' }}>Office parts (office-job purchases)</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(pool.officePartsUsd)}</dd>
                <dt style={{ color: 'var(--text-strong)', fontWeight: 700 }}>Pool</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{money(pool.totalUsd)}</dd>
              </dl>
            ) : (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>—</div>
            )}
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
              The same pool feeds all three lenses. Approved, wage-priced sessions only; internal transfers stay out of parts.
            </p>
          </section>
          <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Denominator — {cfg.denLabel}
            </h3>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{denText}</div>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text)' }}>{cfg.denRule}</p>
          </section>
        </div>

        {/* 90-day history */}
        <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            How it moved — last 90 days
          </h3>
          {chart && series ? (
            <>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`${cfg.name} week by week, with a rolling ${series.rollingDays}-day line and the 90-day headline`}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              >
                {chart.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ML} y1={chart.y(t)} x2={W - MR} y2={chart.y(t)} stroke="var(--border)" strokeWidth={1} />
                    <text x={ML - 6} y={chart.y(t) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={10}>
                      {fmtRate(lens, t)}
                    </text>
                  </g>
                ))}
                {series.weeks.map((w, i) => {
                  const x = ML + i * chart.bw + 3
                  const bwid = Math.max(2, chart.bw - 6)
                  const tip = `${shortMd(w.startYmd)} – ${shortMd(w.endYmd)}${w.days < 7 ? ` (${w.days} days)` : ''}: ${money(w.poolUsd)} ÷ ${lens === 'A' ? hours(w.denominator) : money(w.denominator)} = ${fmtRate(lens, w.rate)}`
                  return (
                    <g key={w.endYmd}>
                      <title>{tip}</title>
                      {w.rate == null ? (
                        <text x={x + bwid / 2} y={H - MB - 5} textAnchor="middle" fill="var(--text-faint)" fontSize={9}>
                          —
                        </text>
                      ) : (
                        <rect x={x} y={chart.y(w.rate)} width={bwid} height={Math.max(0.5, H - MB - chart.y(w.rate))} rx={2} fill={cfg.color} opacity={0.5} />
                      )}
                      <rect x={x} y={MT} width={bwid} height={H - MT - MB} fill="transparent" />
                      {i % 2 === 0 && (
                        <text x={x + bwid / 2} y={H - 8} textAnchor="middle" fill="var(--text-faint)" fontSize={9.5}>
                          {shortMd(w.endYmd)}
                        </text>
                      )}
                    </g>
                  )
                })}
                {chart.linePath && <path d={chart.linePath} fill="none" stroke="var(--text-strong)" strokeWidth={1.8} />}
                {rate != null && (
                  <>
                    <line x1={ML} y1={chart.y(rate)} x2={W - MR} y2={chart.y(rate)} stroke={cfg.color} strokeWidth={1.5} strokeDasharray="5 4" />
                    <text x={W - MR} y={chart.y(rate) - 4} textAnchor="end" fill={cfg.color} fontSize={10} fontWeight={700}>
                      90-day {fmtRate(lens, rate)}
                    </text>
                  </>
                )}
              </svg>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                <span>
                  <i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: cfg.color, opacity: 0.5, marginRight: 5, verticalAlign: -1 }} />
                  Weekly rate — that week’s pool ÷ that week’s {cfg.denLabel}
                </span>
                <span>
                  <i aria-hidden style={{ display: 'inline-block', width: 10, height: 2, background: 'var(--text-strong)', marginRight: 5, verticalAlign: 3 }} />
                  Rolling {series.rollingDays}-day
                </span>
                <span>
                  <i aria-hidden style={{ display: 'inline-block', width: 10, height: 0, borderTop: `2px dashed ${cfg.color}`, marginRight: 5, verticalAlign: 3 }} />
                  90-day headline
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>—</div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              What moves it
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.8125rem' }}>
              {levers.map((l) => (
                <li key={l.text} style={{ display: 'flex', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, minWidth: 14, color: l.dir === 'down' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
                    {l.dir === 'down' ? '↓' : '↑'}
                  </span>
                  <span style={{ color: 'var(--text)' }}>{l.text}</span>
                  <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {l.effect}
                  </span>
                </li>
              ))}
            </ul>
            {whatIf && (
              <div style={{ marginTop: '0.5rem', padding: '0.45rem 0.6rem', background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-green-800)' }}>
                {whatIf}
              </div>
            )}
          </section>
          <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Watch-outs
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.45 }}>
              {lens === 'A' && (
                <li>Salaried people are priced here at hourly wage × clocked hours; payroll credits them a flat 8h/day. The two can disagree on a long or short day.</li>
              )}
              {lens === 'B' && <li>This lens follows invoicing rhythm, not cost. Use it for bid margins, not to judge a single week.</li>}
              {lens === 'C' && <li>A raise with the same pool lowers this ratio. Pair it with Method A when comparing crews.</li>}
              {detail && detail.pendingFieldHours > 0 && (
                <li>
                  <strong>{hours(detail.pendingFieldHours)}</strong> of field time is awaiting approval — missing from{' '}
                  {lens === 'B' ? 'nothing here, but from A and C' : 'this denominator'} until someone works the queue (see the maintenance strip).
                </li>
              )}
              <li>
                A session on a field job that also carries a bid link is counted on <em>both</em> sides — bid labor in the pool, field time in the A/C denominators.{' '}
                {detail ? (
                  detail.overlapSessions > 0 ? (
                    <strong style={{ color: 'var(--text-amber-800)' }}>{detail.overlapSessions} such session{detail.overlapSessions === 1 ? '' : 's'} in this window.</strong>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>None in this window.</span>
                  )
                ) : null}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
