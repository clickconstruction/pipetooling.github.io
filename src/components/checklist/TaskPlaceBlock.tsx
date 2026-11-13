import { Suspense, lazy, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { directionsUrlForPoint } from '../../lib/directionsUrl'
import { requestMyFix, type MyFix } from '../../lib/materials/myLocation'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import {
  TASK_PLACE_NO_MAP_WORDS,
  TASK_PLACE_PRIVACY_WORDS,
  taskPlaceHowFarWords,
  taskPlaceNoFixWords,
  taskPlacedByWords,
  type TaskPlace,
} from '../../lib/tasks/taskPlace'
import type { OnSiteMapPin } from '../materials/OnSiteMap'

const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }
const pressBlue: CSSProperties = { ...press, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const noMap: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem' }

/**
 * The place's name on a task, under its due line (punch list #328, PR 3). A dot and the name, and
 * the dot wears the task's number once the list has a map over it. A task with no place draws
 * nothing: no empty line, no nudge.
 */
export function TaskPlaceLine({ place, number, overdue }: { place: TaskPlace; number?: number | null; overdue?: boolean }) {
  return (
    <span data-task-place-line style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 600, minWidth: 0 }}>
      <span
        aria-hidden
        style={
          number != null
            ? { flex: 'none', display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%', background: overdue ? '#dc2626' : '#2563eb', color: '#fff', fontSize: '0.6875rem', fontWeight: 800 }
            : { flex: 'none', width: 10, height: 10, borderRadius: '50%', background: '#2563eb', boxShadow: '0 0 0 2px var(--surface), 0 0 0 3px #2563eb' }
        }
      >
        {number != null ? number : ''}
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</span>
    </span>
  )
}

type Asked = { kind: 'idle' } | { kind: 'finding' } | { kind: 'found'; me: MyFix } | { kind: 'none'; words: string }

/**
 * The place, opened (punch list #328, PR 3): a small picture of the spot from above, the way there,
 * and how far the person is on a press. Drawn inside the task's open card.
 *
 * - The picture is still: a map inside a list must not eat the page's scroll. A press on it opens
 *   the same map full size, where it drags and zooms.
 * - **Directions** opens the phone's maps app at the point. It needs nothing from this phone.
 * - **How far am I?** is the one press that asks the phone where it is. The answer is worked out
 *   here and kept only while the card is open. Nothing is saved and nothing is sent.
 * - With no signal the picture does not come, and the block says so. The distance still answers,
 *   since a phone finds itself without a signal.
 */
export function TaskPlaceBlock({ place, placedByName }: { place: TaskPlace; placedByName: string | null }) {
  const [asked, setAsked] = useState<Asked>({ kind: 'idle' })
  const [mapFailed, setMapFailed] = useState(false)
  const [bigOpen, setBigOpen] = useState(false)

  const howFar = useCallback(() => {
    setAsked({ kind: 'finding' })
    requestMyFix(
      (me) => setAsked({ kind: 'found', me }),
      (why) => setAsked({ kind: 'none', words: taskPlaceNoFixWords(why) }),
    )
  }, [])

  const me = asked.kind === 'found' ? asked.me : null
  const far = me ? taskPlaceHowFarWords(me, place) : null
  const pins: OnSiteMapPin[] = [
    { id: 'place', label: place.name, lat: place.lat, lng: place.lng, tone: 'ok' },
    ...(me ? [{ id: 'me', label: 'You', lat: me.lat, lng: me.lng, tone: 'me' as const }] : []),
  ]
  const directions = directionsUrlForPoint(place.lat, place.lng)
  const setMs = place.setAt ? Date.parse(place.setAt) : Number.NaN
  const placedBy = taskPlacedByWords(placedByName, Number.isFinite(setMs) ? formatDenverCalendarDayShort(setMs) : null)

  return (
    <div data-task-place-block style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem' }}>
      {mapFailed ? (
        <p role="status" data-task-place-no-map style={noMap}>
          {TASK_PLACE_NO_MAP_WORDS}
        </p>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setBigOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setBigOpen(true)
            }
          }}
          aria-label={`Open the map of ${place.name}`}
          style={{ height: 150, background: 'var(--bg-muted)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
        >
          <Suspense fallback={null}>
            <OnSiteMapLazy center={place} pins={pins} height={150} focusId="place" still onTilesFailed={() => setMapFailed(true)} />
          </Suspense>
          {/* The picture takes no press of its own: the whole of it is this one press. */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 600 }} />
        </div>
      )}
      {asked.kind === 'found' && far ? (
        <p role="status" data-task-place-far style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          <b>{far.lead}</b>
          {far.sure ? ` ${far.sure}` : ''}
        </p>
      ) : null}
      {asked.kind === 'none' ? (
        <p role="status" data-task-place-no-fix style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          {asked.words}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {directions ? (
          <button type="button" style={pressBlue} onClick={() => openInExternalBrowser(directions)}>
            Directions
          </button>
        ) : null}
        <button type="button" style={press} onClick={howFar} disabled={asked.kind === 'finding'}>
          {asked.kind === 'finding' ? 'Finding you…' : 'How far am I?'}
        </button>
      </div>
      <p style={quiet}>
        {placedBy ? `${placedBy} ` : ''}
        {TASK_PLACE_PRIVACY_WORDS}
      </p>
      {bigOpen ? <TaskPlaceMapSheet title={place.name} place={place} pins={pins} directions={directions} onClose={() => setBigOpen(false)} /> : null}
    </div>
  )
}

/** The same map, full size: it drags, zooms and switches to streets. Read-only; nothing here moves the place. */
function TaskPlaceMapSheet({ title, place, pins, directions, onClose }: { title: string; place: TaskPlace; pins: OnSiteMapPin[]; directions: string | null; onClose: () => void }) {
  const isTopmost = useModalStackEntry()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, onClose])
  return createPortal(
    <div
      data-task-place-map-sheet
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', minHeight: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem', flex: 'none' }}>
            Close
          </button>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 240 }}>
          <Suspense fallback={<p style={{ margin: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the map…</p>}>
            <OnSiteMapLazy center={place} pins={pins} height="100%" focusId="place" />
          </Suspense>
        </div>
        {directions ? (
          <div style={{ flex: 'none', padding: '0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)' }}>
            <button type="button" style={{ ...pressBlue, width: '100%', minHeight: 52 }} onClick={() => openInExternalBrowser(directions)}>
              Directions
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
