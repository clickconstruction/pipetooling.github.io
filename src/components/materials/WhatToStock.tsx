import { useMemo, useState, type CSSProperties } from 'react'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import type { PurchaseData } from '../../lib/materials/lines/purchaseLinesIo'
import { dollarsWords } from '../../lib/materials/lines/whatWeBuy'
import { atATimeWords, STOCK_MIN_TRIPS, STOCK_WINDOWS, WHAT_TO_STOCK_LIMITS, whatToStock, whereWords, type StockWindow } from '../../lib/materials/lines/whatToStock'

/** Rows drawn before the press that shows the rest. */
const ROWS_AT_FIRST = 50

/**
 * What to stock (punch list #298 PR 4c, v2.7118; frame I of the card's mock-up): the parts the company keeps going
 * back for, bought on many separate days in small counts, ranked by trips since the trip is what stock would save.
 * The two limits are on the page: a purchase is not a use, and big-box card purchases are not here. A row's name
 * opens its prices bill by bill. The ranking is `whatToStock.ts`.
 */
export function WhatToStock({ data, onOpenPrice }: { data: PurchaseData; /** Opens Price over time on a row. */ onOpenPrice: (rowKey: string) => void }) {
  const today = useMemo(() => todayYmdInAppTz(), [])
  const [windowDays, setWindowDays] = useState<StockWindow>(90)
  const [showAll, setShowAll] = useState(false)

  const jobsOfBill = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const s of data.shares) m.set(s.invoiceId, [...(m.get(s.invoiceId) ?? []), s.jobId])
    return m
  }, [data])
  const all = useMemo(
    () => whatToStock({ lines: data.lines, teaches: data.teaches, partNames: data.partNames, houseNames: data.houseNames, jobsOfBill, counterBills: data.counterBills, todayYmd: today, windowDays }),
    [data, jobsOfBill, today, windowDays],
  )
  const rows = showAll ? all : all.slice(0, ROWS_AT_FIRST)
  const more = all.length - rows.length
  const longest = STOCK_WINDOWS[STOCK_WINDOWS.length - 1]!

  const control: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem' }
  const cell: CSSProperties = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem', textAlign: 'left' }
  const head: CSSProperties = { ...cell, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }
  const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  const limit: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }

  return (
    <div data-testid="what-to-stock">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-strong)' }}>What we keep going back for</h3>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Parts bought on {STOCK_MIN_TRIPS} or more separate days, the last {windowDays} days. Ranked by trips, since the trip is what stock would save.
          </div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Window
          <select
            aria-label="Window"
            value={windowDays}
            onChange={(e) => {
              setWindowDays(Number(e.target.value) as StockWindow)
              setShowAll(false)
            }}
            style={control}
          >
            {STOCK_WINDOWS.map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
        </label>
      </div>

      {all.length === 0 ? (
        <EmptyState
          main={`Nothing was bought on ${STOCK_MIN_TRIPS} separate days in the last ${windowDays} days.`}
          next={windowDays < longest ? { label: `Look at ${longest} days`, onPress: () => setWindowDays(longest) } : undefined}
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={head}>Part</th>
                <th style={{ ...head, ...right }}>Trips</th>
                <th style={{ ...head, ...right }}>At a time</th>
                <th style={{ ...head, ...right }}>Jobs</th>
                <th style={{ ...head, ...right }}>Spent</th>
                <th style={head}>Where</th>
                <th style={head}>Read as</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} data-testid="what-to-stock-row">
                  <td style={{ ...cell, minWidth: 200 }}>
                    <button type="button" title="See what was paid for it, bill by bill" onClick={() => onOpenPrice(r.key)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-strong)', textDecoration: 'underline', textAlign: 'left', cursor: 'pointer' }}>
                      {r.name}
                    </button>
                    {r.byCode ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>no part yet · {r.byCode}</div> : null}
                  </td>
                  <td style={{ ...cell, ...right, fontWeight: 600 }}>{r.trips.toLocaleString('en-US')}</td>
                  <td style={{ ...cell, ...right }}>{atATimeWords(r.atATime)}{r.unit ? ` ${r.unit}` : ''}</td>
                  <td style={{ ...cell, ...right }}>{r.jobs.toLocaleString('en-US')}</td>
                  <td style={{ ...cell, ...right }}>{dollarsWords(r.spendCents)}</td>
                  <td style={{ ...cell, color: 'var(--text-muted)' }}>{whereWords(r)}</td>
                  <td style={cell}>{r.readAs}</td>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.9rem' }}>
        <div style={limit} data-testid="what-to-stock-limit-purchases"><b style={{ color: 'var(--text-base)' }}>What this can and cannot say.</b> {WHAT_TO_STOCK_LIMITS.purchases}</div>
        <div style={limit} data-testid="what-to-stock-limit-big-box"><b style={{ color: 'var(--text-base)' }}>Big-box card purchases are not here.</b> {WHAT_TO_STOCK_LIMITS.bigBox.replace(/^Card purchases at big-box stores are not here\. /, '')}</div>
      </div>
    </div>
  )
}
