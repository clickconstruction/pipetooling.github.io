import { useCallback, useState, type CSSProperties } from 'react'
import { usePhoneKind } from '../../hooks/usePreciseLocation'
import { requestMyFix, type MyFix } from '../../lib/materials/myLocation'
import { addTaskPlaceFromTheSpot } from '../../lib/tasks/taskPlaceIo'
import {
  TASK_PLACE_ADD_SAVES_WORDS,
  TASK_PLACE_NAME_MAX,
  isTaskPlaceAddFix,
  taskPlaceAddNoFixWords,
  taskPlaceAddPoorWords,
} from '../../lib/tasks/taskPlace'
import { ADD_HERE_ROUGH_NOTE_WORDS, ADD_HERE_WEAK_NOTE_WORDS } from '../../lib/tasks/taskPlaceReading'
import { PreciseLocationLine } from '../paintedMap/PreciseLocationLine'

/** `poor` is a reading too wide to keep: its margin, or null when the phone did not say how sure it is. */
type Stage = { kind: 'idle' } | { kind: 'finding' } | { kind: 'found'; fix: MyFix } | { kind: 'poor'; accuracyM: number | null } | { kind: 'none'; words: string } | { kind: 'saving'; fix: MyFix }

const linkPress: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: '0.8125rem', fontFamily: 'inherit', textAlign: 'left' }
const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }
const amber: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

/**
 * Standing at this task? Add its place (punch list #328, PR 8). One quiet line inside an open task
 * that has no place, for the person doing it. The people standing on a task's spot are the people
 * doing it, and they cannot edit the task, so until now a task given with no place stayed with none.
 *
 * A closed card shows nothing of this: a task with no place must not look unfinished. The line asks
 * nothing of the phone until it is pressed. Then the reading is shown, with how sure the phone is,
 * before anything is kept, and a reading too wide is not kept at all. What is saved is the task's
 * place, said in words beside the press. A task that already has a place never shows this line: a
 * wrong place is said in a note, and whoever gave the task moves it.
 *
 * How sure the phone is is said by the Precise Location line (punch list #402, call 8). A reading
 * too wide to keep sends the person to the open sky, and a rough one, which is only an area, shows
 * the way to the switch.
 */
export function TaskPlaceAddHere({ instanceId, onAdded }: { instanceId: string; onAdded: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const phoneKind = usePhoneKind()

  const find = useCallback(() => {
    setStage({ kind: 'finding' })
    setError(null)
    requestMyFix(
      (fix) => setStage(isTaskPlaceAddFix(fix.accuracyM) ? { kind: 'found', fix } : { kind: 'poor', accuracyM: fix.accuracyM }),
      (why) => setStage({ kind: 'none', words: taskPlaceAddNoFixWords(why) }),
    )
  }, [])

  const save = async (fix: MyFix) => {
    setStage({ kind: 'saving', fix })
    setError(null)
    const why = await addTaskPlaceFromTheSpot(instanceId, fix, name)
    if (why) {
      setError(why)
      setStage({ kind: 'found', fix })
      return
    }
    setStage({ kind: 'idle' })
    setName('')
    onAdded()
  }

  if (stage.kind === 'idle') {
    return (
      <div data-task-place-add style={{ marginTop: '0.6rem' }}>
        <button type="button" style={linkPress} onClick={find}>
          Standing at this task? Add its place
        </button>
      </div>
    )
  }

  const fix = stage.kind === 'found' || stage.kind === 'saving' ? stage.fix : null
  return (
    <div data-task-place-add style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem', padding: '0.6rem 0.7rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)' }}>
      {stage.kind === 'finding' ? <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Finding you…</p> : null}
      {stage.kind === 'none' || (stage.kind === 'poor' && stage.accuracyM == null) ? (
        <p role="status" data-task-place-add-refused style={amber}>
          {stage.kind === 'none' ? stage.words : taskPlaceAddPoorWords(null)}
        </p>
      ) : null}
      {stage.kind === 'poor' && stage.accuracyM != null ? (
        // One reading, asked for by the press: there is no better one to wait for, so a rough one is called rough at once.
        <div data-task-place-add-refused>
          <PreciseLocationLine accuracyM={stage.accuracyM} kind={phoneKind} roughHeld weakNote={ADD_HERE_WEAK_NOTE_WORDS} roughNote={ADD_HERE_ROUGH_NOTE_WORDS} />
        </div>
      ) : null}
      {fix ? (
        <>
          <div data-task-place-add-found>
            <PreciseLocationLine accuracyM={fix.accuracyM} kind={phoneKind} roughHeld />
          </div>
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
            Name it, to pick it next time
            <input
              type="text"
              value={name}
              maxLength={TASK_PLACE_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pump house"
              style={{ minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }}
            />
          </label>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{TASK_PLACE_ADD_SAVES_WORDS}</p>
        </>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {fix ? (
          <button type="button" style={{ ...press, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }} disabled={stage.kind === 'saving'} onClick={() => void save(fix)}>
            {stage.kind === 'saving' ? 'Adding the place…' : 'Add this place'}
          </button>
        ) : null}
        {stage.kind === 'poor' || stage.kind === 'none' ? (
          <button type="button" style={press} onClick={find}>
            Try again
          </button>
        ) : null}
        {stage.kind !== 'saving' && stage.kind !== 'finding' ? (
          <button
            type="button"
            style={press}
            onClick={() => {
              setStage({ kind: 'idle' })
              setError(null)
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  )
}
