import { useRef, useState } from 'react'
import { MOTOR_POOL_LABEL, vehicleDisplayName, vinTail, type FleetVehicle, type VehicleMaintenanceTask } from '../../lib/vehicleFleet'
import type { ReadingCatchUpRow } from '../../lib/vehicleCatchUp'

/**
 * Catch-up modals behind the fleet summary chips (v2.2106, design pass 2):
 * icon-tile header with a big done-counter and a progress bar, rows on a
 * strict identity · context · action grid (monospace VIN tails, holder dot
 * sub-line, tabular right-aligned miles), ✓ medallions on finished rows.
 * "N need a reading" = odometer sweep (Enter saves + jumps to the next box);
 * "N maintenance tasks" = ✓ Done / Assign per row. Shared chrome so the two
 * read as one pattern.
 */

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  padding: '1rem',
}
const shellStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  width: 'min(38rem, 100%)',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 32px 70px rgba(0, 0, 0, 0.35)',
}
const vinStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: '0.68rem',
  fontWeight: 600,
  color: 'var(--text-faint)',
  background: 'var(--bg-muted)',
  borderRadius: 5,
  padding: '0.06rem 0.35rem',
  marginLeft: '0.45rem',
  verticalAlign: 1,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}
const rowStyle = (first: boolean): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(9rem, 1.1fr) 1fr auto',
  alignItems: 'center',
  gap: '0.9rem',
  padding: '0.62rem 1.3rem',
  borderTop: first ? 'none' : '1px solid var(--border)',
  fontSize: '0.875rem',
})

function HolderLine({ kind, name }: { kind: 'person' | 'pool' | 'none'; name: string | null }) {
  const dot = kind === 'person' ? '#2563eb' : kind === 'pool' ? 'var(--text-faint)' : '#f59e0b'
  const label = kind === 'person' ? `${name ?? '—'} · holds it` : kind === 'pool' ? MOTOR_POOL_LABEL : 'Unassigned'
  return (
    <div style={{ fontSize: '0.72rem', color: kind === 'none' ? 'var(--text-amber-800)' : 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span aria-hidden="true" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: '0.35rem', verticalAlign: 1, background: dot }} />
      {label}
    </div>
  )
}

function VehicleName({ name, vin, done }: { name: string; vin: string | null; done?: boolean }) {
  return (
    <div style={{ fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: done ? 'var(--text-emerald-800)' : 'var(--text-strong)' }} title={name}>
      {name}
      {vin ? <span style={vinStyle}>{vin}</span> : null}
    </div>
  )
}

