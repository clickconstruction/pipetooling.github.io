import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { BookPrice, PurchaseData, PurchaseLinesIo } from '../../lib/materials/lines/purchaseLinesIo'
import { priceWords, quantityWords, type BuyRow } from '../../lib/materials/lines/whatWeBuy'
import { bookIsStale, bookLine, changeWords, dayAt, dayWords, houseSeries, lastPaidByHouse, priceAt, pricePoints, priceScale, type PricePoint } from '../../lib/materials/lines/priceOverTime'

/** Purchases listed before the press that shows the rest. */
const POINTS_AT_FIRST = 25
/** Matches the picker offers at once. */
const PICKS_SHOWN = 8

const SERIES = ['var(--house-series-1)', 'var(--house-series-2)', 'var(--house-series-3)'] as const
const OTHER = 'var(--text-faint)'

const W = 720
const H = 250
const PAD = { left: 56, right: 16, top: 14, bottom: 28 }

/**
 * Price over time (punch list #298 PR 4b, v2.7116; frame H of the card's mock-up): one row of What we buy, every
 * purchase a point. Each of the company's three biggest houses has its own colour and every other house the muted
 * mark, the book's price is the dashed line with the day it was checked, and the purchases are listed under the
 * chart, so nothing is said by colour alone. The points and the scale are `priceOverTime.ts`.
 */
