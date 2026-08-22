import { useRef, useState } from 'react'
import { MOTOR_POOL_LABEL, vehicleDisplayName, vinTail, type FleetVehicle, type VehicleMaintenanceTask } from '../../lib/vehicleFleet'
import type { ReadingCatchUpRow } from '../../lib/vehicleCatchUp'

/**
 * Catch-up modals behind the fleet summary chips (v2.2106): "N need a
 * reading" opens an odometer sweep — one miles box per vehicle, Enter saves
 * and hops to the next; saved rows stay put and turn green. "N maintenance
 * tasks" opens the open-task list with ✓ Done (or Assign) per row. Shared
 * chrome so the two read as one pattern.
 */

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  padding: '1rem',
}
const shellStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  width: 'min(36rem, 100%)',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}
const vinStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  background: 'var(--bg-muted)',
  borderRadius: 6,
  padding: '0.08rem 0.4rem',
  letterSpacing: '0.03em',
  flexShrink: 0,
}
const whoBase: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 600,
  padding: '0.1rem 0.5rem',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

function ModalShell({ title, progress, footer, onClose, children }: { title: string; progress: string; footer: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={shellStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', padding: '0.9rem 1.15rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{title}</h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{progress}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ font: 'inherit', fontSize: '1rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.2rem' }}>
            ✕
          </button>
        </div>
        <div style={{ overflowY: 'auto' }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 1.15rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ minWidth: 0 }}>{footer}</span>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', flexShrink: 0, font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.33rem 0.95rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function holderChip(kind: 'person' | 'pool' | 'none', name: string | null) {
  if (kind === 'person') return <span style={{ ...whoBase, background: 'var(--bg-sky-tint)', color: 'var(--text-link)' }}>{name ?? '—'}</span>
  if (kind === 'pool') return <span style={{ ...whoBase, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{MOTOR_POOL_LABEL}</span>
  return <span style={{ ...whoBase, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>Unassigned</span>
}

export function VehicleReadingsCatchUpModal({
  rows,
  userNameById,
  savedById,
  savingVehicleId,
  onSave,
  onClose,
}: {
  rows: ReadingCatchUpRow[]
  userNameById: ReadonlyMap<string, string>
  /** vehicleId → saved value; keeps the row visible and green after saving. */
  savedById: Record<string, number>
  savingVehicleId: string | null
  onSave: (vehicleId: string, raw: string) => void
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const doneCount = rows.filter((r) => savedById[r.vehicleId] != null).length

  const saveAndAdvance = (row: ReadingCatchUpRow) => {
    onSave(row.vehicleId, drafts[row.vehicleId] ?? '')
    const remaining = rows.filter((r) => r.vehicleId !== row.vehicleId && savedById[r.vehicleId] == null)
    const next = remaining[0]
    if (next) setTimeout(() => inputRefs.current[next.vehicleId]?.focus(), 60)
  }

  return (
    <ModalShell
      title="Odometer catch-up"
      progress={`${doneCount} of ${rows.length} done`}
      footer="Readings save with today’s date · press Enter to save and jump to the next box"
      onClose={onClose}
    >
      {rows.map((row, i) => {
        const saved = savedById[row.vehicleId]
        const holderName = row.holderUserId ? userNameById.get(row.holderUserId) ?? null : null
        return (
          <div
            key={row.vehicleId}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 1.15rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '0.86rem', background: saved != null ? 'var(--bg-emerald-tint)' : undefined }}
          >
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '13rem', flexShrink: 1, color: saved != null ? 'var(--text-emerald-800)' : 'var(--text-strong)' }} title={row.name}>{row.name}</span>
            {row.vinTail ? <span style={vinStyle}>{row.vinTail}</span> : null}
            {holderChip(row.holderKind, holderName)}
            {saved != null ? (
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-emerald-800)' }}>✓ {saved.toLocaleString()} mi · today</span>
            ) : (
              <>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, marginLeft: 'auto' }}>{row.lastLabel}</span>
                <input
                  ref={(el) => { inputRefs.current[row.vehicleId] = el }}
                  type="text"
                  inputMode="numeric"
                  placeholder="miles"
                  value={drafts[row.vehicleId] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.vehicleId]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveAndAdvance(row) }}
                  aria-label={`Odometer miles for ${row.name}`}
                  style={{ width: '6.2rem', flexShrink: 0, font: 'inherit', fontSize: '0.84rem', padding: '0.32rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 7 }}
                />
                <button
                  type="button"
                  onClick={() => saveAndAdvance(row)}
                  disabled={savingVehicleId === row.vehicleId || !(drafts[row.vehicleId] ?? '').trim()}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.32rem 0.8rem', borderRadius: 7, border: 'none', background: savingVehicleId === row.vehicleId || !(drafts[row.vehicleId] ?? '').trim() ? '#9ca3af' : '#3b82f6', color: '#fff', cursor: 'pointer', flexShrink: 0 }}
                >
                  Save
                </button>
              </>
            )}
          </div>
        )
      })}
      {rows.length === 0 ? <p style={{ margin: 0, padding: '0.8rem 1.15rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Every vehicle has a fresh reading. 🎉</p> : null}
    </ModalShell>
  )
}

export function VehicleTasksCatchUpModal({
  tasks,
  vehicleById,
  userNameById,
  onComplete,
  onAssign,
  onClose,
}: {
  tasks: VehicleMaintenanceTask[]
  vehicleById: ReadonlyMap<string, FleetVehicle>
  userNameById: ReadonlyMap<string, string>
  onComplete: (t: VehicleMaintenanceTask) => void
  onAssign: (t: VehicleMaintenanceTask) => void
  onClose: () => void
}) {
  return (
    <ModalShell
      title="Open maintenance tasks"
      progress={`${tasks.length} open`}
      footer="✓ Done clears it here and off the assignee’s checklist · unassigned tasks get an Assign button"
      onClose={onClose}
    >
      {tasks.map((t, i) => {
        const vehicle = vehicleById.get(t.vehicle_id)
        const assignee = t.assigned_user_id ? userNameById.get(t.assigned_user_id) ?? null : null
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 1.15rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '0.86rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{vehicle ? vehicleDisplayName(vehicle) : 'Vehicle'}</span>
            {vehicle?.vin ? <span style={vinStyle}>{vinTail(vehicle.vin)}</span> : null}
            <span style={{ minWidth: 120, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</span>
            {assignee ? (
              <span style={{ ...whoBase, background: 'var(--bg-sky-tint)', color: 'var(--text-link)' }}>
                {assignee}
                {t.due_date ? ` · due ${t.due_date.slice(5, 7).replace(/^0/, '')}/${t.due_date.slice(8, 10).replace(/^0/, '')}` : ''}
              </span>
            ) : (
              <button type="button" onClick={() => onAssign(t)} style={{ ...whoBase, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px dashed var(--border-strong)', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }}>
                Assign
              </button>
            )}
            <button
              type="button"
              onClick={() => onComplete(t)}
              style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.32rem 0.8rem', borderRadius: 7, border: '1px solid #a7f3d0', background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)', cursor: 'pointer', flexShrink: 0 }}
            >
              ✓ Done
            </button>
          </div>
        )
      })}
      {tasks.length === 0 ? <p style={{ margin: 0, padding: '0.8rem 1.15rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No open maintenance tasks. 🎉</p> : null}
    </ModalShell>
  )
}
