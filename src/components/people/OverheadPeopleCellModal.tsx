import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { formatDenverTimeRangeSameDay } from '../../utils/dateUtils'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import { OVERHEAD_PARTS_ACCOUNTING_BUCKET_LABEL, type OverheadPartsAccountingBucketKey } from '../../lib/overheadPartsAccountingBuckets'
import {
  OVERHEAD_PEOPLE_CELL_COLUMNS,
  buildOverheadPeopleCellModel,
  overheadPeopleCellCsv,
  type OverheadCellDay,
  type OverheadCellLine,
  type OverheadCellOrder,
  type OverheadPeopleCellColumn,
  type OverheadPeopleCellModel,
} from '../../lib/overheadPeopleCellModel'
import type { OverheadSessionDetailLine } from '../../lib/overheadDailyLabor'
import type { OverheadPeoplePartsInput, OverheadPeopleTable } from '../../lib/overheadPeopleTable'

/**
 * Behind the cell (v2.3264): the sessions and purchases that add up to one cell
 * of "Who makes up overhead". Read-only; the fixes live where they already do
 * (People → Hours, Pay config, Banking → Accounting) and the flags lead there.
 */
type Props = {
  table: OverheadPeopleTable
  person: string | null
  unattributed: boolean
  column: OverheadPeopleCellColumn
  labor: ReadonlyArray<OverheadSessionDetailLine>
  parts: ReadonlyArray<OverheadPeoplePartsInput>
  onColumnChange: (c: OverheadPeopleCellColumn) => void
  onClose: () => void
}

