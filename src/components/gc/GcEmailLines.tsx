import type { CSSProperties } from 'react'
import { gcEmailBlocks, gcEmailCellIsFigure } from '../../../supabase/functions/_shared/gcCustomerEmails'

/**
 * An email's lines as the office reads them before a send (v2.6158, punch list #217 outside-5): a paragraph a line,
 * and a run of table lines (`gcEmailTableLines`, the interest bill's rows) as one table, the way `gc-customer-email`
 * frames them for the customer.
 */
const th: CSSProperties = { padding: '0.25rem 0.4rem', borderBottom: '2px solid var(--border-strong)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }
const td: CSSProperties = { padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const sum: CSSProperties = { padding: '0.4rem 0.4rem', borderTop: '2px solid var(--border-strong)', fontWeight: 700 }

export function GcEmailLines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {gcEmailBlocks(lines).map((b, bi) => {
        if (b.kind === 'p') return <div key={bi}>{b.text}</div>
        const [head, ...body] = b.rows
        if (!head) return null
        const rows = body.filter((r) => !r.sum)
        const figure = head.cells.map((_, i) => rows.some((r) => (r.cells[i] ?? '') !== '') && rows.every((r) => (r.cells[i] ?? '') === '' || gcEmailCellIsFigure(r.cells[i] ?? '')))
        const align = (i: number): CSSProperties => ({ textAlign: figure[i] ? 'right' : 'left', whiteSpace: figure[i] ? 'nowrap' : undefined })
        return (
          <table key={bi} data-testid="gc-email-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                {head.cells.map((c, i) => (
                  <th key={i} style={{ ...th, ...align(i) }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) =>
                r.sum ? (
                  <tr key={ri}>
                    <td colSpan={Math.max(1, r.cells.length - r.cells.slice(1).filter((c) => c !== '').length)} style={sum}>
                      {r.cells[0]}
                    </td>
                    {r.cells.slice(1).map((c, i) => (c !== '' ? <td key={i} style={{ ...sum, ...align(i + 1) }}>{c}</td> : null))}
                  </tr>
                ) : (
                  <tr key={ri}>
                    {r.cells.map((c, i) => (
                      <td key={i} style={{ ...td, ...align(i) }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )
      })}
    </>
  )
}
