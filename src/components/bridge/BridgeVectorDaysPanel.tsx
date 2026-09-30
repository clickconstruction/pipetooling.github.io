import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { VectorBucket, VectorColumn, VectorGrid, VectorGridRow, VectorZoom } from '../../lib/bridge/vectorDays'
import { VECTOR_MONTHS_ZOOM_COUNT, VECTOR_WEEKS_ZOOM_COUNT, vectorVerdict } from '../../lib/bridge/vectorDays'
import { reviewDoorHref } from '../../lib/people/reviewDoor'

/**
 * Vectors by the day (v2.4217, punch list #69) — one cell per field person
 * per day: green when the day's hours earned more than they cost, red when
 * less, the shade by dollars per hour; a week sum after every Saturday and
 * the period's total at the end. Office and bid days are grey with their
 * hours — a cost, never a verdict. Weeks and Months (v2.4219) are the same
 * rows folded: a cell per pay week or per month, the shade the same. A cell's
 * click (v2.4220) opens its card under the grid — the jobs at their rate
 * beside the wage, the verdict sentence, the doors; the Why line under each
 * name counts red days by job; ↻ marks a day whose verdict flipped since last
 * week's rates. The kernel decides every number and the order; this only draws.
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

const FLIP: CSSProperties = { position: 'absolute', top: -1, right: 1, fontSize: '0.55rem', lineHeight: 1, color: 'var(--text-amber-800)' }

function DayCell({ b, col, selected, onPick }: { b: VectorBucket | null; col: VectorColumn; selected: boolean; onPick: () => void }) {
  if (!b) {
    if (col.weekend || col.future) return <td style={{ ...cellBase, background: 'transparent' }} />
    return <td style={{ ...cellBase, background: 'var(--bg-muted)', color: 'var(--border-strong)' }}>·</td>
  }
  const title = bucketTitle(b, col)
  const sel: CSSProperties = selected ? { outline: '2px solid var(--text)', outlineOffset: -1 } : {}
  if (b.contributionUsd == null || b.contributionPerHour == null) {
    return (
      <td style={{ ...cellBase, ...sel, background: 'var(--bg-muted)', cursor: 'pointer', borderStyle: b.pendingHours > 0 ? 'dashed' : 'solid', borderColor: b.pendingHours > 0 ? 'var(--border-strong)' : 'transparent' }} title={title} onClick={onPick}>
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
        ...sel,
        position: 'relative',
        cursor: 'pointer',
        backgroundImage: b.guessedEarnedUsd > 0 ? GUESS_HATCH : undefined,
        borderStyle: b.pendingHours > 0 ? 'dashed' : 'solid',
        borderColor: b.pendingHours > 0 ? 'var(--border-strong)' : 'transparent',
        fontStyle: b.pendingHours > 0 ? 'italic' : undefined,
      }}
      title={b.flippedDays > 0 ? `${title}\n↻ re-priced this week: last week's rates read this day the other way` : title}
      onClick={onPick}
      data-testid="vector-day-cell"
    >
      {shortUsd(b.contributionUsd)}
      {b.flippedDays > 0 ? <span style={FLIP} data-testid="vector-flip">↻</span> : null}
    </td>
  )
}

/** A pay-week or month cell (Weeks / Months zooms): the day cell's shade, wider, hours only when the period had no field hours. */
function PeriodCell({ b, col, selected, onPick }: { b: VectorBucket | null; col: VectorColumn; selected: boolean; onPick: () => void }) {
  const wide: CSSProperties = { ...cellBase, width: 56, minWidth: 56, fontSize: '0.68rem', cursor: b ? 'pointer' : undefined, ...(selected ? { outline: '2px solid var(--text)', outlineOffset: -1 } : {}) }
  if (!b) return <td style={{ ...wide, background: col.future ? 'transparent' : 'var(--bg-muted)', color: 'var(--border-strong)' }}>{col.future ? '' : '·'}</td>
  const title = bucketTitle(b, col)
  if (b.contributionUsd == null || b.contributionPerHour == null) {
    return (
      <td style={{ ...wide, background: 'var(--bg-muted)' }} title={title} onClick={onPick}>
        {hrs(b.officeBidHours)}
      </td>
    )
  }
  const s = shade(b.contributionPerHour)
  return (
    <td
      style={{ ...wide, ...s, backgroundImage: b.guessedEarnedUsd > 0 ? GUESS_HATCH : undefined, borderStyle: b.pendingHours > 0 ? 'dashed' : 'solid', borderColor: b.pendingHours > 0 ? 'var(--border-strong)' : 'transparent', fontStyle: b.pendingHours > 0 ? 'italic' : undefined }}
      title={title}
      onClick={onPick}
      data-testid="vector-period-cell"
    >
      {b.guessedEarnedUsd > 0 ? '≈' : ''}
      {shortUsd(b.contributionUsd)}
      {b.flippedDays > 0 ? <span style={{ fontSize: '0.55rem', color: 'var(--text-amber-800)', marginLeft: 1 }} title={`${b.flippedDays} day${b.flippedDays === 1 ? '' : 's'} re-priced this week`}>↻</span> : null}
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

function whyLine(r: VectorGridRow): string {
  if (r.total.redDays === 0) return r.total.fieldDays > 0 ? 'no red days' : ''
  const jobs = r.redByJob.map((j) => `${r.redByJob.length > 1 ? `${j.days} on ` : 'all on '}${j.label.split(' ')[0] || j.label}${j.noPrice ? ', no price' : j.guessed ? ', no %' : ''}`)
  return jobs.join(' · ')
}

function Row({ r, grid, selectedKey, onPick }: { r: VectorGridRow; grid: VectorGrid; selectedKey: string | null; onPick: (key: string) => void }) {
  const why = whyLine(r)
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
        {why ? (
          <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)', whiteSpace: 'normal', maxWidth: 150, lineHeight: 1.25 }} data-testid="vector-why">
            {r.total.redDays > 0 ? <b style={{ color: 'var(--text-red-700)' }}>{r.total.redDays} red</b> : null}
            {r.total.redDays > 0 ? ' · ' : ''}
            {why}
          </span>
        ) : null}
      </td>
      {grid.columns.map((col, i) => {
        const b = r.cells[i] ?? null
        const key = `${r.userId}:${col.key}`
        if (col.kind === 'day') return <DayCell key={col.key} b={b} col={col} selected={selectedKey === key} onPick={() => onPick(key)} />
        if (col.kind === 'weekSum') return <SumCell key={col.key} b={b} col={col} />
        return <PeriodCell key={col.key} b={b} col={col} selected={selectedKey === key} onPick={() => onPick(key)} />
      })}
      <SumCell b={r.total} col={null} />
    </tr>
  )
}

