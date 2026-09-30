import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { VectorBucket, VectorColumn, VectorGrid, VectorGridRow } from '../../lib/bridge/vectorDays'
import { reviewDoorHref } from '../../lib/people/reviewDoor'

/**
 * Vectors by the day (v2.4217, punch list #69) — one cell per field person
 * per day: green when the day's hours earned more than they cost, red when
 * less, the shade by dollars per hour; a week sum after every Saturday and
 * the period's total at the end. Office and bid days are grey with their
 * hours — a cost, never a verdict. The kernel decides every number and the
 * order; this only draws.
 */

const shortUsd = (n: number): string => {
  const a = Math.abs(n)
  const body = a >= 1000 ? `${(a / 1000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(Math.round(a))
  return `${n < 0 ? '−' : '+'}${body}`
}
const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const hrs = (h: number): string => (h === 0 ? '—' : `${h < 10 ? Number(h.toFixed(1)) : Math.round(h)}h`)

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const navBtn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.1rem 0.5rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const th: CSSProperties = { fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.1rem 0', textAlign: 'center', whiteSpace: 'nowrap' }
const cellBase: CSSProperties = { width: 26, minWidth: 26, height: 26, textAlign: 'center', borderRadius: 4, fontSize: '0.64rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', border: '1px solid transparent', color: 'var(--text-muted)' }
const sumBase: CSSProperties = { width: 52, minWidth: 52, textAlign: 'right', paddingRight: 6, fontWeight: 700, fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '2px solid var(--border-strong)' }
const nameTd: CSSProperties = { textAlign: 'left', paddingRight: 8, fontSize: '0.78rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }

/** Six shades by dollars per field hour: the sign is the verdict, the shade how far from even. */
function shade(perHour: number): { background: string; color: string; fontWeight?: number } {
  if (perHour >= 25) return { background: 'var(--bg-green-200)', color: 'var(--text-green-800)', fontWeight: 700 }
  if (perHour >= 8) return { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' }
  if (perHour >= 0) return { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
  if (perHour > -8) return { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
  if (perHour > -25) return { background: 'var(--bg-red-100)', color: 'var(--text-red-800)' }
  return { background: 'var(--bg-red-200)', color: 'var(--text-red-900)', fontWeight: 700 }
}
const GUESS_HATCH = 'repeating-linear-gradient(135deg, rgba(180, 83, 9, 0.18) 0 2px, transparent 2px 6px)'

function bucketTitle(b: VectorBucket, col: VectorColumn): string {
  const parts: string[] = []
  const when = col.kind === 'day' ? col.start : `${col.start} → ${col.end}`
  if (b.fieldHours > 0) {
    parts.push(`${when} · ${hrs(b.fieldHours)} field${b.officeBidHours > 0 ? ` + ${hrs(b.officeBidHours)} office/bid` : ''}`)
    parts.push(`earned ${money(b.earnedUsd)} − labor ${money(b.laborUsd)} = ${money(b.contributionUsd ?? 0)}${b.contributionPerHour != null ? ` (${money(b.contributionPerHour)}/h)` : ''}`)
    for (const j of b.jobs) parts.push(`${j.label}: ${hrs(j.hours)} at ${j.ratePerHour == null ? 'no contract price' : `${money(j.ratePerHour)}/h`}${j.guessed ? ' ≈ no % complete' : ''}`)
  } else parts.push(`${when} · ${hrs(b.officeBidHours)} office / bid — costs ${money(b.officeLaborUsd)}, earns nothing here`)
  if (b.guessedEarnedUsd > 0) parts.push(`≈ ${money(b.guessedEarnedUsd)} of the earned figure rests on a job assumed half done`)
  if (b.unratedHours > 0) parts.push(`${hrs(b.unratedHours)} on jobs with no contract price (earned $0)`)
  if (b.pendingHours > 0) parts.push(`${hrs(b.pendingHours)} not yet approved`)
  return parts.join('\n')
}

function DayCell({ b, col }: { b: VectorBucket | null; col: VectorColumn }) {
  if (!b) {
    if (col.weekend || col.future) return <td style={{ ...cellBase, background: 'transparent' }} />
    return <td style={{ ...cellBase, background: 'var(--bg-muted)', color: 'var(--border-strong)' }}>·</td>
  }
  const title = bucketTitle(b, col)
  if (b.contributionUsd == null || b.contributionPerHour == null) {
    return (
      <td style={{ ...cellBase, background: 'var(--bg-muted)', borderStyle: b.pendingHours > 0 ? 'dashed' : 'solid', borderColor: b.pendingHours > 0 ? 'var(--border-strong)' : 'transparent' }} title={title}>
        {hrs(b.officeBidHours)}
      </td>
    )
  }
  const s = shade(b.contributionPerHour)
  return (
    <td
      style={{
        ...cellBase,
        ...s,
        backgroundImage: b.guessedEarnedUsd > 0 ? GUESS_HATCH : undefined,
        borderStyle: b.pendingHours > 0 ? 'dashed' : 'solid',
        borderColor: b.pendingHours > 0 ? 'var(--border-strong)' : 'transparent',
        fontStyle: b.pendingHours > 0 ? 'italic' : undefined,
      }}
      title={title}
      data-testid="vector-day-cell"
    >
      {shortUsd(b.contributionUsd)}
    </td>
  )
}

function SumCell({ b, col, bold }: { b: VectorBucket | null; col: VectorColumn | null; bold?: boolean }) {
  if (!b || (b.fieldHours <= 0 && b.officeBidHours <= 0)) return <td style={{ ...sumBase, color: 'var(--text-muted)', fontWeight: 400 }}>—</td>
  const c = b.contributionUsd
  const guessed = b.guessedEarnedUsd > 0
  const color = c == null ? 'var(--text-muted)' : guessed ? 'var(--text-amber-800)' : c >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
  const title = col ? bucketTitle(b, col) : undefined
  return (
    <td style={{ ...sumBase, color, fontWeight: bold ? 800 : 700 }} title={title}>
      {c == null ? hrs(b.officeBidHours) : `${guessed ? '≈' : ''}${shortUsd(c)}`}
      <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400 }}>
        {hrs(b.fieldHours)}
        {b.contributionPerHour != null && col == null ? ` · ${money(b.contributionPerHour)}/h` : ''}
        {b.pendingHours > 0 ? ' ⋯' : ''}
      </span>
    </td>
  )
}

function Row({ r, grid }: { r: VectorGridRow; grid: VectorGrid }) {
  return (
    <tr data-testid="vector-day-row">
      <td style={nameTd}>
        <Link
          to={reviewDoorHref({ person: r.name, from: grid.start, to: grid.end })}
          title={`Open ${r.name}'s period on People → Review`}
          style={{ fontWeight: 600, color: 'var(--text)', textDecorationLine: 'underline', textDecorationColor: 'var(--border-strong)', textUnderlineOffset: 3 }}
        >
          {r.name}
        </Link>
        <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
          {r.wage == null ? 'no wage on file' : `${money(r.wage)}/h`}
          {r.isSalary ? ' · salaried' : ''}
        </span>
      </td>
      {grid.columns.map((col, i) => (col.kind === 'day' ? <DayCell key={col.key} b={r.cells[i] ?? null} col={col} /> : <SumCell key={col.key} b={r.cells[i] ?? null} col={col} />))}
      <SumCell b={r.total} col={null} />
    </tr>
  )
}