export function PriceOverTime({ data, io, rows, rowKey, onPick }: {
  data: PurchaseData
  io: Pick<PurchaseLinesIo, 'bookPrices'>
  /** Every row there is to pick, over all the months on file, the most spent first. */
  rows: readonly BuyRow[]
  rowKey: string | null
  onPick: (key: string | null) => void
}) {
  const today = useMemo(() => todayYmdInAppTz(), [])
  const [query, setQuery] = useState('')
  const [book, setBook] = useState<BookPrice[]>([])
  const [active, setActive] = useState<PricePoint | null>(null)
  const [showAll, setShowAll] = useState(false)

  const row = useMemo(() => rows.find((r) => r.key === rowKey) ?? null, [rows, rowKey])
  const jobsOfBill = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const s of data.shares) {
      const name = data.jobNames.get(s.jobId)
      if (name) m.set(s.invoiceId, [...(m.get(s.invoiceId) ?? []), name])
    }
    return m
  }, [data])
  const points = useMemo(() => (rowKey ? pricePoints({ lines: data.lines, teaches: data.teaches, rowKey, houseNames: data.houseNames, jobsOfBill }) : []), [data, rowKey, jobsOfBill])
  const series = useMemo(() => houseSeries(data.lines), [data])

  useEffect(() => {
    setBook([])
    setActive(null)
    setShowAll(false)
    const partId = row?.partId
    if (!partId) return
    let live = true
    void io.bookPrices(partId).then((b) => {
      if (live) setBook(b)
    })
    return () => {
      live = false
    }
  }, [io, row?.partId, rowKey])

  const theBook = useMemo(() => bookLine(book), [book])
  const scale = useMemo(() => priceScale(points, theBook?.price ?? null), [points, theBook])
  const lasts = useMemo(() => lastPaidByHouse(points, today), [points, today])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q ? rows.filter((r) => `${r.name} ${r.byCode}`.toLowerCase().includes(q)) : rows
    return pool.slice(0, PICKS_SHOWN)
  }, [rows, query])

  const colourOf = (houseId: string | null): string => {
    const i = houseId ? series.get(houseId) : undefined
    return i == null ? OTHER : SERIES[i]!
  }
  // The points keep clear of the price labels and the right edge: the plot is inset a point's width each side.
  const INSET = 12
  const x = (ymd: string) => (scale ? PAD.left + INSET + dayAt(scale, ymd) * (W - PAD.left - PAD.right - 2 * INSET) : 0)
  const monthMark = (ymd: string) => `${dayWords(ymd, today).split(' ')[0]}${ymd.slice(0, 4) === today.slice(0, 4) ? '' : ` ${ymd.slice(0, 4)}`}`
  const y = (price: number) => (scale ? H - PAD.bottom - priceAt(scale, price) * (H - PAD.top - PAD.bottom) : 0)

  const control: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', maxWidth: '100%' }
  const card: CSSProperties = { flex: '1 1 200px', minWidth: 0, maxWidth: 320, border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)' }
  const cardHead: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const cardFigure: CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }
  const cardNote: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const cell: CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem', textAlign: 'left' }
  const head: CSSProperties = { ...cell, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }
  const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  const swatch = (colour: string): CSSProperties => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: colour, marginRight: 6, verticalAlign: 'baseline' })

  const picker = (
    <div data-testid="price-picker" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.9rem' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.6875rem', color: 'var(--text-muted)', maxWidth: 420 }}>
        Find a part or a code
        <input type="search" aria-label="Find a part or a code" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="copper tube, 0417-2210" style={control} />
      </label>
      {matches.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          {matches.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                onPick(r.key)
                setQuery('')
              }}
              style={{ background: 'none', border: 'none', padding: '0.15rem 0', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-base)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }}
            >
              {r.name}
              {r.byCode ? <span style={{ color: 'var(--text-muted)' }}> · {r.byCode}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No part or code matches ‘{query.trim()}’.</div>
      )}
    </div>
  )

  if (!row) {
    return (
      <div data-testid="price-over-time">
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pick a part to see what was paid for it, bill by bill. The most spent are listed first.</p>
        {picker}
      </div>
    )
  }

  const housesHere = [...new Map(points.map((p) => [p.houseId ?? '', p])).values()]
  const named = housesHere.filter((p) => p.houseId && series.has(p.houseId)).sort((a, b) => series.get(a.houseId!)! - series.get(b.houseId!)!)
  const others = housesHere.filter((p) => !p.houseId || !series.has(p.houseId))
  const listed = showAll ? points : points.slice(0, POINTS_AT_FIRST)
  const more = points.length - listed.length
  const first = points[points.length - 1]

  return (
    <div data-testid="price-over-time">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-strong)' }}>{row.name}</h3>
        {row.byCode ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>no part yet · {row.byCode}</span> : null}
        <button type="button" onClick={() => onPick(null)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-base)', textDecoration: 'underline', cursor: 'pointer' }}>
          Pick another
        </button>
      </div>

      {points.length === 0 || !scale ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No bill prints a price for this one yet, so there is no point to draw.</p>
      ) : (
        <>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {points.length.toLocaleString('en-US')} {points.length === 1 ? 'purchase' : 'purchases'} since {first ? dayWords(first.datedOn, today) : ''} · every purchase is a point
          </div>

          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }} data-testid="price-legend">
            {named.map((p) => (
              <span key={p.houseId}><span aria-hidden style={swatch(colourOf(p.houseId))} />{p.houseName}</span>
            ))}
            {others.length > 0 ? <span><span aria-hidden style={swatch(OTHER)} />{others.length === 1 && named.length === 0 ? others[0]!.houseName : 'Other houses'}</span> : null}
            {theBook ? <span><span aria-hidden style={{ display: 'inline-block', width: 16, borderTop: '2px dashed var(--text-muted)', marginRight: 6, verticalAlign: 'middle' }} />The book</span> : null}
          </div>

          {/* The chart sits on the surface its colours were checked against. */}
          <div style={{ maxWidth: W + 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem 0.25rem', overflowX: 'auto' }}>
            {/* On a phone the chart keeps a width its labels can be read at and scrolls inside its card. */}
            <div style={{ position: 'relative', minWidth: 480 }}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${row.name}: ${points.length} purchases, from ${priceWords(Math.min(...points.map((p) => p.priceEach)))} to ${priceWords(Math.max(...points.map((p) => p.priceEach)))} for one. The purchases are listed under the chart.`} style={{ display: 'block', width: '100%', height: 'auto' }}>
              {scale.ticks.map((t, i) => (
                <g key={i}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{priceWords(t)}</text>
                </g>
              ))}
              {scale.monthMarks.map((m) => (
                <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{monthMark(m)}</text>
              ))}
              {theBook ? (
                <g data-testid="price-book-line">
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(theBook.price)} y2={y(theBook.price)} stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="6 5" />
                  <text x={W - PAD.right} y={y(theBook.price) - 6} textAnchor="end" fontSize={11} fill="var(--text-muted)">
                    the book: {priceWords(theBook.price)}{theBook.checkedOn ? `, checked ${dayWords(theBook.checkedOn, today)}` : ''}
                  </text>
                </g>
              ) : null}
              {/* Oldest first, so the newest point sits on top; each wears a ring of the surface where two overlap. */}
              {[...points].reverse().map((p) => (
                <g key={p.lineId}>
                  <circle cx={x(p.datedOn)} cy={y(p.priceEach)} r={active?.lineId === p.lineId ? 6.5 : 5} fill={colourOf(p.houseId)} stroke="var(--surface)" strokeWidth={2} />
                  <circle
                    data-testid="price-point"
                    cx={x(p.datedOn)}
                    cy={y(p.priceEach)}
                    r={13}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${dayWords(p.datedOn, today)}, ${p.houseName}, ${priceWords(p.priceEach)} for one, ${p.quantity.toLocaleString('en-US')} ${p.unit}`.trim()}
                    onMouseEnter={() => setActive(p)}
                    onMouseLeave={() => setActive((a) => (a?.lineId === p.lineId ? null : a))}
                    onFocus={() => setActive(p)}
                    onBlur={() => setActive((a) => (a?.lineId === p.lineId ? null : a))}
                    style={{ outline: 'none', cursor: 'default' }}
                  />
                </g>
              ))}
            </svg>
            {active ? (
              <div
                role="status"
                data-testid="price-tip"
                style={{ position: 'absolute', left: `${Math.min(78, Math.max(2, (x(active.datedOn) / W) * 100))}%`, top: `${Math.max(0, (y(active.priceEach) / H) * 100 - 26)}%`, pointerEvents: 'none', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.3rem 0.5rem', fontSize: '0.75rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}
              >
                <b>{priceWords(active.priceEach)}</b> · {dayWords(active.datedOn, today)} · {active.houseName} · {active.quantity.toLocaleString('en-US')} {active.unit}
              </div>
            ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', margin: '0.75rem 0 0.9rem' }}>
            {lasts.map((h) => (
              <div key={h.houseId ?? 'none'} style={card} data-testid="price-last-paid">
                <div style={cardHead}><span aria-hidden style={swatch(colourOf(h.houseId))} />Last paid · {h.houseName}</div>
                <div style={cardFigure}>{priceWords(h.priceEach)}</div>
                <div style={cardNote}>
                  {dayWords(h.datedOn, today)}
                  {h.change != null && h.sinceYmd ? ` · ${changeWords(h.change)} since ${dayWords(h.sinceYmd, today)}` : ''}
                  {h.cheapest ? ' · cheapest these 90 days' : ''}
                </div>
              </div>
            ))}
            {theBook ? (
              <div style={card} data-testid="price-book">
                <div style={cardHead}>The book</div>
                <div style={cardFigure}>{priceWords(theBook.price)}</div>
                <div style={cardNote}>
                  {theBook.checkedOn ? `checked ${dayWords(theBook.checkedOn, today)}` : 'never checked'}
                  {data.houseNames.get(theBook.houseId) ? ` · ${data.houseNames.get(theBook.houseId)}` : ''}
                  {bookIsStale(theBook.checkedOn, today) ? ' · stale' : ''}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={head}>Day</th>
                  <th style={head}>House</th>
                  <th style={head}>Bill</th>
                  <th style={{ ...head, ...right }}>Quantity</th>
                  <th style={{ ...head, ...right }}>For one</th>
                  <th style={head}>Job</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((p) => (
                  <tr key={p.lineId} data-testid="price-row">
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{dayWords(p.datedOn, today)}</td>
                    <td style={cell}><span aria-hidden style={swatch(colourOf(p.houseId))} />{p.houseName}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{p.billNumber}</td>
                    <td style={{ ...cell, ...right }}>{quantityWords({ quantity: p.quantity, unit: p.unit, mixedUnits: false })}</td>
                    <td style={{ ...cell, ...right, fontWeight: 600 }}>{priceWords(p.priceEach)}</td>
                    <td style={{ ...cell, color: 'var(--text-muted)' }}>{p.jobs.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {more > 0 ? (
            <div style={{ marginTop: '0.6rem' }}>
              <button type="button" onClick={() => setShowAll(true)} style={{ ...control, cursor: 'pointer' }}>
                Show {more.toLocaleString('en-US')} more {more === 1 ? 'purchase' : 'purchases'}
              </button>
            </div>
          ) : null}
        </>
      )}

      <div style={{ marginTop: '0.9rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        A price is the bill’s price for one, through its pricing unit. Where the part has a house’s unit on file, a stick and a foot land on one scale. A return is not a price paid and is left out.
      </div>
    </div>
  )
}
