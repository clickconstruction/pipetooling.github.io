import { Suspense, lazy, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { openPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMap, type Landed, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { paintedLayerMaps, type PaintedLayerMap } from '../../lib/paintedMap/paintedMapLayer'
import { TASK_PLACE_WAY_WORDS, taskPlaceWayStart, taskPlaceWayWords } from '../../lib/tasks/taskPlaceWay'
import { isRoughFix } from '../../lib/paintedMap/paintedTrack'
import { HOW_FAR_ROUGH_NOTE_WORDS } from '../../lib/tasks/taskPlaceReading'
import { PAINT_COLOR, PAINT_SWATCH } from '../paintedMap/paintedMapLook'
import { PreciseReadingLine } from '../paintedMap/PreciseLocationLine'
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
import { TASK_PLACE_WORK_COLOR, taskPlaceDotColor } from '../../lib/tasks/taskPlaceColors'
import type { OnSiteMapPin } from '../materials/OnSiteMap'

const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }
const pressBlue: CSSProperties = { ...press, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const noMap: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem' }

/**
 * The place's name on a task, under its due line (punch list #328, PR 3). A dot and the name, and
 * the dot wears the task's number once the list has a map over it. The dot is the map's own dot,
 * small: the work colour, and red on a late task (`taskPlaceDotColor`, v2.8045). A task with no place draws
 * nothing: no empty line, no nudge.
 */
export function TaskPlaceLine({ place, number, overdue, far }: { place: TaskPlace; number?: number | null; overdue?: boolean; /** An older task that is not late. Its dot is the work colour since v2.8045, as its dot on the map is. */ old?: boolean; /** `250 ft north-east`, once the person asked where they are. */ far?: string | null }) {
  return (
    <span data-task-place-line style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 600, minWidth: 0 }}>
      <span
        aria-hidden
        style={
          number != null
            ? { flex: 'none', display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%', background: taskPlaceDotColor({ overdue: overdue === true }), color: '#fff', fontSize: '0.6875rem', fontWeight: 800 }
            : { flex: 'none', width: 10, height: 10, borderRadius: '50%', background: TASK_PLACE_WORK_COLOR, boxShadow: `0 0 0 2px var(--surface), 0 0 0 3px ${TASK_PLACE_WORK_COLOR}` }
        }
      >
        {number != null ? number : ''}
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</span>
      {/* The paint's stroke (punch list #345): this place comes with the painted way to it. */}
      {place.mapId ? <span role="img" aria-label="The way in is painted" data-task-place-line-way style={{ flex: 'none', width: 16, height: 4, borderRadius: 2, background: PAINT_COLOR }} /> : null}
      {far ? <span data-task-place-line-far style={{ flex: 'none', fontWeight: 500, color: 'var(--text-muted)' }}>· {far}</span> : null}
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
 * - **The way in** (punch list #345, step 5): a place that carries a painted map draws its line on
 *   both pictures and says its name and length. **Directions** then goes to the line's start, since
 *   a maps app can route to a gate and cannot follow a painted line, and **Open the map** opens the
 *   painted map's own window. A map that is gone or cannot be read leaves the block as it was.
 */
export function TaskPlaceBlock({
  place,
  placedByName,
  photoUrl = null,
  canOpenWay = true,
  loadWay = loadPaintedMap,
}: {
  place: TaskPlace
  placedByName: string | null
  /** The giver's photo of the spot (PR 6): drawn beside the picture from above, so the two together need no other words. */
  photoUrl?: string | null
  /** False where the painted map's window would open under the window this block sits in (the roadmap's canvas). */
  canOpenWay?: boolean
  /** The painted map the place carries, read once when the card opens. For a smoke. */
  loadWay?: (mapId: string) => Promise<Landed<PaintedMapWhole | null>>
}) {
  const [asked, setAsked] = useState<Asked>({ kind: 'idle' })
  const [mapFailed, setMapFailed] = useState(false)
  const [bigOpen, setBigOpen] = useState(false)
  const [way, setWay] = useState<{ mapId: string; whole: PaintedMapWhole } | null>(null)
  const mapId = place.mapId ?? null

  useEffect(() => {
    if (!mapId) return
    let cancelled = false
    void loadWay(mapId).then(
      (res) => {
        if (!cancelled && res.ok && res.value) setWay({ mapId, whole: res.value })
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [mapId, loadWay])

  // A read for another map, kept from a card that changed under the block, is not this place's way.
  const whole = way && way.mapId === mapId ? way.whole : null
  const painted: PaintedLayerMap[] | undefined = whole ? paintedLayerMaps([whole]) : undefined
  const wayStart = whole ? taskPlaceWayStart(whole.lines, whole.places) : null

  const howFar = useCallback(() => {
    setAsked({ kind: 'finding' })
    requestMyFix(
      (me) => setAsked({ kind: 'found', me }),
      (why) => setAsked({ kind: 'none', words: taskPlaceNoFixWords(why) }),
    )
  }, [])

  const found = asked.kind === 'found' ? asked.me : null
  // A rough reading is an area and not a spot (#402): no distance is said from its middle, and no dot is drawn there.
  const areaM = found && isRoughFix(found.accuracyM) ? found.accuracyM : null
  const me = areaM == null ? found : null
  const far = me ? taskPlaceHowFarWords(me, place) : null
  const pins: OnSiteMapPin[] = [
    { id: 'place', label: place.name, lat: place.lat, lng: place.lng, tone: 'ok' },
    ...(me ? [{ id: 'me', label: 'You', lat: me.lat, lng: me.lng, tone: 'me' as const }] : []),
  ]
  const directions = wayStart ? directionsUrlForPoint(wayStart.lat, wayStart.lng) : directionsUrlForPoint(place.lat, place.lng)
  const directionsLabel = wayStart ? TASK_PLACE_WAY_WORDS.directionsToStart : 'Directions'
  const setMs = place.setAt ? Date.parse(place.setAt) : Number.NaN
  const placedBy = taskPlacedByWords(placedByName, Number.isFinite(setMs) ? formatDenverCalendarDayShort(setMs) : null)

  return (
    <div data-task-place-block style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem' }}>
      <div style={photoUrl ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'stretch' } : undefined}>
      {photoUrl ? <TaskSpotPhotoView url={photoUrl} height={150} /> : null}
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
            <OnSiteMapLazy center={place} pins={pins} height={150} focusId="place" still onTilesFailed={() => setMapFailed(true)} {...(painted ? { painted } : {})} />
          </Suspense>
          {/* The picture takes no press of its own: the whole of it is this one press. */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 600 }} />
        </div>
      )}
      </div>
      {whole ? (
        <p data-task-place-way style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 600 }}>
          <span aria-hidden style={PAINT_SWATCH} />
          <span style={{ minWidth: 0 }}>{taskPlaceWayWords(whole.map.name, whole.lines)}</span>
        </p>
      ) : null}
      {asked.kind === 'found' && far ? (
        <p role="status" data-task-place-far style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          <b>{far.lead}</b>
          {far.sure ? ` ${far.sure}` : ''}
        </p>
      ) : null}
      {areaM != null ? (
        <div data-task-place-far-rough>
          <PreciseReadingLine accuracyM={areaM} roughNote={HOW_FAR_ROUGH_NOTE_WORDS} />
        </div>
      ) : null}
      {asked.kind === 'none' ? (
        <p role="status" data-task-place-no-fix style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          {asked.words}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {directions ? (
          <button type="button" style={pressBlue} onClick={() => openInExternalBrowser(directions)}>
            {directionsLabel}
          </button>
        ) : null}
        {whole && canOpenWay ? (
          <button type="button" data-task-place-way-open style={press} onClick={() => openPaintedMap(whole.map.id)}>
            {TASK_PLACE_WAY_WORDS.open}
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
      {bigOpen ? <TaskPlaceMapSheet title={place.name} place={place} pins={pins} directions={directions} directionsLabel={directionsLabel} painted={painted} onClose={() => setBigOpen(false)} /> : null}
    </div>
  )
}

/** The same map, full size: it drags, zooms and switches to streets. Read-only; nothing here moves the place. */
function TaskPlaceMapSheet({ title, place, pins, directions, directionsLabel, painted, onClose }: { title: string; place: TaskPlace; pins: OnSiteMapPin[]; directions: string | null; directionsLabel: string; painted?: PaintedLayerMap[]; onClose: () => void }) {
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
            <OnSiteMapLazy center={place} pins={pins} height="100%" focusId="place" {...(painted ? { painted } : {})} />
          </Suspense>
        </div>
        {directions ? (
          <div style={{ flex: 'none', padding: '0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)' }}>
            <button type="button" style={{ ...pressBlue, width: '100%', minHeight: 52 }} onClick={() => openInExternalBrowser(directions)}>
              {directionsLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/**
 * The giver's photo of the spot, as the person doing the task sees it (punch list #328, PR 6). A
 * press opens it full size. Drawn beside the place's map, or by itself on a task that has a photo
 * and no place.
 */
export function TaskSpotPhotoView({ url, height = 180 }: { url: string; height?: number }) {
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <>
      <button
        type="button"
        data-task-spot-photo
        onClick={() => setOpen(true)}
        aria-label="Open the photo of the spot"
        style={{ display: 'block', width: '100%', height, padding: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-muted)', cursor: 'pointer' }}
      >
        <img src={url} alt="The spot" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </button>
      {open ? <TaskSpotPhotoSheet url={url} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function TaskSpotPhotoSheet({ url, onClose }: { url: string; onClose: () => void }) {
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
      data-task-spot-photo-sheet
      role="dialog"
      aria-modal="true"
      aria-label="The photo of the spot"
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', display: 'grid', placeItems: 'center', padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <img src={url} alt="The spot" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
      <button type="button" onClick={onClose} style={{ position: 'absolute', right: 12, top: 'calc(12px + env(safe-area-inset-top, 0px))', minHeight: 40, padding: '0 0.9rem', borderRadius: 999, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Close
      </button>
    </div>,
    document.body,
  )
}
