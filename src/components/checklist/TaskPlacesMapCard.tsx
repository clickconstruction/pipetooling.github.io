import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { directionsUrlForPoint } from '../../lib/directionsUrl'
import { requestMyFix, type MyFix } from '../../lib/materials/myLocation'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { MapCanvasPin } from '../../lib/map/mapCanvasTypes'
import {
  TASK_PLACE_PRIVACY_WORDS,
  taskPlaceDotGroups,
  taskPlaceDots,
  taskPlaceNoFixWords,
  taskPlacesCountWords,
  taskPlacesDefaultLayer,
  tasksWithoutPlaceWords,
  type TaskPlace,
} from '../../lib/tasks/taskPlace'

const TaskPlacesMapCanvasLazy = lazy(() => import('./TaskPlacesMapCanvas'))

const HIDDEN_KEY = 'task_places_map_hidden'
const ME_ID = '__me'
const DUE = '#2563eb'
const OVERDUE = '#dc2626'
const ME = '#111827'

function readHidden(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}
function writeHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(HIDDEN_KEY, '1')
    else localStorage.removeItem(HIDDEN_KEY)
  } catch {
    // The fold still works for this visit.
  }
}

export type TaskPlacesMapTask = { id: string; title: string; place: TaskPlace | null; overdue?: boolean }

type Props = {
  /** The open tasks of the list under the map, in the list's order. Tasks with no place are counted, never dropped. */
  tasks: ReadonlyArray<TaskPlacesMapTask>
  /** Show the task: the list scrolls to its card and opens it. */
  onShowTask: (taskId: string) => void
  /** The person asked where they are (or the reading went away): the list puts the distance on each task's line. */
  onMe?: (me: MyFix | null) => void
}

/** Over the map's own controls (Leaflet's sit at 800 to 1000), inside the card's own stacking box. */
const overlay: CSSProperties = { position: 'absolute', zIndex: 1001, font: 'inherit', fontSize: '0.75rem', fontWeight: 700 }
const linkPress: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: '0.8125rem', fontFamily: 'inherit' }
const press: CSSProperties = { minHeight: 40, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }

/**
 * Where my tasks are (punch list #328, PR 4): the first block of the Today tab, and so the top of
 * Task Mode. Every open task that has a place is a numbered dot, and the number is the one its card
 * wears in the list below.
 *
 * - Tasks at one place share a dot (`taskPlaceDotGroups`). A press on a dot lists them under the
 *   map, each with Show the task, and Directions once for the place.
 * - Tasks with no place are counted in a line and stay in the list. With no place on any task
 *   there is no map at all.
 * - Hide map folds it, and the device remembers.
 * - Show where I am is a press. The reading puts a dot for the person on the map and a distance on
 *   every task's line for this visit. It is not saved and not sent.
 *
 * The canvas is the app's shared one (`PinsMapCanvas`, through `TaskPlacesMapCanvas`), with a view
 * from above laid over its streets while the dots sit on one property.
 */
