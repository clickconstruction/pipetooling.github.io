import { useEffect, useState } from 'react'
import { loadRoadmapTaskPlace, saveRoadmapTaskPlace } from '../../lib/tasks/taskPlaceIo'
import { taskPlaceDraft, type TaskPlace, type TaskPlaceDraft } from '../../lib/tasks/taskPlace'
import { loadRoadmapTaskMapAlone, saveRoadmapTaskMap } from '../../lib/tasks/taskMapIo'
import { taskMapAfterPlace, taskMapChanged, taskMapDraftFromSaved, taskPlaceForRow, type TaskMapDraft } from '../../lib/tasks/taskMapPick'
import { useTaskMapWhole } from '../../hooks/useTaskMapWhole'
import { loadTaskSpotPhotoPath, putTaskSpotPhoto, removeTaskSpotPhotoFile, saveTaskSpotPhotoPath, taskSpotPhotoUrls } from '../../lib/tasks/taskSpotPhotoIo'
import { TaskPlaceBlock, TaskSpotPhotoView } from './TaskPlaceBlock'
import { TaskPlaceRow } from './TaskPlaceRow'
import { TaskMapBlock, TaskMapLine } from './TaskMapBlock'
import { TaskMapPress, TaskMapSet } from './TaskMapField'
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
 *
 * The task's painted map lives there too (punch list #345): the way in to its place, or a map by
 * itself for work that is a line. A planner picks it with the **Map** press, and each pick saves
 * itself. It is picked here and neither painted nor opened: the painted map's own window sits under
 * the roadmap's windows. The person opens it from the task on their Today list.
 */
export function RoadmapTaskPlaceSection({ taskId, canEdit, userId, nameOf }: Props) {
  // The task's painted map: the place's way in, or its own map with no place.
  const [map, setMap] = useState<TaskMapDraft | null>(null)
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
    setMap(null)
    void Promise.all([loadRoadmapTaskPlace(taskId), loadRoadmapTaskMapAlone(taskId)]).then(([p, mapAlone]) => {
      if (cancelled) return
      setPlace(p)
      setDraft(taskPlaceDraft(p))
      setMap(taskMapDraftFromSaved(p, mapAlone))
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
    if (!place && !photoUrl && !map) return null
    return (
      <div data-roadmap-task-place style={{ padding: '2px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        {place ? (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{place.name}</div>
            <TaskPlaceBlock place={place} placedByName={place.setBy ? nameOf(place.setBy) : null} photoUrl={photoUrl} canOpenWay={false} />
          </>
        ) : map ? (
          <RoadmapTaskMapView mapId={map.id} photoUrl={photoUrl} nameOf={nameOf} />
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
    const mapBefore = map
    // A place that brings a way in sets the task's map, and a map that came with the old place leaves with it.
    const mapNext = taskMapAfterPlace(map, next)
    setDraft(next)
    setMap(mapNext)
    setError(null)
    const back = (why: string) => {
      setDraft(before)
      setMap(mapBefore)
      setError(why)
    }
    // The place's columns carry the map, so the place is saved with the map the task has now.
    void saveRoadmapTaskPlace(taskId, next ? { ...next, mapId: mapNext?.id ?? null } : null, userId).then((why) => {
      if (why) return back(why)
      // No place writes no map. A map the planner picked by itself stays, so it is written again.
      if (!next && mapNext) void saveRoadmapTaskMap(taskId, mapNext.id).then((whyMap) => (whyMap ? back(whyMap) : undefined))
    })
  }

  const changeMap = (next: TaskMapDraft | null) => {
    if (!taskMapChanged(map, next)) return
    const before = map
    setMap(next)
    setError(null)
    void saveRoadmapTaskMap(taskId, next?.id ?? null).then((why) => {
      if (!why) return
      setMap(before)
      setError(why)
    })
  }

  return (
    <div data-roadmap-task-place style={{ padding: '2px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <TaskPlaceRow value={taskPlaceForRow(draft, map)} onChange={change} sheetZIndex={ROADMAP_TASK_PICKER_Z} />
      <div data-roadmap-task-map style={{ display: 'grid', gap: 6, marginTop: '0.5rem' }}>
        <TaskMapPress value={map} onChange={changeMap} place={draft} sheetZIndex={ROADMAP_TASK_PICKER_Z} canPaint={false} />
        <TaskMapSet value={map} onChange={changeMap} canOpen={false} />
      </div>
      <TaskSpotPhotoField value={photo} onChange={changePhoto} busy={photoBusy} />
      {error ? (
        <p role="alert" style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A roadmap task's map with no place, for someone who does not plan the roadmap: the map's name and
 * its line from above, with Directions to the start and How far am I?. Open the map is left out,
 * since the painted map's window would open under this one.
 */
function RoadmapTaskMapView({ mapId, photoUrl, nameOf }: { mapId: string; photoUrl: string | null; nameOf: (userId: string) => string | null }) {
  const read = useTaskMapWhole(mapId)
  if (read.kind !== 'read') return photoUrl ? <TaskSpotPhotoView url={photoUrl} /> : null
  return (
    <>
      <TaskMapLine map={read} />
      <TaskMapBlock whole={read.whole} paintedByName={read.whole.map.createdBy ? nameOf(read.whole.map.createdBy) : null} photoUrl={photoUrl} canOpen={false} />
    </>
  )
}