export function BridgeVectorDaysPanel(props: { grid: VectorGrid | null; periodLabel: string; isCurrent: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; loading: boolean; error: string | null }) {
  const { grid } = props
  const totalLabel = grid && grid.zoom === 'days' ? periodShort(grid.start) : 'total'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-vector-days">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>Vectors — by the day</span>
        <span style={det}>was each person's day worth it · field people · approved time</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button type="button" onClick={props.onPrev} disabled={!props.canPrev} style={{ ...navBtn, opacity: props.canPrev ? 1 : 0.4 }} aria-label="Previous month">
            ‹
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {props.periodLabel}
            {props.isCurrent ? <span style={{ ...det, fontWeight: 400 }}> so far</span> : null}
          </span>
          <button type="button" onClick={props.onNext} disabled={!props.canNext} style={{ ...navBtn, opacity: props.canNext ? 1 : 0.4 }} aria-label="Next month">
            ›
          </button>
        </span>
      </div>
      {props.error ? (
        <div style={{ ...det, color: 'var(--text-red-700)', padding: '0.6rem 0' }}>{props.error}</div>
      ) : props.loading || !grid ? (
        <div style={{ ...det, padding: '0.6rem 0' }}>Loading days…</div>
      ) : grid.rows.length === 0 ? (
        <div style={{ ...det, padding: '0.6rem 0' }}>No approved field hours in this period yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.4rem' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }} />
                {grid.columns.map((c) => (
                  <th key={c.key} style={{ ...th, color: c.kind === 'day' ? (c.weekend ? 'var(--border-strong)' : 'var(--text-muted)') : 'var(--text)' }}>
                    {c.kind === 'day' ? c.sub : c.label}
                  </th>
                ))}
                <th style={{ ...th, color: 'var(--text)' }}>{totalLabel}</th>
              </tr>
              <tr>
                <th style={{ ...th, textAlign: 'left' }} />
                {grid.columns.map((c) => (
                  <th key={c.key} style={{ ...th, color: c.kind === 'day' ? (c.weekend ? 'var(--border-strong)' : 'var(--text-muted)') : 'var(--text-muted)', fontWeight: 400 }}>
                    {c.kind === 'day' ? c.label : c.sub}
                  </th>
                ))}
                <th style={{ ...th, fontWeight: 400 }}>total</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((r) => (
                <Row key={r.userId} r={r} grid={grid} />
              ))}
              <tr data-testid="vector-day-company">
                <td style={{ ...nameTd, fontWeight: 700, borderTop: '2px solid var(--border-strong)' }}>Field crew</td>
                {grid.columns.map((col, i) => {
                  const b = grid.company.cells[i] ?? null
                  if (col.kind !== 'day') return <SumCell key={col.key} b={b} col={col} bold />
                  const c = b?.contributionUsd
                  return (
                    <td key={col.key} style={{ ...cellBase, borderTop: '2px solid var(--border-strong)', borderRadius: 0, fontWeight: 700, color: c == null ? 'var(--text-muted)' : c >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }} title={b ? bucketTitle(b, col) : undefined}>
                      {c == null ? '' : shortUsd(c)}
                    </td>
                  )
                })}
                <SumCell b={grid.company.total} col={null} bold />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...det, marginTop: '0.45rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Swatch bg="var(--bg-green-200)" text="earned well over wage" />
        <Swatch bg="var(--bg-green-tint)" text="just over" />
        <Swatch bg="var(--bg-red-tint)" text="just under" />
        <Swatch bg="var(--bg-red-200)" text="well under" />
        <Swatch bg="var(--bg-green-tint)" image={GUESS_HATCH} text="≈ on a job with no % complete (assumed half done)" />
        <Swatch bg="var(--bg-muted)" text="office / bid day, hours only" />
        <span>Numbers are the day's contribution in dollars, short.</span>
      </div>
      <div style={{ ...det, marginTop: '0.3rem' }}>
        The same rule as the table above, one day at a time: earned = field hours × the job's contract ÷ expected hours; labor = hours × the wage (a salaried person's day costs the flat workday). A red day means the job's rate is under the wage — priced low, no contract price, or run past its expected hours — and every hour on it reads the same, whoever worked it. Every new hour and % update re-prices every day on that job, so the grid is always as of today. Materials and subs are job costs, not a person's day.
      </div>
    </div>
  )
}

function Swatch({ bg, image, text }: { bg: string; image?: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <i style={{ display: 'inline-block', width: 14, height: 12, borderRadius: 3, background: bg, backgroundImage: image, border: '1px solid var(--border)' }} />
      {text}
    </span>
  )
}

/** "Sep" for the month's total column. */
function periodShort(start: string): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(start.slice(5, 7)) - 1] ?? 'total'
}
