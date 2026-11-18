/**
 * The aging heat map (SupplyHousesTab map, extraction step 12): unpaid dollars by days past due, a row a house.
 *
 * Moved from `SupplyHousesTab` as it stood. On a phone it is one row per house with a five-colour bar; on a desk it
 * is the table whose every money cell is a door onto the bills it sums. It draws only: the matrix is the tab's, a
 * house's row opens that house, and a cell asks the aging windows' engine to open on it.
 */
import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { formatCurrency } from '../../lib/format'
import {
  AGING_BUCKETS,
  agingCellTitle,
  buildSupplyHouseAgingMatrix,
  supplyHouseAgingPhoneNote,
  type AgingBucketKey,
  type AgingCellKey,
} from '../../lib/supplyHouseAging'
import {
} from '../../lib/materials/supplyHouseInvoiceForm'
import { EmptyState } from '../EmptyState'
import { JOB_ACCOUNT_LINE_TITLE } from '../../lib/materials/agingCellByJob'
import { SUPPLY_HOUSE_AGING_EMPTY } from '../../lib/materials/materialsEmptyWords'


/** The teal "of which on a job account" line under an aging cell (B). Saturated status colour, kept literal like the Job acct chip. */
const JOB_ACCOUNT_LINE_STYLE = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#0f766e', whiteSpace: 'nowrap' } as const

const AGING_CELL_STYLES: Record<AgingBucketKey, { background: string; color: string }> = {
  current: { background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)' },
  past1_30: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  past30_60: { background: 'var(--bg-orange-100)', color: 'var(--text-orange-800)' },
  past60_90: { background: 'var(--bg-red-100)', color: 'var(--text-red-800)' },
  past90plus: { background: 'var(--bg-red-200)', color: 'var(--text-red-900)' },
  noDueDate: { background: 'var(--bg-muted)', color: 'var(--text-600)' },
}

export interface SupplyHouseAgingMapProps {
  narrowAging: boolean
  agingMatrix: ReturnType<typeof buildSupplyHouseAgingMatrix>
  /** The credits column shows only once a credit memo is open. */
  agingHasCredits: boolean
  /** Under each cell, how much of it sits on the house's job account. */
  markJobAccountInvoices: boolean
  openHouseFromAging: (supplyHouseId: string) => void
  /** Opens the window of a cell's bills; `houseId` null is the footer row, every house. */
  setAgingCellModal: (cell: { houseId: string | null; cell: AgingCellKey | 'movable' } | null) => void
}

