import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { directionsUrlForPoint } from '../../lib/directionsUrl'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { MapCanvasPin } from '../../lib/map/mapCanvasTypes'
import {
  TASK_PLACE_SHARED_COLOR,
  openTasksWithoutPlaceWords,
  taskPlacePersonColor,
  taskPlaceTeamDots,
  taskPlacesCountWords,
  taskPlacesDefaultLayer,
  type TaskPlace,
} from '../../lib/tasks/taskPlace'

const TaskPlacesMapCanvasLazy = lazy(() => import('./TaskPlacesMapCanvas'))

const HIDDEN_KEY = 'task_places_team_map_hidden'

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

export type TaskPlacesTeamPerson = { userId: string; name: string; tasks: Array<{ id: string; title: string; place: TaskPlace | null }> }

/** Over the map's own controls (Leaflet's sit at 800 to 1000), inside the card's own stacking box. */
const overlay: CSSProperties = { position: 'absolute', zIndex: 1001, font: 'inherit', fontSize: '0.75rem', fontWeight: 700 }
const linkPress: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: '0.8125rem', fontFamily: 'inherit' }
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, borderRadius: 999, padding: '4px 11px', minHeight: 30, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const chipOn: CSSProperties = { ...chip, background: 'var(--text-strong)', color: 'var(--surface)', borderColor: 'var(--text-strong)' }

/**
 * Where the open tasks are (punch list #328, PR 7): the leader's map on the Review tab, over
 * Outstanding by person. Every person's open tasks that have a place, one colour a person, and a
 * press on a name shows that person alone. A dot several people share is navy and wears its count.
 *
 * It shows where the tasks are, so two people sent to one corner on one morning can be seen before
 * they are sent. It never shows where a person is, and it asks no phone for anything.
 */
export function TaskPlacesTeamMapCard({ people }: { people: ReadonlyArray<TaskPlacesTeamPerson> }) {
  const isMobile = useIsMobile()
  const [hidden, setHidden] = useState<boolean>(() => readHidden())
  const [onlyUserId, setOnlyUserId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [layerPick, setLayerPick] = useState<'satellite' | 'streets' | null>(null)
  const [fitSignal, setFitSignal] = useState(0)

  // The people with a place on some task, in the board's own order: that order is each person's colour.
  const placed = useMemo(
    () =>
      people
        .map((p) => ({ userId: p.userId, name: p.name, count: p.tasks.filter((t) => t.place).length }))
        .filter((p) => p.count > 0)
        .map((p, i) => ({ ...p, color: taskPlacePersonColor(i) })),
    [people],
  )
  const only = onlyUserId && placed.some((p) => p.userId === onlyUserId) ? onlyUserId : null
  const { dots, withoutPlace } = useMemo(
    () =>
      taskPlaceTeamDots(
        people
          .filter((p) => !only || p.userId === only)
          .flatMap((p) => p.tasks.map((t) => ({ id: `${p.userId}:${t.id}`, title: t.title, personId: p.userId, place: t.place }))),
      ),
    [people, only],
  )
  const colorOf = useMemo(() => new Map(placed.map((p) => [p.userId, p.color])), [placed])
  const nameOf = useMemo(() => new Map(people.map((p) => [p.userId, p.name])), [people])
  const layer = layerPick ?? taskPlacesDefaultLayer(dots)

  const dotsKey = dots.map((d) => `${d.id}:${d.tasks.length}`).join('|')
  useEffect(() => {
    setFitSignal((n) => n + 1)
    setSelectedId((cur) => (cur && dots.some((d) => d.id === cur) ? cur : null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotsKey])

  if (placed.length === 0) return null

  const pins: MapCanvasPin[] = dots.map((d) => ({
    id: d.id,
    lat: d.lat,
    lng: d.lng,
    color: d.personIds.length === 1 ? (colorOf.get(d.personIds[0]!) ?? TASK_PLACE_SHARED_COLOR) : TASK_PLACE_SHARED_COLOR,
    title: d.name,
    label: d.tasks.length > 1 ? String(d.tasks.length) : undefined,
  }))
  const selected = dots.find((d) => d.id === selectedId) ?? null
  const directions = selected ? directionsUrlForPoint(selected.lat, selected.lng) : null
  const total = placed.reduce((n, p) => n + p.count, 0)
  const without = openTasksWithoutPlaceWords(withoutPlace, dots.reduce((n, d) => n + d.tasks.length, 0))
  const height = isMobile ? 220 : 300
  const fold = (next: boolean) => {
    setHidden(next)
    writeHidden(next)
  }

  return (
    <section data-task-places-team-map aria-label="Where the open tasks are" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Where the open tasks are</h3>
        {hidden ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{taskPlacesCountWords(dots.length)}</span> : null}
        <button type="button" style={{ ...linkPress, marginLeft: 'auto' }} onClick={() => fold(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show map' : 'Hide map'}
        </button>
      </div>
      {hidden ? null : (
        <>
          <div role="group" aria-label="Whose tasks" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 0.75rem 0.6rem' }}>
            <button type="button" aria-pressed={only === null} style={only === null ? chipOn : chip} onClick={() => setOnlyUserId(null)}>
              Everyone · {total}
            </button>
            {placed.map((p) => (
              <button key={p.userId} type="button" aria-pressed={only === p.userId} style={only === p.userId ? chipOn : chip} onClick={() => setOnlyUserId(only === p.userId ? null : p.userId)}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flex: 'none' }} />
                {p.name} · {p.count}
              </button>
            ))}
          </div>
          <div className={layer === 'satellite' ? 'mapImagery' : undefined} style={{ position: 'relative', isolation: 'isolate', background: 'var(--bg-muted)', height }}>
            <Suspense fallback={null}>
              <TaskPlacesMapCanvasLazy key={isMobile ? 'phone' : 'desk'} layer={layer} pins={pins} selectedId={selectedId} onSelect={setSelectedId} fitSignal={fitSignal} height={height} isMobile={isMobile} scrollZoomAfterClick />
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
          </div>
          {selected ? (
            <div data-task-places-team-selected style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', background: 'var(--bg-blue-tint)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.9375rem', color: 'var(--text-strong)' }}>{selected.name}</b>
                {directions ? (
                  <button type="button" style={{ marginLeft: 'auto', minHeight: 40, padding: '0 0.8rem', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => openInExternalBrowser(directions)}>
                    Directions
                  </button>
                ) : null}
              </div>
              {selected.tasks.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', minWidth: 0, fontSize: '0.875rem', color: 'var(--text-strong)' }}>
                  <span aria-hidden style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: colorOf.get(t.personId) ?? TASK_PLACE_SHARED_COLOR, transform: 'translateY(1px)' }} />
                  <b style={{ flex: 'none' }}>{nameOf.get(t.personId) ?? 'Someone'}</b>
                  <span style={{ minWidth: 0 }}>{t.title}</span>
                </div>
              ))}
            </div>
          ) : null}
          {without ? (
            <p data-task-places-team-without style={{ margin: 0, padding: '0.45rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)', borderTop: '1px solid var(--border)' }}>
              {without}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
