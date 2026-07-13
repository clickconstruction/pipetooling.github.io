import { computeWeekdayCostTotals } from '../../lib/people/computeWeekdayCostTotals'

export interface WeekdayCostRow {
  label: string
  byDay: number[]
  total: number
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const fmtDollars = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

/** Person × weekday cost grid with per-column and grand totals (shared by Teams + the due-summaries ledger modals). */
export function WeekdayCostTable({
  rows,
  fontSize = '0.75rem',
  marginTop,
}: {
  rows: WeekdayCostRow[]
  fontSize?: string
  marginTop?: string
}) {
  const { columnTotals, grandTotal } = computeWeekdayCostTotals(rows)
  return (
    <table style={{ width: '100%', marginTop, fontSize, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
          {WEEKDAY_NAMES.map((name) => (
            <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
          ))}
          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} style={{ borderBottom: '1px solid var(--bg-muted)' }}>
            <td style={{ padding: '0.2rem 0.5rem' }}>{row.label}</td>
            {WEEKDAY_NAMES.map((name, i) => (
              <td key={name} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>{fmtDollars(row.byDay[i] ?? 0)}</td>
            ))}
            <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>{fmtDollars(row.total)}</td>
          </tr>
        ))}
        <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600 }}>
          <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
          {columnTotals.map((val, i) => (
            <td key={WEEKDAY_NAMES[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>{fmtDollars(val)}</td>
          ))}
          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>{fmtDollars(grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  )
}