export function SupplyHouseAgingMap({ narrowAging, agingMatrix, agingHasCredits, markJobAccountInvoices, openHouseFromAging, setAgingCellModal }: SupplyHouseAgingMapProps) {
  /**
   * A money cell of the aging map is a door (v2.5673): click or Enter opens the invoices
   * behind it. Spread onto the `<td>`; stops the row's own open-the-house click.
   */
  function agingCellDoorProps(houseId: string | null, cell: AgingCellKey, title: string) {
    const open = () => setAgingCellModal({ houseId, cell })
    return {
      role: 'button' as const,
      tabIndex: 0,
      title,
      onClick: (e: ReactMouseEvent<HTMLTableCellElement>) => {
        e.stopPropagation()
        open()
      },
      onKeyDown: (e: ReactKeyboardEvent<HTMLTableCellElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        e.stopPropagation()
        open()
      },
    }
  }

  return narrowAging ? (
    /* Phone (v2.2191): one row per house — name · worst-news note · 5-bucket bar · total.
       The bar's five colors are the table's five aging columns, worst on the right. */
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {agingMatrix.rows.length === 0 ? (
        <EmptyState compact {...SUPPLY_HOUSE_AGING_EMPTY} />
      ) : (
        agingMatrix.rows.map((row, i) => {
          const segs = [
            { v: row.buckets.current, c: '#86efac' },
            { v: row.buckets.past1_30, c: '#fde68a' },
            { v: row.buckets.past30_60, c: '#fdba74' },
            { v: row.buckets.past60_90, c: '#fca5a5' },
            { v: row.buckets.past90plus, c: '#ef4444' },
            { v: row.buckets.noDueDate, c: '#9ca3af' },
          ].filter((x) => x.v > 0.005)
          return (
            <button
              key={row.supplyHouseId}
              type="button"
              onClick={() => openHouseFromAging(row.supplyHouseId)}
              title="Open this supply house"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                textAlign: 'left',
                padding: '0.55rem 0.75rem',
                background: 'none',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>{row.name}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: row.buckets.past90plus > 0.005 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                  {supplyHouseAgingPhoneNote(row)}
                </span>
              </span>
              <span aria-hidden style={{ display: 'flex', width: 96, height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0 }}>
                {segs.map((x, j) => (
                  // v2.3500: `row.total` is owed-only and can be 0 on a house listed for its credits.
                  <span key={j} style={{ display: 'block', height: '100%', width: `${row.total > 0.005 ? Math.max(3, (x.v / row.total) * 100) : 0}%`, background: x.c }} />
                ))}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>${formatCurrency(row.total)}</span>
            </button>
          )
        })
      )}
    </div>
  ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Supply House</th>
        {AGING_BUCKETS.map((b) => (
          <th
            key={b.key}
            title={b.key === 'current' ? 'Not yet due' : b.key === 'noDueDate' ? 'Unpaid, no due date recorded' : `${b.label} days past due`}
            style={{ padding: '0.6rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}
          >
            {b.label}
          </th>
        ))}
        {agingHasCredits ? (
          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Credits open</th>
        ) : null}
        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{agingHasCredits ? 'Owed' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      {agingMatrix.rows.length === 0 ? (
        <tr>
          <td colSpan={AGING_BUCKETS.length + (agingHasCredits ? 3 : 2)} style={{ padding: 0 }}>
            <EmptyState compact {...SUPPLY_HOUSE_AGING_EMPTY} />
          </td>
        </tr>
      ) : (
        agingMatrix.rows.map((row) => (
          <tr
            key={row.supplyHouseId}
            onClick={() => openHouseFromAging(row.supplyHouseId)}
            title="Open this supply house"
            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{row.name}</td>
            {AGING_BUCKETS.map((b) => {
              const amount = row.buckets[b.key]
              const has = amount > 0.005
              return (
                <td
                  key={b.key}
                  {...(has ? agingCellDoorProps(row.supplyHouseId, b.key, `${row.name} — ${agingCellTitle(b.key)}: see the invoices`) : {})}
                  style={{
                    padding: '0.6rem 0.75rem',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    ...(has ? { ...AGING_CELL_STYLES[b.key], cursor: 'pointer' } : { color: 'var(--text-faint)' }),
                  }}
                >
                  {has ? `$${formatCurrency(amount)}` : '—'}
                  {markJobAccountInvoices && row.jobAccount[b.key] > 0.005 ? (
                    <span title={JOB_ACCOUNT_LINE_TITLE} style={JOB_ACCOUNT_LINE_STYLE}>${formatCurrency(row.jobAccount[b.key])} job acct</span>
                  ) : null}
                </td>
              )
            })}
            {agingHasCredits ? (
              <td
                {...(row.creditsOpen < -0.005 ? agingCellDoorProps(row.supplyHouseId, 'credits', `${row.name} — open credits: see the memos`) : {})}
                style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(row.creditsOpen < -0.005 ? { color: 'var(--text-green-700)', cursor: 'pointer' } : { color: 'var(--text-faint)' }) }}
              >
                {row.creditsOpen < -0.005 ? `−$${formatCurrency(Math.abs(row.creditsOpen))}` : '—'}
              </td>
            ) : null}
            <td
              {...(row.total > 0.005 ? agingCellDoorProps(row.supplyHouseId, 'owed', `${row.name} — every unpaid invoice`) : {})}
              style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(row.total > 0.005 ? { cursor: 'pointer' } : {}) }}
            >
              ${formatCurrency(row.total)}
              {markJobAccountInvoices && row.jobAccountTotal > 0.005 ? (
                <span title={JOB_ACCOUNT_LINE_TITLE} style={JOB_ACCOUNT_LINE_STYLE}>${formatCurrency(row.jobAccountTotal)} job acct</span>
              ) : null}
            </td>
          </tr>
        ))
      )}
    </tbody>
    <tfoot>
      <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
        <td style={{ padding: '0.6rem 0.75rem' }}>Total</td>
        {AGING_BUCKETS.map((b) => {
          const amount = agingMatrix.totals[b.key]
          const has = amount > 0.005
          return (
            <td
              key={b.key}
              {...(has ? agingCellDoorProps(null, b.key, `Every house — ${agingCellTitle(b.key)}: see the invoices`) : {})}
              style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: has ? undefined : 'var(--text-faint)', ...(has ? { cursor: 'pointer' } : {}) }}
            >
              {has ? `$${formatCurrency(amount)}` : '—'}
            </td>
          )
        })}
        {agingHasCredits ? (
          <td
            {...agingCellDoorProps(null, 'credits', 'Every house — open credits: see the memos')}
            style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-green-700)', cursor: 'pointer' }}
          >
            −${formatCurrency(Math.abs(agingMatrix.creditsTotal))}
          </td>
        ) : null}
        <td
          {...(agingMatrix.grandTotal > 0.005 ? agingCellDoorProps(null, 'owed', 'Every house — every unpaid invoice') : {})}
          style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(agingMatrix.grandTotal > 0.005 ? { cursor: 'pointer' } : {}) }}
        >
          ${formatCurrency(agingMatrix.grandTotal)}
        </td>
      </tr>
    </tfoot>
  </table>
  )
}
