import { useEffect, useMemo, useState } from 'react'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { loadRecentTaskPlaces } from '../../lib/tasks/taskPlaceIo'
import { TASK_PLACE_UNNAMED, taskPlaceSheetStart, type TaskPlace, type TaskPlaceDraft } from '../../lib/tasks/taskPlace'
import { TaskPlaceSheet } from './TaskPlaceSheet'

type Props = {
  /** The task's place as the giver has it now, or null for a task with no place. */
  value: TaskPlaceDraft | null
  onChange: (next: TaskPlaceDraft | null) => void
}

const chipBase = {
  display: 'inline-flex',
  alignItems: 'center' as const,
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  borderRadius: 999,
  padding: '5px 11px',
  minHeight: 32,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const chipOff = { ...chipBase, background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)' }
const chipOn = { ...chipBase, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }
const dot = { width: 8, height: 8, borderRadius: '50%', background: 'currentColor', opacity: 0.75, flex: 'none' as const }

/** Two drafts are the same chip when they share a name and a point. */
function sameChip(value: TaskPlaceDraft | null, place: TaskPlace): boolean {
  return value != null && value.lat === place.lat && value.lng === place.lng && value.name === place.name
}

/**
 * The Place row of the Add and Edit windows (punch list #328, PR 2). One optional row under
 * Assign to: the places tasks already carry, as chips, and ＋ New place. One press on a chip and
 * the task has a place. Nothing is pressed by default, so a task with no place takes the presses
 * it took before this row existed.
 *
 * The chips are read from the tasks themselves (`loadRecentTaskPlaces`): there is no list of places
 * to keep, and a place is offered because a task has it. A place set in this window and not yet
 * saved shows as its own chip, lit.
 */
export function TaskPlaceRow({ value, onChange }: Props) {
  const [offered, setOffered] = useState<TaskPlace[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  // Read with the row, not with the sheet: one cached settings read, there before ＋ New place is pressed.
  const office = useOfficeAnchor(true)

  useEffect(() => {
    let cancelled = false
    void loadRecentTaskPlaces().then((places) => {
      if (!cancelled) setOffered(places)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onAChip = offered.some((p) => sameChip(value, p))
  const start = useMemo(() => taskPlaceSheetStart(value, offered, office), [value, offered, office])
  const ownName = value ? value.name || TASK_PLACE_UNNAMED : ''

  return (
    <div data-task-place-row style={{ marginTop: '0.5rem' }}>
      <span id="task-place-label" style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
        Place
      </span>
      <div role="group" aria-labelledby="task-place-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {value && !onAChip ? (
          <button type="button" aria-pressed="true" title="Press to move this place" onClick={() => setSheetOpen(true)} style={chipOn}>
            <span aria-hidden style={dot} />
            {ownName}
          </button>
        ) : null}
        {offered.map((p) => {
          const on = sameChip(value, p)
          return (
            <button
              key={`${p.name}|${p.lat}|${p.lng}`}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : { lat: p.lat, lng: p.lng, name: p.name, accuracyM: p.accuracyM })}
              style={on ? chipOn : chipOff}
            >
              <span aria-hidden style={dot} />
              {p.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{ ...chipBase, background: 'var(--surface)', color: 'var(--text-link)', border: '1px dashed var(--border-strong)' }}
        >
          ＋ New place
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', alignItems: 'baseline', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        <span>{value ? 'The place is saved with the task.' : 'Where the work is. Leave it out for a task with no place.'}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}
          >
            Remove the place
          </button>
        ) : null}
      </div>
      {sheetOpen ? (
        <TaskPlaceSheet
          start={start}
          initial={value && !onAChip ? value : null}
          onClose={() => setSheetOpen(false)}
          onUse={(place) => {
            onChange(place)
            setSheetOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
