import type { CSSProperties } from 'react'
import type { TaskFace } from '../../../lib/tasks/newTaskWindow'

/** A crew as a face: its size in the circle, lit when everyone on it is picked, dashed when some are. */
export type TaskCrewFace = { id: string; name: string; count: number; state: 'all' | 'some' | 'none' }

type Props = {
  faces: readonly TaskFace[]
  pickedIds: readonly string[]
  onToggle: (id: string) => void
  crews: readonly TaskCrewFace[]
  onCrew: (id: string) => void
  /** The full list is open under the row. */
  listOpen: boolean
  onList: () => void
  /** A desk wraps the row. A phone slides it sideways. */
  phone: boolean
}

const tile: CSSProperties = {
  flex: 'none',
  width: 50,
  background: 'none',
  border: 'none',
  padding: '2px 0 0',
  font: 'inherit',
  color: 'var(--text-700)',
  cursor: 'pointer',
  display: 'grid',
  justifyItems: 'center',
  gap: 3,
}
const circle: CSSProperties = {
  position: 'relative',
  width: 40,
  height: 40,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--bg-muted)',
  color: 'var(--text-700)',
  fontWeight: 700,
  fontSize: 15,
  border: '2px solid transparent',
  boxSizing: 'border-box',
}
// The whole border, not its colour alone: React clears a longhand it no longer sees, and the ring would fall back to the text colour.
const circleOn: CSSProperties = { ...circle, background: 'var(--bg-blue-tint)', border: '2px solid #2563eb', color: 'var(--text-blue-800)' }
const nameStyle: CSSProperties = { fontSize: 11.5, lineHeight: 1.25, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const nameOn: CSSProperties = { ...nameStyle, color: 'var(--text-strong)', fontWeight: 700 }
const tick: CSSProperties = {
  position: 'absolute',
  right: -5,
  bottom: -5,
  width: 17,
  height: 17,
  borderRadius: '50%',
  background: '#2563eb',
  color: '#fff',
  fontSize: 10,
  display: 'grid',
  placeItems: 'center',
  border: '2px solid var(--surface)',
  boxSizing: 'border-box',
}

/**
 * The For row of the New task window (punch list #331): who the task is for, as a row of faces.
 * Me, the people given to last, the crews, and **Someone else** pinned at the end, which opens the
 * full list under the row. One press on a face and the task is theirs. The row is drawn from
 * `taskFaces`, so a person picked from the full list sits right after Me and is never off its end.
 */
export function TaskFacesRow({ faces, pickedIds, onToggle, crews, onCrew, listOpen, onList, phone }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 4, alignItems: 'start', minWidth: 0 }}>
      <div className={phone ? 'ntwShelf' : 'ntwShelf ntwShelfWrap'} data-testid="new-task-faces">
        {faces.map((face) => {
          const on = pickedIds.includes(face.id)
          return (
            <button key={face.id} type="button" aria-pressed={on} aria-label={face.name} title={face.name} onClick={() => onToggle(face.id)} style={tile}>
              <span aria-hidden style={on ? circleOn : circle}>
                {face.mark}
                {on ? <span style={tick}>✓</span> : null}
              </span>
              <span aria-hidden style={on ? nameOn : nameStyle}>
                {face.name}
              </span>
            </button>
          )
        })}
        {crews.map((crew) => {
          const on = crew.state === 'all'
          return (
            <button
              key={crew.id}
              type="button"
              aria-pressed={on}
              aria-label={`${crew.name}, a crew of ${crew.count}`}
              title={crew.name}
              onClick={() => onCrew(crew.id)}
              style={{ ...tile, width: 'auto', minWidth: 50, maxWidth: 84, padding: '2px 4px 0' }}
            >
              <span aria-hidden style={on ? circleOn : crew.state === 'some' ? { ...circle, border: '2px dashed #2563eb' } : circle}>
                {crew.count}
                {on ? <span style={tick}>✓</span> : null}
              </span>
              <span aria-hidden style={on ? nameOn : nameStyle}>
                {crew.name}
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" aria-expanded={listOpen} aria-label="Someone else" onClick={onList} style={{ ...tile, width: 56 }}>
        <span
          aria-hidden
          style={{ ...circle, background: listOpen ? 'var(--bg-blue-tint)' : 'none', border: listOpen ? '2px solid #2563eb' : '1.5px dashed var(--border-strong)', color: listOpen ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: 18 }}
        >
          ⋯
        </span>
        <span aria-hidden style={{ ...(listOpen ? nameOn : nameStyle), whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.1 }}>
          Someone else
        </span>
      </button>
    </div>
  )
}
