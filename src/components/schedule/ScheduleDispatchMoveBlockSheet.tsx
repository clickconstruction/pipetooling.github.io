import { useEffect, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { buildMoveDayChips, moveBlockChanged, moveBlockSaveLabel } from '../../lib/scheduleDispatchMoveBlock'

export type ScheduleDispatchMoveBlockSheetProps = {
  open: boolean
  /** "J1004 · Kane- Hot water line leak" */
  title: string
  /** "4:00 PM–5:30 PM" */
  windowLabel: string
  sourceYmd: string
  sourceUserId: string
  visibleDayKeys: readonly string[]
  people: { userId: string; displayName: string }[]
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (target: { workDate: string; assigneeUserId: string }) => void
}

const chipBase: CSSProperties = {
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '0.5rem 0.65rem',
  borderRadius: 8,
  border: '1.5px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  minWidth: 0,
}

const chipOn: CSSProperties = {
  ...chipBase,
  background: 'var(--text-link)',
  borderColor: 'var(--text-link)',
  color: 'var(--surface)',
}

const chipSource: CSSProperties = {
  ...chipBase,
  borderStyle: 'dashed',
  color: 'var(--text-muted)',
  cursor: 'default',
}

const labelStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: '0.9rem 0 0.4rem',
}

/**
 * Press-and-hold Move sheet (phone-first, works everywhere): this week's
 * days as chips, any date via the picker, the person, and one Save whose
 * label names exactly what changes. The caller performs the move through
 * the same kernel the drag-and-drop uses.
 */
export default function ScheduleDispatchMoveBlockSheet({
  open,
  title,
  windowLabel,
  sourceYmd,
  sourceUserId,
  visibleDayKeys,
  people,
  saving,
  error,
  onClose,
  onSave,
}: ScheduleDispatchMoveBlockSheetProps) {
  const [targetYmd, setTargetYmd] = useState(sourceYmd)
  const [targetUserId, setTargetUserId] = useState(sourceUserId)

  useEffect(() => {
    if (!open) return
    setTargetYmd(sourceYmd)
    setTargetUserId(sourceUserId)
  }, [open, sourceYmd, sourceUserId])

  if (!open) return null

  const chips = buildMoveDayChips(visibleDayKeys, sourceYmd)
  const customDate = !chips.some((c) => c.ymd === targetYmd)
  const selection = { sourceYmd, sourceUserId, targetYmd, targetUserId }
  const changed = moveBlockChanged(selection)
  const targetName = people.find((p) => p.userId === targetUserId)?.displayName ?? 'this person'
  const saveLabel = moveBlockSaveLabel(selection, targetName)

  return (
    <ResponsiveModalShell
      title="Move block"
      onRequestClose={() => {
        if (!saving) onClose()
      }}
      maxWidthDesktop={480}
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ font: 'inherit', padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ workDate: targetYmd, assigneeUserId: targetUserId })}
            disabled={saving || !changed}
            style={{
              font: 'inherit',
              fontWeight: 700,
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: 'var(--text-link)',
              color: 'var(--surface)',
              cursor: saving || !changed ? 'not-allowed' : 'pointer',
              opacity: saving || !changed ? 0.55 : 1,
            }}
          >
            {saving ? 'Moving…' : saveLabel}
          </button>
        </div>
      }
    >
      <div style={{ fontWeight: 700, color: 'var(--text-blue-900)', marginTop: '0.25rem' }}>{title}</div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {windowLabel} · times stay the same
      </div>

      <div style={labelStyle}>Day</div>
      <div role="group" aria-label="Day" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(chips.length, 1)}, minmax(0, 1fr))`, gap: 6 }}>
        {chips.map((c) => {
          const on = c.ymd === targetYmd
          return (
            <button
              key={c.ymd}
              type="button"
              aria-pressed={on}
              disabled={saving}
              onClick={() => setTargetYmd(c.ymd)}
              title={c.isSource ? 'Where the block is now' : undefined}
              style={on ? chipOn : c.isSource ? chipSource : chipBase}
            >
              <span>{c.weekday}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.85 }}>{c.date}</span>
            </button>
          )
        })}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Or pick a date</span>
        <input
          type="date"
          aria-label="Move this block to a specific date"
          value={targetYmd}
          disabled={saving}
          onChange={(e) => {
            if (e.target.value) setTargetYmd(e.target.value)
          }}
          style={{
            font: 'inherit',
            padding: '0.3rem 0.45rem',
            borderRadius: 6,
            border: `1px solid ${customDate ? 'var(--text-link)' : 'var(--border-strong)'}`,
            background: 'var(--surface)',
            color: 'var(--text-700)',
          }}
        />
      </label>

      <div style={labelStyle}>Person</div>
      <div role="group" aria-label="Person" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {people.map((p) => {
          const on = p.userId === targetUserId
          const isSource = p.userId === sourceUserId
          return (
            <button
              key={p.userId}
              type="button"
              aria-pressed={on}
              disabled={saving}
              onClick={() => setTargetUserId(p.userId)}
              title={isSource && !on ? 'Assigned now' : undefined}
              style={{ ...(on ? chipOn : chipBase), flexDirection: 'row', ...(isSource && !on ? { borderStyle: 'dashed' } : {}) }}
            >
              {p.displayName}
            </button>
          )
        })}
      </div>

      {error ? (
        <div role="alert" style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
          {error}
        </div>
      ) : null}
      <div style={{ height: '0.75rem' }} />
    </ResponsiveModalShell>
  )
}
