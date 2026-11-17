import { useRef, useState } from 'react'
import { paintPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMap } from '../../lib/paintedMap/paintedMapIo'
import { TASK_MAP_NOT_OPENED, TASK_MAP_SHEET_FOOT, TASK_MAP_SHEET_TITLE, taskMapStarts, type TaskMapStart } from '../../lib/tasks/taskDoerActs'
import { addTaskMap } from '../../lib/tasks/taskDoerActsIo'
import { taskMapFromPainted, taskMapNewName } from '../../lib/tasks/taskMapPick'
import { TASK_PILL_STYLE } from '../../lib/tasks/taskPillStyle'
import { MAP_PRESS_LABEL } from '../../lib/tasks/todayPage'
import { TaskChoiceSheet } from './TaskChoiceSheet'

type Props = {
  instanceId: string
  /** The task's words, which name the new map. */
  taskWords: string
  /** The task's place, when it has one: the painting window opens there. */
  place?: { lat: number; lng: number } | null
  /** The map is on the task now: the page reads the task's map again. */
  onAdded: () => void
  /** The seams a test fills. */
  paint?: typeof paintPaintedMap
  loadMap?: typeof loadPaintedMap
  addMap?: typeof addTaskMap
  newId?: () => string
}

/**
 * 🗺 Map on a task that has no map (punch list #369, step C2, tool 8). The owner's ask: "the same way they can add a
 * note or a photo, they can also draw a map", with a point left on it. A press offers three ways in, the painting
 * window that exists opens on the one picked, and when it closes with a line or a place saved, the map goes on the
 * task through `task_add_map`.
 *
 * The flow is the New task window's (`TaskMapPress`, v2.7366): this press makes the map's id, and reads the map back
 * by that id when the window closes. A window closed with nothing saved changes nothing.
 */
export function TaskDoerMapPress({ instanceId, taskWords, place = null, onAdded, paint = paintPaintedMap, loadMap = loadPaintedMap, addMap = addTaskMap, newId = () => crypto.randomUUID() }: Props) {
  const [open, setOpen] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The painting window can stay open a long while. The map goes to whatever the page's handler is by then.
  const onAddedRef = useRef(onAdded)
  onAddedRef.current = onAdded
  const canWalk = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const start = (first: TaskMapStart) => {
    const id = newId()
    setError(null)
    const opened = paint(
      { id, name: taskMapNewName(taskWords), words: '', first, home: { jobId: null, developmentId: null, label: '', developmentLabel: '', address: null, center: place ? { lat: place.lat, lng: place.lng } : null } },
      () => {
        void loadMap(id).then(
          async (res) => {
            const painted = res.ok ? taskMapFromPainted(res.value) : null
            if (!painted) return
            const why = await addMap(instanceId, painted.id)
            if (why) setError(why)
            else onAddedRef.current()
          },
          () => {},
        )
      },
    )
    if (opened) setOpen(false)
    else setRefused(TASK_MAP_NOT_OPENED)
  }

  return (
    <>
      <button
        type="button"
        data-doer-map
        aria-haspopup="dialog"
        onClick={() => {
          setRefused(null)
          setOpen(true)
        }}
        style={TASK_PILL_STYLE}
        title="Draw a map for this task, or leave a point on one"
      >
        {MAP_PRESS_LABEL}
      </button>
      {error ? (
        <span role="alert" data-doer-map-error style={{ flexBasis: '100%', fontSize: '0.78rem', color: 'var(--text-red-700)', textAlign: 'right' }}>
          {error}
        </span>
      ) : null}
      <TaskChoiceSheet
        open={open}
        title={TASK_MAP_SHEET_TITLE}
        taskTitle={taskWords}
        choices={taskMapStarts(canWalk)}
        onPick={start}
        onClose={() => setOpen(false)}
        labelId="task-doer-map-sheet-title"
        foot={
          refused ? (
            <p role="alert" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-red-700)' }}>
              {refused}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.4, color: 'var(--text-green-700)' }}>{TASK_MAP_SHEET_FOOT}</p>
          )
        }
      />
    </>
  )
}