const money = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`
const money2 = (v: number): string => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const COL_COLOR: Record<OverheadPeopleCellColumn, string> = { officeLaborUsd: '#8b5cf6', bidLaborUsd: 'var(--text-blue-500)', officePartsUsd: '#f59e0b', totalUsd: 'var(--text-strong)' }
const SECTION_COLOR = { office: '#8b5cf6', bid: 'var(--text-blue-500)', parts: '#f59e0b' } as const

const th: CSSProperties = { textAlign: 'right', padding: '0.3rem 0.5rem', fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.28rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
const tdLeft: CSSProperties = { ...td, textAlign: 'left', whiteSpace: 'normal' }
const chip = (bg: string, color: string, bold = true): CSSProperties => ({ display: 'inline-block', borderRadius: 999, padding: '0 0.45rem', fontSize: '0.68rem', fontWeight: bold ? 600 : 500, marginLeft: '0.35rem', background: bg, color, verticalAlign: '1px' })
const chipWarn = chip('var(--bg-amber-tint)', 'var(--text-amber-800)')
const chipMuted = chip('var(--bg-muted)', 'var(--text-700)', false)
const pillBase: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }
const btn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }
const linkStyle: CSSProperties = { color: 'var(--text-link)', fontWeight: 600 }

function bucketLabel(key: string | null): string | null {
  if (!key) return null
  const known = (OVERHEAD_PARTS_ACCOUNTING_BUCKET_LABEL as Record<string, string | undefined>)[key as OverheadPartsAccountingBucketKey]
  return known ?? key.replace(/_/g, ' ')
}

const punchBand = (l: Extract<OverheadCellLine, { kind: 'session' }>): string => {
  const inMs = l.clockedInAt ? Date.parse(l.clockedInAt) : NaN
  const outMs = l.clockedOutAt ? Date.parse(l.clockedOutAt) : NaN
  return Number.isFinite(inMs) && Number.isFinite(outMs) ? formatDenverTimeRangeSameDay(inMs, outMs) : `${l.hours.toFixed(2)} h`
}

/** One person-day: the day's total on the row, every punch inside it in clock order. */
function DayRow({ d, showPerson, bidLabelById }: { d: OverheadCellDay; showPerson: boolean; bidLabelById: ReadonlyMap<string, string> }) {
  const rates = [...new Set(d.punches.map((p) => p.wageUsdPerHour).filter((r): r is number => r != null))]
  const rate = rates.length === 1 ? `$${rates[0]!.toFixed(2)}/h` : rates.length > 1 ? `${rates.length} rates` : '—'
  const notes = [...new Set(d.punches.map((p) => p.notes).filter((n): n is string => !!n))]
  return (
    <tr>
      <td style={{ ...td, textAlign: 'left', color: 'var(--text-700)', verticalAlign: 'top' }}>{formatStagesNextDateLabel(d.ymd)}</td>
      {showPerson ? <td style={{ ...tdLeft, verticalAlign: 'top' }}>{d.person}</td> : null}
      <td style={tdLeft}>
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0 0.6rem', alignItems: 'baseline' }}>
          {d.punches.map((p) => (
            <span key={p.id} style={{ whiteSpace: 'nowrap', color: p.stray ? 'var(--text-muted)' : undefined }}>
              {p.bucket === 'bid' ? <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>{p.bidId ? bidLabelById.get(p.bidId) ?? 'Bid' : 'Bid'} · </span> : null}
              {punchBand(p)}
              {p.long ? <span style={chipWarn}>{p.hours.toFixed(1)} h — forgotten clock-out?</span> : null}
              {p.missingWage ? <span style={chipWarn}>no wage on file</span> : null}
            </span>
          ))}
        </span>
        {d.pending ? <span style={chipWarn}>awaiting approval</span> : null}
        {d.stray > 0 ? <span style={chipMuted}>{d.stray} stray {d.stray === 1 ? 'punch' : 'punches'}</span> : null}
        {d.weekend ? <span style={chipMuted}>weekend</span> : null}
        {d.punches.length > 1 ? <span style={{ ...chipMuted, background: 'transparent', color: 'var(--text-faint)' }}>{d.punches.length} punches</span> : null}
        {notes.length > 0 ? <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>{notes.join(' · ')}</div> : null}
      </td>
      <td style={{ ...td, verticalAlign: 'top' }}>{d.hours.toFixed(2)} h</td>
      <td style={{ ...td, color: 'var(--text-muted)', verticalAlign: 'top' }}>{rate}</td>
      <td style={{ ...td, fontWeight: 600, verticalAlign: 'top' }}>{money2(d.usd)}</td>
    </tr>
  )
}

function PurchaseRow({ l, showPerson }: { l: Extract<OverheadCellLine, { kind: 'purchase' }>; showPerson: boolean }) {
  const src = l.cardLabel ? `card · ${l.cardLabel}` : l.source === 'supply' ? 'supply invoice' : l.source === 'tally' ? 'tally' : l.source === 'mercury' ? 'bank (no card)' : 'purchase'
  return (
    <tr>
      <td style={{ ...td, textAlign: 'left', color: 'var(--text-700)' }}>{formatStagesNextDateLabel(l.ymd)}</td>
      {showPerson ? <td style={tdLeft}>{l.person ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>no person</span>}</td> : null}
      <td style={tdLeft}>
        {l.label}
        <span style={chipMuted}>{src}</span>
      </td>
      <td style={tdLeft}>{bucketLabel(l.bucket) ? <span style={{ ...chip('var(--bg-amber-tint)', 'var(--text-amber-800)', false), marginLeft: 0 }}>{bucketLabel(l.bucket)}</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
      <td style={{ ...td, fontWeight: 600 }}>{money2(l.usd)}</td>
    </tr>
  )
}

export function OverheadPeopleCellModal({ table, person, unattributed, column, labor, parts, onColumnChange, onClose }: Props) {
  const [order, setOrder] = useState<OverheadCellOrder>('newest')
  const [filter, setFilter] = useState('')
  const [bidLabelById, setBidLabelById] = useState<ReadonlyMap<string, string>>(new Map())
  const [copied, setCopied] = useState(false)
  const model: OverheadPeopleCellModel = useMemo(
    () => buildOverheadPeopleCellModel({ table, person, unattributed, column, labor, parts, order, filter, bidLabelById }),
    [table, person, unattributed, column, labor, parts, order, filter, bidLabelById],
  )
  const pool = person == null
  const rowTotals = pool ? table.totals : table.rows.find((r) => (unattributed ? r.unattributed : !r.unattributed && r.name === person))

  // Bid labels for the bid-labor lines, fetched once per set of ids; fail-soft to "Bid".
  useEffect(() => {
    const missing = model.bidIds.filter((id) => !bidLabelById.has(id))
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const rows = (await withSupabaseRetry(async () => supabase.from('bids').select('id, bid_number, project_name').in('id', missing), 'overhead cell bid labels')) as Array<{ id: string; bid_number: string | null; project_name: string | null }> | null
        if (cancelled || !rows) return
        setBidLabelById((prev) => {
          const next = new Map(prev)
          for (const r of rows) next.set(r.id, `${r.bid_number ? `B${String(r.bid_number).replace(/^B/i, '')}` : 'Bid'}${r.project_name ? ` ${r.project_name.trim()}` : ''}`)
          for (const id of missing) if (!next.has(id)) next.set(id, 'Bid')
          return next
        })
      } catch {
        if (!cancelled) setBidLabelById((prev) => { const next = new Map(prev); for (const id of missing) next.set(id, 'Bid'); return next })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [model.bidIds, bidLabelById])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = `${pool ? 'Everyone' : unattributed ? 'No person' : person} · ${OVERHEAD_PEOPLE_CELL_COLUMNS.find((c) => c.key === column)?.label ?? ''}`
  const windowLabel = table.days === 1 ? formatStagesNextDateLabel(table.endYmd) : `${formatStagesNextDateLabel(table.startYmd)} → ${formatStagesNextDateLabel(table.endYmd)} · ${table.days} days`
  const mathLine =
    column === 'officePartsUsd'
      ? `${model.counts.lines} purchase${model.counts.lines === 1 ? '' : 's'}`
      : model.hours > 0 && model.avgRateUsd != null
        ? `${model.hours.toFixed(1)} h × ${money2(model.avgRateUsd)}/h average${column === 'totalUsd' && model.sections.some((s) => s.kind === 'parts' && s.lineCount > 0) ? ' + purchases' : ''}`
        : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(overheadPeopleCellCsv(model, bidLabelById))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — the button simply stays */
    }
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="overhead-people-cell-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div onMouseDown={stop} style={{ background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 10, width: 'min(900px, 100%)', maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem 0.6rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2 id="overhead-people-cell-title" style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{windowLabel}</span>
            <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, marginLeft: 'auto', padding: '0.1rem 0.5rem' }}>
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: COL_COLOR[column] }}>{money2(model.cellUsd)}</span>
            {mathLine ? <span style={{ color: 'var(--text-700)', fontSize: '0.85rem' }}>{mathLine}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label="Column">
            {OVERHEAD_PEOPLE_CELL_COLUMNS.map((c) => {
              const v = rowTotals ? rowTotals[c.key] : 0
              const on = c.key === column
              const disabled = !(v > 0) || (unattributed && c.key !== 'officePartsUsd' && c.key !== 'totalUsd')
              return (
                <button key={c.key} type="button" aria-pressed={on} disabled={disabled} onClick={() => onColumnChange(c.key)} style={{ ...pillBase, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer', ...(on ? { borderColor: 'transparent', fontWeight: 700, background: c.key === 'totalUsd' ? 'var(--text-strong)' : 'var(--bg-muted)', color: c.key === 'totalUsd' ? 'var(--surface)' : COL_COLOR[c.key] } : {}) }}>
                  {c.label} · {v > 0 ? money(v) : '—'}
                </button>
              )
            })}
          </div>
          {model.counts.pending + model.counts.noWage + model.counts.long + model.counts.stray + model.counts.noPerson > 0 ? (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
              {model.counts.pending > 0 ? (
                <span style={{ ...chipWarn, marginLeft: 0, padding: '0.05rem 0.5rem' }}>
                  ⏳ {model.counts.pending} session{model.counts.pending === 1 ? '' : 's'} awaiting approval — counted as recorded time ·{' '}
                  <Link to="/people?tab=hours" style={{ color: 'inherit', fontWeight: 700 }}>
                    review in People → Hours
                  </Link>
                </span>
              ) : null}
              {model.counts.noWage > 0 ? (
                <span style={{ ...chipWarn, marginLeft: 0, padding: '0.05rem 0.5rem' }}>
                  {model.counts.noWage} session{model.counts.noWage === 1 ? '' : 's'} with no wage on file — hours count, dollars read $0 ·{' '}
                  <Link to="/people?tab=pay_stubs" style={{ color: 'inherit', fontWeight: 700 }}>
                    set in Pay config
                  </Link>
                </span>
              ) : null}
              {model.counts.long > 0 ? <span style={{ ...chipWarn, marginLeft: 0, padding: '0.05rem 0.5rem' }}>{model.counts.long} session{model.counts.long === 1 ? '' : 's'} over 10 h — forgotten clock-outs read here until fixed</span> : null}
              {model.counts.stray > 0 ? <span style={{ ...chipMuted, marginLeft: 0, padding: '0.05rem 0.5rem' }}>{model.counts.stray} stray {model.counts.stray === 1 ? 'punch' : 'punches'} under 15 min — real time, just noisy</span> : null}
              {model.counts.noPerson > 0 ? (
                <span style={{ ...chipMuted, marginLeft: 0, padding: '0.05rem 0.5rem' }}>
                  {model.counts.noPerson} line{model.counts.noPerson === 1 ? '' : 's'} with no card, so no person ·{' '}
                  <Link to="/banking?tab=accounting" style={linkStyle}>
                    Banking → Accounting
                  </Link>
                </span>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a note, bid, or merchant…" aria-label="Filter lines" style={{ flex: 1, minWidth: '10rem', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.25rem 0.5rem', fontFamily: 'inherit', fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-strong)' }} />
            <span role="group" aria-label="Order" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['newest', 'largest'] as const).map((o, i) => (
                <button key={o} type="button" aria-pressed={order === o} onClick={() => setOrder(o)} style={{ border: 0, borderRight: i === 0 ? '1px solid var(--border)' : 0, background: order === o ? 'var(--bg-blue-tint)' : 'transparent', color: order === o ? 'var(--text-blue-800)' : 'var(--text-muted)', fontWeight: order === o ? 700 : 500, fontFamily: 'inherit', fontSize: '0.78rem', padding: '0.2rem 0.55rem', cursor: 'pointer' }}>
                  {o === 'newest' ? 'Newest first' : 'Largest first'}
                </button>
              ))}
            </span>
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: '0.25rem 1rem 0.75rem', flex: 1 }}>
          {model.sections.map((sec) => (
            <div key={sec.kind}>
              {column === 'totalUsd' ? (
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginTop: '0.9rem', fontWeight: 700, color: SECTION_COLOR[sec.kind] }}>
                  {sec.label}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.78rem' }}>
                    {sec.lineCount} line{sec.lineCount === 1 ? '' : 's'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{money2(sec.usd)}</span>
                </div>
              ) : null}
              {sec.groups.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0' }}>{filter ? 'Nothing matches the filter here.' : 'Nothing in this window.'}</p>
              ) : (
                sec.groups.map((g) => {
                  const maxG = Math.max(1, ...sec.groups.map((x) => x.usd))
                  return (
                    <details key={g.key} open={!pool || !!filter} style={{ marginTop: '0.6rem' }}>
                      <summary style={{ cursor: 'pointer', listStyle: 'none', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', padding: '0.35rem 0 0.2rem', borderBottom: '1px solid var(--border-strong)', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{pool ? g.title : `Week of ${formatStagesNextDateLabel(g.key)}`}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {sec.kind === 'parts' ? `${g.lines.length} purchase${g.lines.length === 1 ? '' : 's'}` : `${(g.days ?? []).length} day${(g.days ?? []).length === 1 ? '' : 's'} · ${g.lines.length} punch${g.lines.length === 1 ? '' : 'es'}`}
                            {g.hours > 0 ? ` · ${g.hours.toFixed(1)} h` : ''}
                            {g.flagged > 0 ? <span style={{ color: 'var(--text-amber-800)' }}> · {g.flagged} to review</span> : null}
                          </span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money2(g.usd)}</span>
                          <div style={{ flexBasis: '100%', height: 4, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                            <div style={{ width: `${Math.round((100 * g.usd) / maxG)}%`, height: '100%', background: SECTION_COLOR[sec.kind], borderRadius: 2 }} />
                          </div>
                        </div>
                      </summary>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          {sec.kind === 'parts' ? (
                            <tr>
                              <th style={{ ...th, textAlign: 'left' }}>Day</th>
                              {pool ? <th style={{ ...th, textAlign: 'left' }}>Person</th> : null}
                              <th style={{ ...th, textAlign: 'left' }}>Purchase</th>
                              <th style={{ ...th, textAlign: 'left' }}>Section</th>
                              <th style={th}>$</th>
                            </tr>
                          ) : (
                            <tr>
                              <th style={{ ...th, textAlign: 'left' }}>Day</th>
                              {pool ? <th style={{ ...th, textAlign: 'left' }}>Person</th> : null}
                              <th style={{ ...th, textAlign: 'left' }}>Session</th>
                              <th style={th}>Hours</th>
                              <th style={th}>Rate</th>
                              <th style={th}>$</th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {sec.kind === 'parts'
                            ? g.lines.map((l) => (l.kind === 'purchase' ? <PurchaseRow key={l.id} l={l} showPerson={pool} /> : null))
                            : (g.days ?? []).map((d) => <DayRow key={`${d.ymd}|${d.person}`} d={d} showPerson={pool} bidLabelById={bidLabelById} />)}
                        </tbody>
                      </table>
                    </details>
                  )
                })
              )}
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-700)' }}>
          <span>
            {model.counts.lines} {column === 'officePartsUsd' ? (model.counts.lines === 1 ? 'purchase' : 'purchases') : model.counts.lines === 1 ? 'line' : 'lines'}
            {filter && model.counts.shown !== model.counts.lines ? ` · ${model.counts.shown} shown` : ''}
          </span>
          <span style={{ color: model.ties ? 'var(--text-green-700)' : 'var(--text-red-700)', fontWeight: 700 }}>{model.ties ? `sum ${money2(model.sumUsd)} · ties to the cell` : `sum ${money2(model.sumUsd)} · off by ${money2(model.sumUsd - model.cellUsd)} — tell a dev`}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => void copy()} style={btn}>
              {copied ? 'Copied' : 'Copy as CSV'}
            </button>
            <Link to="/people?tab=hours" style={{ ...linkStyle, alignSelf: 'center' }}>
              People → Hours
            </Link>
          </span>
        </div>
      </div>
    </div>
  )
}