export function TaskPlacesMapCard({ tasks, onShowTask, onMe }: Props) {
  const isMobile = useIsMobile()
  const [hidden, setHidden] = useState<boolean>(() => readHidden())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [me, setMe] = useState<MyFix | null>(null)
  const [asking, setAsking] = useState(false)
  const [noFix, setNoFix] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)

  const { groups, withoutPlace } = useMemo(() => {
    const placed = taskPlaceDots(tasks)
    return { groups: taskPlaceDotGroups(placed.dots), withoutPlace: placed.withoutPlace }
  }, [tasks])
  const titleById = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks])
  const [layerPick, setLayerPick] = useState<'satellite' | 'streets' | null>(null)
  const layer = layerPick ?? taskPlacesDefaultLayer(groups)

  // The dots changed (a task was done, a place was set): frame them again, and drop a pick that is gone.
  const groupsKey = groups.map((g) => `${g.id}:${g.lat}:${g.lng}`).join('|')
  useEffect(() => {
    setFitSignal((n) => n + 1)
    setSelectedId((cur) => (cur && groups.some((g) => g.id === cur) ? cur : null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey])

  const showWhereIAm = useCallback(() => {
    setAsking(true)
    setNoFix(null)
    requestMyFix(
      (fix) => {
        setAsking(false)
        setMe(fix)
        onMe?.(fix)
        setFitSignal((n) => n + 1)
      },
      (why) => {
        setAsking(false)
        setNoFix(taskPlaceNoFixWords(why))
      },
    )
  }, [onMe])

  if (groups.length === 0) return null

  const pins: MapCanvasPin[] = [
    ...groups.map((g) => ({ id: g.id, lat: g.lat, lng: g.lng, color: g.overdue ? OVERDUE : DUE, title: g.name, label: g.label })),
    ...(me ? [{ id: ME_ID, lat: me.lat, lng: me.lng, color: ME, ringColor: '#ffffff', title: 'You' }] : []),
  ]
  const selected = groups.find((g) => g.id === selectedId) ?? null
  const directions = selected ? directionsUrlForPoint(selected.lat, selected.lng) : null
  const without = tasksWithoutPlaceWords(withoutPlace, groups.reduce((n, g) => n + g.taskIds.length, 0))
  const height = isMobile ? 220 : 300

  const fold = (next: boolean) => {
    setHidden(next)
    writeHidden(next)
  }

  return (
    <section data-task-places-map aria-label="Where my tasks are" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Where my tasks are</h2>
        {hidden ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{taskPlacesCountWords(groups.length)}</span> : null}
        <button type="button" style={{ ...linkPress, marginLeft: 'auto' }} onClick={() => fold(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show map' : 'Hide map'}
        </button>
      </div>
      {hidden ? null : (
        <>
          <div className={layer === 'satellite' ? 'mapImagery' : undefined} style={{ position: 'relative', isolation: 'isolate', background: 'var(--bg-muted)', height }}>
            <Suspense fallback={null}>
              <TaskPlacesMapCanvasLazy
                key={isMobile ? 'phone' : 'desk'}
                layer={layer}
                pins={pins}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id === ME_ID ? null : id)}
                fitSignal={fitSignal}
                height={height}
                isMobile={isMobile}
                scrollZoomAfterClick
              />
            </Suspense>
            <div role="group" aria-label="Map view" style={{ ...overlay, right: 8, top: 8, display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
              {(['satellite', 'streets'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={layer === l}
                  onClick={() => setLayerPick(l)}
                  style={{ border: 'none', padding: '0.35rem 0.55rem', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 700, background: layer === l ? 'var(--text-strong)' : 'var(--surface)', color: layer === l ? 'var(--surface)' : 'var(--text-strong)' }}
                >
                  {l === 'satellite' ? 'Satellite' : 'Streets'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={showWhereIAm}
              disabled={asking}
              style={{ ...overlay, left: 10, top: 80, minHeight: 32, padding: '0 0.7rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: asking ? 'default' : 'pointer' }}
            >
              {asking ? 'Finding you…' : me ? 'Find me again' : 'Show where I am'}
            </button>
          </div>
          {noFix ? (
            <p role="status" data-task-places-no-fix style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderTop: '1px solid var(--border-amber)' }}>
              {noFix}
            </p>
          ) : null}
          {me && !noFix ? (
            <p role="status" data-task-places-me style={{ margin: 0, padding: '0.4rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              The dark dot is you. {TASK_PLACE_PRIVACY_WORDS}
            </p>
          ) : null}
          {selected ? (
            <div data-task-places-selected style={{ display: 'grid', gap: '0.45rem', padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', background: 'var(--bg-blue-tint)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.9375rem', color: 'var(--text-strong)' }}>{selected.name}</b>
                {directions ? (
                  <button type="button" style={{ ...press, marginLeft: 'auto', border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }} onClick={() => openInExternalBrowser(directions)}>
                    Directions
                  </button>
                ) : null}
              </div>
              {selected.taskIds.map((id, i) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <span aria-hidden style={{ flex: 'none', display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%', background: selected.overdue ? OVERDUE : DUE, color: '#fff', fontSize: '0.6875rem', fontWeight: 800 }}>{selected.numbers[i]}</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.875rem', lineHeight: 1.3, color: 'var(--text-strong)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{titleById.get(id) ?? 'Task'}</span>
                  <button type="button" style={{ ...press, flex: 'none' }} onClick={() => onShowTask(id)}>
                    Show the task
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {without ? (
            <p data-task-places-without style={{ margin: 0, padding: '0.45rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)', borderTop: '1px solid var(--border)' }}>
              {without}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