const ZOOMS: Array<{ key: VectorZoom; word: string }> = [
  { key: 'days', word: 'Days' },
  { key: 'weeks', word: 'Weeks' },
  { key: 'months', word: 'Months' },
]
const segBtn = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.75rem', padding: '0.1rem 0.55rem', border: 'none', background: on ? 'var(--text)' : 'transparent', color: on ? 'var(--surface)' : 'var(--text)', fontWeight: on ? 700 : 400, cursor: 'pointer' })

export function BridgeVectorDaysPanel(props: { grid: VectorGrid | null; zoom: VectorZoom; onZoom: (zoom: VectorZoom) => void; periodLabel: string; isCurrent: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; loading: boolean; error: string | null }) {
  const { grid, zoom } = props
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  useEffect(() => setSelectedKey(null), [grid])
  const selected = (() => {
    if (!grid || !selectedKey) return null
    const [userId, ...rest] = selectedKey.split(':')
    const colKey = rest.join(':')
    const row = grid.rows.find((r) => r.userId === userId)
    const i = grid.columns.findIndex((c) => c.key === colKey)
    const col = grid.columns[i]
    const b = row?.cells[i]
    return row && col && b ? { row, col, b } : null
  })()
  const totalLabel = zoom === 'days' ? (grid ? periodShort(grid.start) : 'total') : zoom === 'weeks' ? `${VECTOR_WEEKS_ZOOM_COUNT} wk` : `${VECTOR_MONTHS_ZOOM_COUNT} mo`
  const stepWord = zoom === 'days' ? 'month' : zoom === 'weeks' ? `${VECTOR_WEEKS_ZOOM_COUNT} weeks` : `${VECTOR_MONTHS_ZOOM_COUNT} months`
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-vector-days">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>Vectors — by the day</span>
        <span style={det}>was each person's day worth it · field people · approved time</span>
        <span role="group" aria-label="Zoom" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
          {ZOOMS.map((z) => (
            <button key={z.key} type="button" onClick={() => props.onZoom(z.key)} style={segBtn(z.key === zoom)} aria-pressed={z.key === zoom}>
              {z.word}
            </button>
          ))}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button type="button" onClick={props.onPrev} disabled={!props.canPrev} style={{ ...navBtn, opacity: props.canPrev ? 1 : 0.4 }} aria-label={`Previous ${stepWord}`}>
            ‹
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {props.periodLabel}
            {props.isCurrent ? <span style={{ ...det, fontWeight: 400 }}> so far</span> : null}
          </span>
          <button type="button" onClick={props.onNext} disabled={!props.canNext} style={{ ...navBtn, opacity: props.canNext ? 1 : 0.4 }} aria-label={`Next ${stepWord}`}>
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
                <Row key={r.userId} r={r} grid={grid} selectedKey={selectedKey} onPick={(key) => setSelectedKey((cur) => (cur === key ? null : key))} />
              ))}
              <tr data-testid="vector-day-company">
                <td style={{ ...nameTd, fontWeight: 700, borderTop: '2px solid var(--border-strong)' }}>Field crew</td>
                {grid.columns.map((col, i) => {
                  const b = grid.company.cells[i] ?? null
                  if (col.kind === 'weekSum') return <SumCell key={col.key} b={b} col={col} bold />
                  const c = b?.contributionUsd
                  const wide = col.kind === 'day' ? {} : { width: 56, minWidth: 56 }
                  return (
                    <td key={col.key} style={{ ...cellBase, ...wide, borderTop: '2px solid var(--border-strong)', borderRadius: 0, fontWeight: 700, color: c == null ? 'var(--text-muted)' : c >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }} title={b ? bucketTitle(b, col) : undefined}>
                      {c == null ? '' : shortUsd(c)}
                    </td>
                  )
                })}
                <SumCell b={grid.company.total} col={null} bold />
              </tr>
            </tbody>
          </table>
          {selected ? <CellCard row={selected.row} col={selected.col} b={selected.b} onClose={() => setSelectedKey(null)} /> : <div style={{ ...det, marginTop: '0.3rem' }}>Click a cell for its split — the jobs at their rate beside the wage, and why it reads the way it does.</div>}
        </div>
      )}
      <div style={{ ...det, marginTop: '0.45rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Swatch bg="var(--bg-green-200)" text="earned well over wage" />
        <Swatch bg="var(--bg-green-tint)" text="just over" />
        <Swatch bg="var(--bg-red-tint)" text="just under" />
        <Swatch bg="var(--bg-red-200)" text="well under" />
        <Swatch bg="var(--bg-green-tint)" image={GUESS_HATCH} text="≈ on a job with no % complete (assumed half done)" />
        <Swatch bg="var(--bg-muted)" text="office / bid day, hours only" />
        <span>↻ re-priced this week (last week's rates read it the other way)</span>
        <span>Numbers are the day's contribution in dollars, short. Under each name: red days, and which job they were on.</span>
      </div>
      <div style={{ ...det, marginTop: '0.3rem' }}>
        The same rule as the table above, one day at a time (Weeks and Months are the same days folded into pay weeks and months): earned = field hours × the job's contract ÷ expected hours; labor = hours × the wage (a salaried person's day costs the flat workday). A red day means the job's rate is under the wage — priced low, no contract price, or run past its expected hours — and every hour on it reads the same, whoever worked it. Every new hour and % update re-prices every day on that job, so the grid is always as of today. Materials and subs are job costs, not a person's day.
      </div>
    </div>
  )
}

