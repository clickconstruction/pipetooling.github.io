/**
 * Step 3's Order only group (2026-10-02): the fixtures the office buys and the GC never sees,
 * under the rows the GC reads. Each lists every part, since every part is bought; there is no
 * status, reason or cut sheet to ask for. A draft can put one back on the submittal or leave it out.
 */
import type { CSSProperties } from 'react'

import { orderOnlyGroupLine } from '../../lib/submittals/orderOnly'
import { partHouseIds, splitPartLabel, type SubmittalPartRow } from '../../lib/submittals/itemParts'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const td: CSSProperties = { padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'top', fontSize: '0.8125rem', color: 'var(--text-base)', background: 'var(--bg-subtle)' }
const sub: CSSProperties = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }
/** How many parts an order-only row names before it counts the rest. */
const SHOWN = 3
const btn: CSSProperties = { padding: '0.2rem 0.55rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 500 }

export function SubmittalOrderOnlyRows({ items, partsOf, houseNameById, columns, isDraft, busy, onPutBack, onEdit, onLeaveOut }: {
  items: ReadonlyArray<SubmittalItemRow>
  partsOf: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>
  houseNameById: ReadonlyMap<string, string>
  /** How many columns the rows table has, so the group spans it. */
  columns: number
  isDraft: boolean
  busy: boolean
  onPutBack: (item: SubmittalItemRow) => void
  onEdit: (item: SubmittalItemRow) => void
  onLeaveOut: (item: SubmittalItemRow) => void
}) {
  if (items.length === 0) return null
  return (
    <>
      <tr data-testid="order-only-heading">
        <td colSpan={columns} style={{ ...td, paddingTop: '0.7rem' }}>
          <b style={{ color: 'var(--text-amber-700)' }}>Order only</b>
          <span style={{ color: 'var(--text-muted)' }}> · {orderOnlyGroupLine(items.length)}</span>
          <span style={sub}>Not in the package, the GC’s room or the cut sheet count. They stay on the procurement log.</span>
        </td>
      </tr>
      {items.map((it) => {
        const parts = [...(partsOf.get(it.id) ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
        const name = it.tag.trim() || 'accessory'
        const houses = parts.length > 0 ? partHouseIds(parts) : it.supply_house_id ? [it.supply_house_id] : []
        const houseLine = houses.map((h) => houseNameById.get(h)).filter(Boolean).join(' · ')
        return (
          <tr key={it.id} data-testid="order-only-row">
            <td style={{ ...td, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{it.tag.trim() || '—'}</td>
            <td colSpan={Math.max(1, columns - 2)} style={td}>
              {/* The first few parts by maker and model; a long fixture says how many more, so the row stays as wide as the rows above. */}
              <span title={parts.length > SHOWN ? parts.map((p) => splitPartLabel(p.label).head).join(' + ') : undefined}>
                {parts.length > 0
                  ? `${parts.slice(0, SHOWN).map((p) => splitPartLabel(p.label).head).join(' + ')}${parts.length > SHOWN ? ` + ${parts.length - SHOWN} more part${parts.length - SHOWN === 1 ? '' : 's'}` : ''}`
                  : (it.submitted_label ?? it.submitted_model ?? <span style={{ color: 'var(--text-faint)' }}>—</span>)}
              </span>
              {houseLine ? <span style={sub}>{houseLine}</span> : null}
              {isDraft ? (
                <button type="button" aria-label={`Put ${name} on the submittal`} disabled={busy} onClick={() => onPutBack(it)} style={{ display: 'block', marginTop: '0.25rem', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-blue-700)', textDecoration: 'underline', cursor: 'pointer' }}>
                  Put on the submittal
                </button>
              ) : null}
            </td>
            <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button type="button" aria-label={`Edit ${name}`} onClick={() => onEdit(it)} style={btn}>
                Edit
              </button>
              {isDraft ? (
                <button type="button" aria-label={`Leave ${name} out`} disabled={busy} onClick={() => onLeaveOut(it)} title="Off the submittal and off the procurement log" style={{ ...btn, padding: '0.2rem 0.5rem', marginLeft: '0.3rem', color: 'var(--text-muted)' }}>
                  ×
                </button>
              ) : null}
            </td>
          </tr>
        )
      })}
    </>
  )
}
