import { useEffect, useState } from 'react'
import { loadRoadmapTaskPlace, saveRoadmapTaskPlace } from '../../lib/tasks/taskPlaceIo'
import { taskPlaceDraft, type TaskPlace, type TaskPlaceDraft } from '../../lib/tasks/taskPlace'
import { TaskPlaceBlock } from './TaskPlaceBlock'
import { TaskPlaceRow } from './TaskPlaceRow'

type Props = {
  taskId: string
  /** May this person plan the roadmap? A planner gets the Place row; anyone else sees the place, if there is one. */
  canEdit: boolean
  userId: string | null
  nameOf: (userId: string) => string | null
}

/**
 * A roadmap task's place, in its card window (punch list #328, PR 5). The window saves each edit by
 * itself, so a press on a chip or Use this place is saved at once, and a save that fails says why
 * and puts the row back.
 *
 * The place lives on the roadmap task and not on the list row made from it: that row comes and goes
 * as stages unlock, and a place set on it would be lost. The person's card reads this place through
 * the link.
 */
export function RoadmapTaskPlaceSection({ taskId, canEdit, userId, nameOf }: Props) {
  const [place, setPlace] = useState<TaskPlace | null>(null)
  const [draft, setDraft] = useState<TaskPlaceDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPlace(null)
    setDraft(null)
    setError(null)
    void loadRoadmapTaskPlace(taskId).then((p) => {
      if (cancelled) return
      setPlace(p)
      setDraft(taskPlaceDraft(p))
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  if (!canEdit) {
    if (!place) return null
    return (
      <div data-roadmap-task-place style={{ padding: '2px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{place.name}</div>
        <TaskPlaceBlock place={place} placedByName={place.setBy ? nameOf(place.setBy) : null} />
      </div>
    )
  }

  const change = (next: TaskPlaceDraft | null) => {
    const before = draft
    setDraft(next)
    setError(null)
    void saveRoadmapTaskPlace(taskId, next, userId).then((why) => {
      if (!why) return
      setDraft(before)
      setError(why)
    })
  }

  return (
    <div data-roadmap-task-place style={{ padding: '2px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <TaskPlaceRow value={draft} onChange={change} />
      {error ? (
        <p role="alert" style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