const DOW_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function dayWords(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  return `${DOW_LONG[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`
}
function periodWords(col: VectorColumn): string {
  if (col.kind === 'day') return dayWords(col.start)
  if (col.kind === 'month') return `${MON[Number(col.start.slice(5, 7)) - 1]} ${col.start.slice(0, 4)}`
  return `${dayWords(col.start)} – ${dayWords(col.end)}`
}
const doorBtn: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none' }

/** The card a cell's click opens (v2.4220): the split by job, the verdict, the doors. */
function CellCard({ row, col, b, onClose }: { row: VectorGridRow; col: VectorColumn; b: VectorBucket; onClose: () => void }) {
  const verdict = vectorVerdict(b, row.name, row.wage)
  const tone = verdict.tone === 'red' ? { background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px dashed var(--text-red-700)' } : verdict.tone === 'green' ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', border: '1px dashed var(--text-green-700)' } : { background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)' }
  const worst = [...b.jobs].sort((a, c) => (a.ratePerHour ?? 0) - (c.ratePerHour ?? 0))[0]
  const oneDay = col.kind === 'day'
  return (
    <div style={{ marginTop: '0.6rem', border: '1px solid var(--text)', borderRadius: 8, background: 'var(--surface)', maxWidth: 480, overflow: 'hidden' }} data-testid="vector-cell-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.4rem 0.7rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 700 }}>
        <span>
          {row.name} · {periodWords(col)}
        </span>
        <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{hrs(b.fieldHours)} field{b.officeBidHours > 0 ? ` · ${hrs(b.officeBidHours)} office` : ''}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...navBtn, padding: '0 0.35rem' }}>
            ×
          </button>
        </span>
      </div>
      <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.8rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {b.jobs.map((j) => (
              <tr key={j.jobId}>
                <td style={{ padding: '0.2rem 0', borderBottom: '1px solid var(--border)' }}>
                  {j.label}
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {hrs(j.hours)} × {j.ratePerHour == null ? 'no contract price' : `earned rate ${money(j.ratePerHour)}/h`}
                    {j.guessed ? ' · ≈ no % complete, assumed half done' : ''}
                    {!oneDay && j.redDays > 0 ? ` · ${j.redDays} red day${j.redDays === 1 ? '' : 's'}` : ''}
                  </span>
                </td>
                <td style={{ padding: '0.2rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(j.earnedUsd)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '0.2rem 0', borderBottom: '1px solid var(--border)' }}>
                Labor
                <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {row.isSalary ? `the flat workday × ${row.wage == null ? 'no wage' : `${money(row.wage)}/h`} (salaried)` : `${hrs(b.fieldHours)} × wage ${row.wage == null ? '$0 (no wage on file)' : `${money(row.wage)}/h`}`}
                </span>
              </td>
              <td style={{ padding: '0.2rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>−{money(b.laborUsd)}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.25rem 0', fontWeight: 700 }}>Contribution</td>
              <td style={{ padding: '0.25rem 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: b.contributionUsd == null ? 'var(--text-muted)' : b.contributionUsd >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
                {b.contributionUsd == null ? '—' : shortUsd(b.contributionUsd)}
                {b.contributionPerHour != null ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {money(b.contributionPerHour)}/h</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: '0.5rem', padding: '0.45rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', ...tone }} data-testid="vector-verdict">
          {verdict.sentence}
          {b.flippedDays > 0 ? ` ↻ Re-priced this week: last week's rates read ${oneDay ? 'this day' : `${b.flippedDays} of these days`} the other way.` : ''}
          {b.pendingHours > 0 ? ` ${hrs(b.pendingHours)} of this is not yet approved.` : ''}
        </div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {worst ? (
            <Link to={`/jobs?tab=stages&stagesJob=${encodeURIComponent(worst.jobId)}`} style={{ ...doorBtn, background: 'var(--text)', color: 'var(--surface)', borderColor: 'var(--text)' }}>
              Open {worst.label.split(' ')[0] || 'the job'}
            </Link>
          ) : null}
          {worst ? (
            <Link to={`/jobs?tab=job-summary&job=${encodeURIComponent(worst.jobId)}`} style={doorBtn}>
              Set % complete
            </Link>
          ) : null}
          <Link to={reviewDoorHref({ person: row.name, from: b.start, to: b.end })} style={doorBtn}>
            {oneDay ? 'This day' : 'This period'} on People → Review
          </Link>
        </div>
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
