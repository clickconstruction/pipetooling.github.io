import { useMemo, useState } from 'react'
import {
  OVERHEAD_PEOPLE_WINDOWS,
  buildOverheadPeopleTable,
  overheadPeopleShare,
  type OverheadPeopleLaborInput,
  type OverheadPeoplePartsInput,
  type OverheadPeopleWindowKey,
} from '../../lib/overheadPeopleTable'

/**
 * People → Overhead "who makes up overhead" table (v2.2675). Presentational:
 * the tab passes the 90-day labor detail lines and person-resolved parts
 * lines its KPI effect already holds; the window chips slice them client-side
 * (no refetch). Every cell shows the amount and its share of the column.
 */

const money = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`
const pct = (share: number | null): string => (share == null ? '—' : `${Math.round(share * 100)}%`)
const hrs = (h: number): string => `${(Math.round(h * 10) / 10).toLocaleString('en-US')}h`

const COLS = [
  { key: 'officeLaborUsd', label: 'Office labor', color: '#8b5cf6' },
  { key: 'bidLaborUsd', label: 'Bid labor', color: 'var(--text-blue-500)' },
  { key: 'officePartsUsd', label: 'Office parts', color: '#f59e0b' },
  { key: 'totalUsd', label: 'Total', color: 'var(--text-strong)' },
] as const

const cellStyle = {
  padding: '0.4rem 0.6rem',
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
  fontVariantNumeric: 'tabular-nums' as const,
  borderBottom: '1px solid var(--border)',
}

export function OverheadPeopleTable({
  labor,
  parts,
  endYmd,
  loading,
}: {
  labor: ReadonlyArray<OverheadPeopleLaborInput>
  parts: ReadonlyArray<OverheadPeoplePartsInput>
  endYmd: string | null
  loading: boolean
}) {
  const [windowKey, setWindowKey] = useState<OverheadPeopleWindowKey>('week')
  const win = OVERHEAD_PEOPLE_WINDOWS.find((w) => w.key === windowKey) ?? OVERHEAD_PEOPLE_WINDOWS[1]
  const days = win?.days ?? 7
  const table = useMemo(
    () => (endYmd ? buildOverheadPeopleTable({ labor, parts, endYmd, days }) : null),
    [labor, parts, endYmd, days],
  )

  const cell = (value: number, columnTotal: number, strong = false) => {
    const share = overheadPeopleShare(value, columnTotal)
    return (
      <td style={cellStyle}>
        <span style={{ fontWeight: strong ? 700 : 500, color: value > 0 ? 'var(--text-strong)' : 'var(--text-faint)' }}>
          {value > 0 ? money(value) : '—'}
        </span>
        {value > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct(share)}</span>}
      </td>
    )
  }

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.6rem 0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>Who makes up overhead</strong>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {table ? (table.days === 1 ? table.endYmd : `${table.startYmd} → ${table.endYmd}`) : ''}
        </span>
        <div role="group" aria-label="Window" style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {OVERHEAD_PEOPLE_WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={w.key === windowKey}
              onClick={() => setWindowKey(w.key)}
              style={{
                border: 0,
                borderRight: '1px solid var(--border)',
                background: w.key === windowKey ? 'var(--bg-blue-tint)' : 'transparent',
                color: w.key === windowKey ? 'var(--text-blue-800)' : 'var(--text-muted)',
                fontWeight: w.key === windowKey ? 700 : 500,
                font: 'inherit',
                fontSize: '0.8125rem',
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !table ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{loading ? 'Loading…' : '—'}</div>
      ) : table.rows.length === 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          Nothing in the pool for {(win?.label ?? 'this window').toLowerCase()} — no approved office or bid sessions and no office-job purchases.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.3rem 0.6rem', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  Person
                </th>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    style={{ textAlign: 'right', padding: '0.3rem 0.6rem', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: c.color, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', color: r.unattributed ? 'var(--text-muted)' : 'var(--text-strong)', fontStyle: r.unattributed ? 'italic' : 'normal' }}>
                    {r.name}
                    {r.hours > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'normal' }}>{hrs(r.hours)}</span>}
                  </td>
                  {cell(r.officeLaborUsd, table.totals.officeLaborUsd)}
                  {cell(r.bidLaborUsd, table.totals.bidLaborUsd)}
                  {cell(r.officePartsUsd, table.totals.officePartsUsd)}
                  {cell(r.totalUsd, table.totals.totalUsd, true)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                  Pool
                  {table.totals.hours > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{hrs(table.totals.hours)}</span>}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} style={{ ...cellStyle, borderBottom: 0, fontWeight: 700, color: 'var(--text-strong)' }}>
                    {table.totals[c.key] > 0 ? money(table.totals[c.key]) : '—'}
                    {table.totals[c.key] > 0 && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {c.key === 'totalUsd' ? '100%' : pct(overheadPeopleShare(table.totals[c.key], table.totals.totalUsd))}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
        Percentages are each person's share of that column; the Pool row shows each column's share of the whole. Card purchases attribute by card
        nickname; supply invoices, ACH/wire, and tally lines have no person and sit on the last row so the columns still sum to the pool.
      </p>
    </div>
  )
}
