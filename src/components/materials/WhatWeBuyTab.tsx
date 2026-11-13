import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { PurchaseData, PurchaseLinesIo } from '../../lib/materials/lines/purchaseLinesIo'
import type { HeldBillsIo } from '../../lib/materials/lines/heldBillsIo'
import { heldBills } from '../../lib/materials/lines/heldBills'
import { defaultSpan, dollarsWords, monthWords, priceWords, quantityWords, timesWords, WHAT_WE_BUY_FOOT, whatWeBuy, type BuyFilters, type BuyRow, type BuySort } from '../../lib/materials/lines/whatWeBuy'

/** Rows drawn before the press that shows the rest. */
const ROWS_AT_FIRST = 100

const SORTS: { key: BuySort; label: string }[] = [
  { key: 'spend', label: 'Spend' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'often', label: 'How often' },
]

/**
 * One row's spend by month as thin bars, oldest month on the left. One series, so no legend: the column's heading
 * names it. Each bar says its month and its dollars on hover, and the whole strip reads its figures to a screen reader.
 */
function MonthBars({ values, months }: { values: readonly number[]; months: readonly string[] }) {
  const width = Math.max(48, months.length * 10)
  const height = 22
  const top = Math.max(1, ...values.map((v) => Math.abs(v)))
  const slot = width / Math.max(1, months.length)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={months.map((m, i) => `${monthWords(m)} ${dollarsWords(values[i] ?? 0)}`).join(', ')} style={{ display: 'block' }}>
      <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--border)" />
      {months.map((m, i) => {
        const v = values[i] ?? 0
        const h = v === 0 ? 0 : Math.max(2, (Math.abs(v) / top) * (height - 3))
        return (
          <g key={m}>
            {/* The hover target is the month's whole slot, taller than its bar. */}
            <rect x={i * slot} y={0} width={slot} height={height} fill="transparent">
              <title>{`${monthWords(m)}: ${dollarsWords(v)}`}</title>
            </rect>
            {h > 0 ? <rect x={i * slot + 1} y={height - 1 - h} width={Math.max(2, slot - 2)} height={h} rx={1.5} fill={v < 0 ? 'var(--text-faint)' : '#2563eb'} pointerEvents="none" /> : null}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * What we buy (punch list #298 PR 4a, v2.7114; frame G of the card's mock-up): every supply house bill's lines as
 * what the company buys. A row is a part in the book, or a house's code where no part is matched yet. The filters
 * are a house, a job and a span of months; the sort is spend, quantity or how often. Only bills whose lines add up
 * are counted, and the foot says so. The sums are `whatWeBuy.ts`; the reads are `purchaseLinesIo.ts`.
 */
export function WhatWeBuyTab({ io, heldIo }: { io: PurchaseLinesIo; /** For the *Bills not counted* figure; the page stands without it. */ heldIo?: HeldBillsIo }) {
  const [data, setData] = useState<PurchaseData | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [busy, setBusy] = useState(false)
  const [notCounted, setNotCounted] = useState<number | null>(null)
  const span = useMemo(() => defaultSpan(todayYmdInAppTz()), [])
  const [filters, setFilters] = useState<BuyFilters>(() => ({ houseId: '', jobId: '', ...span, sort: 'spend' }))
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setData(await io.load())
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'Could not read what the company buys.'))
    } finally {
      setBusy(false)
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!heldIo) return
    let live = true
    void heldIo
      .load()
      .then((d) => {
        const { standing } = heldBills(d)
        if (live) setNotCounted(standing.off + standing.held)
      })
      .catch(() => {
        // The figure is left off; the page's own read says its own failure.
      })
    return () => {
      live = false
    }
  }, [heldIo])

  const shares = useMemo(() => {
    if (!data || !filters.jobId) return undefined
    return new Map(data.shares.filter((s) => s.jobId === filters.jobId).map((s) => [s.invoiceId, s.pct / 100]))
  }, [data, filters.jobId])

  const view = useMemo(() => (data ? whatWeBuy({ lines: data.lines, teaches: data.teaches, partNames: data.partNames, houseNames: data.houseNames, shares, filters }) : null), [data, shares, filters])

  const houses = useMemo(() => (data ? [...data.houseNames.entries()].filter(([id]) => data.lines.some((l) => l.houseId === id)).sort((a, b) => a[1].localeCompare(b[1])) : []), [data])
  const jobs = useMemo(() => (data ? [...data.jobNames.entries()].sort((a, b) => a[1].localeCompare(b[1])) : []), [data])

  if (failure && !data) return <OfflineRetryPanel failure={failure} onRetry={load} surface="what-we-buy" idempotent busy={busy} />
  if (!data || !view) return <p style={{ color: 'var(--text-muted)' }}>Reading the bills’ lines…</p>

  const set = (patch: Partial<BuyFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setShowAll(false)
  }
  const filtered = filters.houseId !== '' || filters.jobId !== '' || filters.fromMonth !== span.fromMonth || filters.toMonth !== span.toMonth
  const clear = () => set({ houseId: '', jobId: '', ...span })
  const rows = showAll ? view.rows : view.rows.slice(0, ROWS_AT_FIRST)
  const more = view.rows.length - rows.length

  const control: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', maxWidth: '100%' }
  const label: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: 0 }
  const tile: CSSProperties = { flex: '1 1 170px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)' }
  const tileHead: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const tileFigure: CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }
  const tileNote: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const cell: CSSProperties = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem', textAlign: 'left' }
  const head: CSSProperties = { ...cell, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }
  const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

  const partCell = (r: BuyRow) => (
    <td style={{ ...cell, minWidth: 200 }}>
      <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{r.name}</div>
      {r.byCode ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>no part yet · {r.byCode}</div> : null}
    </td>
  )

  return (
    <div data-testid="what-we-buy">
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <label style={label}>
          House
          <select aria-label="House" value={filters.houseId} onChange={(e) => set({ houseId: e.target.value })} style={control}>
            <option value="">All houses</option>
            {houses.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label style={label}>
          Job
          <select aria-label="Job" value={filters.jobId} onChange={(e) => set({ jobId: e.target.value })} style={{ ...control, maxWidth: 260 }}>
            <option value="">All jobs</option>
            {jobs.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label style={label}>
          From
          <input type="month" aria-label="From month" value={filters.fromMonth} max={filters.toMonth} onChange={(e) => e.target.value && set({ fromMonth: e.target.value })} style={control} />
        </label>
        <label style={label}>
          To
          <input type="month" aria-label="To month" value={filters.toMonth} min={filters.fromMonth} onChange={(e) => e.target.value && set({ toMonth: e.target.value })} style={control} />
        </label>
        <div style={label}>
          Sort
          <div role="group" aria-label="Sort" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={filters.sort === s.key}
                onClick={() => set({ sort: s.key })}
                style={{ padding: '0.35rem 0.6rem', border: 'none', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', background: filters.sort === s.key ? '#2563eb' : 'var(--surface)', color: filters.sort === s.key ? '#fff' : 'var(--text-base)' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <div style={tile} data-testid="what-we-buy-parts">
          <div style={tileHead}>Spent on parts</div>
          <div style={tileFigure}>{dollarsWords(view.summary.partsCents)}</div>
          <div style={tileNote}>on {view.summary.bills.toLocaleString('en-US')} {view.summary.bills === 1 ? 'bill that adds up' : 'bills that add up'}</div>
        </div>
        <div style={tile} data-testid="what-we-buy-charges">
          <div style={tileHead}>Charges</div>
          <div style={tileFigure}>{dollarsWords(view.summary.chargesCents)}</div>
          <div style={tileNote}>freight, fuel, fees</div>
        </div>
        <div style={tile} data-testid="what-we-buy-distinct">
          <div style={tileHead}>Distinct parts</div>
          <div style={tileFigure}>{view.summary.rows.toLocaleString('en-US')}</div>
          <div style={tileNote}>{view.summary.byCodeOnly.toLocaleString('en-US')} by code only, no part yet</div>
        </div>
        {notCounted != null && notCounted > 0 ? (
          <div style={tile} data-testid="what-we-buy-not-counted">
            <div style={tileHead}>Bills not counted</div>
            <div style={tileFigure}>{notCounted.toLocaleString('en-US')}</div>
            <div style={tileNote}>
              each with a reason on <Link to="/materials?tab=supply-houses" style={{ color: 'var(--text-blue-500)' }}>Supply houses</Link>
            </div>
          </div>
        ) : null}
      </div>

      {failure ? <OfflineRetryPanel failure={failure} onRetry={load} surface="what-we-buy" idempotent busy={busy} /> : null}

      {view.rows.length === 0 ? (
        data.lines.length === 0 ? (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'bill lines', page: { label: 'Supply houses', tail: 'is where a bill is recorded.' } }), { to: '/materials?tab=supply-houses' })} />
        ) : (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'purchases', query: '' }), { onPress: clear })} />
        )
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={head}>Part</th>
                <th style={{ ...head, ...right }}>Bought</th>
                <th style={{ ...head, ...right }}>Quantity</th>
                <th style={{ ...head, ...right }}>Spend</th>
                <th style={head}>By month · {view.months.length ? `${monthWords(view.months[0]!).slice(0, 3)} to ${monthWords(view.months[view.months.length - 1]!).slice(0, 3)}` : ''}</th>
                <th style={head}>Houses</th>
                <th style={{ ...head, ...right }}>Last paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} data-testid="what-we-buy-row">
                  {partCell(r)}
                  <td style={{ ...cell, ...right }}>{timesWords(r.bills)}</td>
                  <td style={{ ...cell, ...right }}>{quantityWords(r)}</td>
                  <td style={{ ...cell, ...right, fontWeight: 600 }}>{dollarsWords(r.spendCents)}</td>
                  <td style={cell}><MonthBars values={r.byMonth} months={view.months} /></td>
                  <td style={{ ...cell, color: 'var(--text-muted)' }}>{r.houses.join(', ')}</td>
                  <td style={{ ...cell, ...right }}>{r.lastPaid ? priceWords(r.lastPaid.priceEach) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {more > 0 ? (
        <div style={{ marginTop: '0.6rem' }}>
          <button type="button" onClick={() => setShowAll(true)} style={{ ...control, cursor: 'pointer' }}>
            Show {more.toLocaleString('en-US')} more {more === 1 ? 'row' : 'rows'}
          </button>
        </div>
      ) : null}

      <div style={{ marginTop: '0.9rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {WHAT_WE_BUY_FOOT.map((line) => (
          <span key={line}>{line}</span>
        ))}
        {filtered ? (
          <span>
            <button type="button" onClick={clear} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
              Clear the filters
            </button>
          </span>
        ) : null}
      </div>
    </div>
  )
}