function ModalShell({
  icon,
  iconTint,
  title,
  subtitle,
  countBig,
  countSmall,
  countLabel,
  progressPct,
  footerHint,
  onClose,
  children,
}: {
  icon: string
  iconTint: string
  title: string
  subtitle: string
  countBig: number
  countSmall?: number
  countLabel: string
  /** 0-100 renders the slim progress bar; omit to hide it. */
  progressPct?: number
  footerHint: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={shellStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1.05rem 1.3rem 0.85rem' }}>
          <div aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', flexShrink: 0, background: iconTint }}>
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.02rem', letterSpacing: '-0.01em' }}>{title}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
              {countBig}
              {countSmall != null ? <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-faint)' }}> / {countSmall}</span> : null}
            </div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>{countLabel}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ font: 'inherit', fontSize: '1rem', border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '0 0.2rem', alignSelf: 'flex-start' }}>
            ✕
          </button>
        </div>
        {progressPct != null ? (
          <div style={{ height: 4, background: 'var(--bg-muted)', margin: '0 1.3rem', borderRadius: 2 }}>
            <span style={{ display: 'block', height: '100%', width: `${progressPct}%`, background: '#059669', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        ) : null}
        <div style={{ overflowY: 'auto', padding: '0.4rem 0 0.5rem' }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 1.3rem 0.8rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          <span style={{ minWidth: 0 }}>{footerHint}</span>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', flexShrink: 0, font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.4rem 1.1rem', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: '0.68rem',
  fontWeight: 600,
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderBottomWidth: 2,
  borderRadius: 5,
  padding: '0.08rem 0.4rem',
  color: 'var(--text-700)',
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
    const next = rows.find((r) => r.vehicleId !== row.vehicleId && savedById[r.vehicleId] == null && !(drafts[r.vehicleId] ?? '').trim())
    if (next) setTimeout(() => inputRefs.current[next.vehicleId]?.focus(), 60)
  }

  return (
    <ModalShell
      icon="🛞"
      iconTint="var(--bg-blue-tint)"
      title="Odometer catch-up"
      subtitle="Never-read vehicles first, then oldest reading"
      countBig={doneCount}
      countSmall={rows.length}
      countLabel="done"
      progressPct={rows.length > 0 ? Math.round((doneCount / rows.length) * 100) : 0}
      footerHint={<><kbd style={kbdStyle}>Enter</kbd> saves &amp; jumps to the next box · dated today</>}
      onClose={onClose}
    >
      {rows.map((row, i) => {
        const saved = savedById[row.vehicleId]
        const holderName = row.holderUserId ? userNameById.get(row.holderUserId) ?? null : null
        return (
          <div key={row.vehicleId} style={{ ...rowStyle(i === 0), ...(saved != null ? { background: 'var(--bg-emerald-tint)' } : {}) }}>
            <div style={{ minWidth: 0 }}>
              <VehicleName name={row.name} vin={row.vinTail} done={saved != null} />
              <HolderLine kind={row.holderKind} name={holderName} />
            </div>
            {saved != null ? (
              <div />
            ) : (
              <div style={{ fontSize: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums', ...(row.lastLabel === 'no reading yet' ? { color: 'var(--text-amber-800)', fontStyle: 'italic' } : { color: 'var(--text-muted)' }) }}>
                {row.lastLabel}
              </div>
            )}
            {saved != null ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-emerald-800)', fontVariantNumeric: 'tabular-nums', justifySelf: 'end' }}>
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', background: '#059669', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>✓</span>
                {saved.toLocaleString()} mi
                <span style={{ fontWeight: 500, color: 'var(--text-emerald-700, var(--text-emerald-800))' }}>· just now</span>
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                <input
                  ref={(el) => { inputRefs.current[row.vehicleId] = el }}
                  type="text"
                  inputMode="numeric"
                  placeholder="miles"
                  value={drafts[row.vehicleId] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.vehicleId]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveAndAdvance(row) }}
                  aria-label={`Odometer miles for ${row.name}`}
                  style={{ width: '6.8rem', font: 'inherit', fontSize: '0.86rem', padding: '0.4rem 0.6rem', border: '1.5px solid var(--border-strong)', borderRadius: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: 'var(--surface)', color: 'var(--text-strong)' }}
                />
                <button
                  type="button"
                  onClick={() => saveAndAdvance(row)}
                  disabled={savingVehicleId === row.vehicleId || !(drafts[row.vehicleId] ?? '').trim()}
                  style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.4rem 0.95rem', borderRadius: 9, border: 'none', background: savingVehicleId === row.vehicleId || !(drafts[row.vehicleId] ?? '').trim() ? 'var(--border-strong)' : '#2563eb', color: '#fff', cursor: 'pointer' }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )
      })}
      {rows.length === 0 ? <p style={{ margin: 0, padding: '0.8rem 1.3rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Every vehicle has a fresh reading. 🎉</p> : null}
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
      icon="🧰"
      iconTint="var(--bg-emerald-tint)"
      title="Open maintenance tasks"
      subtitle="✓ Done clears it here and off the assignee’s checklist"
      countBig={tasks.length}
      countLabel="open"
      footerHint="Tasks assigned here land on that person’s checklist"
      onClose={onClose}
    >
      {tasks.map((t, i) => {
        const vehicle = vehicleById.get(t.vehicle_id)
        const assignee = t.assigned_user_id ? userNameById.get(t.assigned_user_id) ?? null : null
        const due = t.due_date ? `${Number(t.due_date.slice(5, 7))}/${Number(t.due_date.slice(8, 10))}` : null
        return (
          <div key={t.id} style={{ ...rowStyle(i === 0), gridTemplateColumns: 'minmax(8.5rem, 0.8fr) 1.4fr auto' }}>
            <div style={{ minWidth: 0 }}>
              <VehicleName name={vehicle ? vehicleDisplayName(vehicle) : 'Vehicle'} vin={vehicle ? vinTail(vehicle.vin) : null} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-strong)' }} title={t.title}>{t.title}</div>
              {assignee ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                  <span style={{ color: 'var(--text-blue-700)', fontWeight: 650 }}>{assignee}</span>
                  {due ? ` · due ${due}` : ''}
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-800)', marginTop: 1 }}>unassigned — pick an owner</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
              {!assignee ? (
                <button type="button" onClick={() => onAssign(t)} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.38rem 0.8rem', borderRadius: 9, border: '1.5px dashed var(--border-strong)', background: 'none', color: 'var(--text-700)', cursor: 'pointer' }}>
                  Assign
                </button>
              ) : null}
              <button type="button" onClick={() => onComplete(t)} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.4rem 0.95rem', borderRadius: 9, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>
                ✓ Done
              </button>
            </div>
          </div>
        )
      })}
      {tasks.length === 0 ? <p style={{ margin: 0, padding: '0.8rem 1.3rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No open maintenance tasks. 🎉</p> : null}
    </ModalShell>
  )
}
