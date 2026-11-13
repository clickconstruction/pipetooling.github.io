import { useEffect, useState } from 'react'
import { loadRoadmapTaskPlace, saveRoadmapTaskPlace } from '../../lib/tasks/taskPlaceIo'
import { taskPlaceDraft, type TaskPlace, type TaskPlaceDraft } from '../../lib/tasks/taskPlace'
import { loadTaskSpotPhotoPath, putTaskSpotPhoto, removeTaskSpotPhotoFile, saveTaskSpotPhotoPath, taskSpotPhotoUrls } from '../../lib/tasks/taskSpotPhotoIo'
import { TaskPlaceBlock, TaskSpotPhotoView } from './TaskPlaceBlock'
import { TaskPlaceRow } from './TaskPlaceRow'
import { ROADMAP_TASK_PICKER_Z } from '../../lib/windowLayers'
import { TaskSpotPhotoField, type TaskSpotPhotoDraft } from './TaskSpotPhotoField'

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
  // PR 6: the planner's photo of the spot. Its path as saved, and what the field shows.
  const [photo, setPhoto] = useState<TaskSpotPhotoDraft | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPlace(null)
    setDraft(null)
    setError(null)
    setPhoto(null)
    void loadRoadmapTaskPlace(taskId).then((p) => {
      if (cancelled) return
      setPlace(p)
      setDraft(taskPlaceDraft(p))
    })
    void loadTaskSpotPhotoPath({ kind: 'roadmap', id: taskId }).then(async (path) => {
      if (cancelled || !path) return
      const url = (await taskSpotPhotoUrls([path])).get(path) ?? null
      if (!cancelled) setPhoto({ kind: 'saved', path, previewUrl: url })
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  const photoUrl = photo?.previewUrl ?? null
  if (!canEdit) {
    if (!place && !photoUrl) return null
    return (
      <div data-roadmap-task-place style={{ padding: '2px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        {place ? (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{place.name}</div>
            <TaskPlaceBlock place={place} placedByName={place.setBy ? nameOf(place.setBy) : null} photoUrl={photoUrl} />
          </>
        ) : photoUrl ? (
          <TaskSpotPhotoView url={photoUrl} />
        ) : null}
      </div>
    )
  }

  // The card window saves each edit by itself, and so does a picture: it goes up on the pick.
  const changePhoto = (next: TaskSpotPhotoDraft | null) => {
    const before = photo
    setError(null)
    if (next?.kind === 'new') {
      setPhoto(next)
      setPhotoBusy(true)
      void putTaskSpotPhoto({ kind: 'roadmap', id: taskId }, next.id, next.blob).then((put) => {
        setPhotoBusy(false)
        if ('error' in put) {
          setPhoto(before)
          setError(put.error)
          return
        }
        setPhoto({ kind: 'saved', path: put.path, previewUrl: next.previewUrl })
        if (before?.kind === 'saved') void removeTaskSpotPhotoFile(before.path)
      })
      return
    }
    if (next === null && before?.kind === 'saved') {
      setPhoto(null)
      setPhotoBusy(true)
      void saveTaskSpotPhotoPath({ kind: 'roadmap', id: taskId }, null).then((why) => {
        setPhotoBusy(false)
        if (why) {
          setPhoto(before)
          setError(why)
          return
        }
        void removeTaskSpotPhotoFile(before.path)
      })
      return
    }
    setPhoto(next)
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
      <TaskPlaceRow value={draft} onChange={change} sheetZIndex={ROADMAP_TASK_PICKER_Z} />
      <TaskSpotPhotoField value={photo} onChange={changePhoto} busy={photoBusy} />
      {error ? (
        <p role="alert" style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
