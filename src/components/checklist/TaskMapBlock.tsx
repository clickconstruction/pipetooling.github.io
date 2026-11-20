import { Suspense, lazy, useCallback, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { directionsUrlForPoint } from '../../lib/directionsUrl'
import { requestMyFix, type MyFix } from '../../lib/materials/myLocation'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { paintedByWords } from '../../lib/paintedMap/paintedMap'
import { openPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import type { PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { TaskMapRead } from '../../hooks/useTaskMapWhole'
import { paintedLayerMaps } from '../../lib/paintedMap/paintedMapLayer'
import { isRoughFix } from '../../lib/paintedMap/paintedTrack'
import { HOW_FAR_ROUGH_NOTE_WORDS } from '../../lib/tasks/taskPlaceReading'
import { TASK_MAP_WORDS, taskMapFrame, taskMapHowFarWords, taskMapLineParts, taskMapPlaceKey, taskMapStart } from '../../lib/tasks/taskMap'
import { TASK_PLACE_NO_MAP_WORDS, TASK_PLACE_PRIVACY_WORDS, taskPlaceNoFixWords } from '../../lib/tasks/taskPlace'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import type { OnSiteMapPin } from '../materials/OnSiteMap'
import { PAINT_COLOR } from '../paintedMap/paintedMapLook'
import { PreciseReadingLine } from '../paintedMap/PreciseLocationLine'
import { TaskSpotPhotoView } from './TaskPlaceBlock'

const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }
const pressBlue: CSSProperties = { ...press, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const noMap: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem' }

/**
 * The map's name on a task, under its due line (punch list #345): the paint's stroke, the name,
 * its length and its places. For a task that has a map and no place. A map that is gone draws
 * nothing.
 */
export function TaskMapLine({ map }: { map: TaskMapRead }) {
  if (map.kind === 'none' || map.kind === 'gone') return null
  // The name gives way on a narrow card. The length and the places stay whole.
  const parts = map.kind === 'read' ? taskMapLineParts(map.whole.map.name, map.whole.lines, map.whole.places.length) : { name: TASK_MAP_WORDS.reading, summary: '' }
  return (
    <span data-task-map-line style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 600, minWidth: 0 }}>
      <span role="img" aria-label={TASK_MAP_WORDS.mark} style={{ flex: 'none', width: 16, height: 4, borderRadius: 2, background: PAINT_COLOR }} />
      <span style={{ display: 'flex', minWidth: 0 }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts.name}</span>
        {parts.summary ? <span style={{ flex: 'none', whiteSpace: 'pre' }}>{` · ${parts.summary}`}</span> : null}
      </span>
    </span>
  )
}

type Asked = { kind: 'idle' } | { kind: 'finding' } | { kind: 'found'; me: MyFix } | { kind: 'none'; words: string }

/**
 * The painted map, opened on a task that has no place (punch list #345): a small picture from above
 * with the line and its numbered places, and three presses.
 *
 * - **Open the map** is the painted map's own window: its places with their words and photos, its
 *   lengths, and Add to it. The picture is the same press.
 * - **Directions to the start** opens the phone's maps app at the line's first point. A maps app
 *   can route to a gate on a road. It cannot follow a painted line.
 * - **How far am I?** is the one press that asks the phone where it is, and it measures to the
 *   start. The answer is kept only while the card is open. Nothing is saved and nothing is sent.
 * - `canOpen` is false where the map's window would open under the window this block sits in.
 */
export function TaskMapBlock({ whole, paintedByName = null, photoUrl = null, canOpen = true }: { whole: PaintedMapWhole; paintedByName?: string | null; /** The giver's photo of the spot, beside the picture. */ photoUrl?: string | null; canOpen?: boolean }) {
  const [asked, setAsked] = useState<Asked>({ kind: 'idle' })
  const [mapFailed, setMapFailed] = useState(false)

  const howFar = useCallback(() => {
    setAsked({ kind: 'finding' })
    requestMyFix(
      (me) => setAsked({ kind: 'found', me }),
      (why) => setAsked({ kind: 'none', words: taskPlaceNoFixWords(why) }),
    )
  }, [])

  const painted = paintedLayerMaps([whole])
  const frame = taskMapFrame(whole.lines, whole.places)
  const start = taskMapStart(whole.lines, whole.places)
  const found = asked.kind === 'found' ? asked.me : null
  // A rough reading is an area and not a spot (#402): no distance is said from its middle, and no dot is drawn there.
  const areaM = found && isRoughFix(found.accuracyM) ? found.accuracyM : null
  const me = areaM == null ? found : null
  const far = me && start ? taskMapHowFarWords(me, start) : null
  const pins: OnSiteMapPin[] = me ? [{ id: 'me', label: 'You', lat: me.lat, lng: me.lng, tone: 'me' }] : []
  const directions = start ? directionsUrlForPoint(start.lat, start.lng) : null
  const madeMs = Date.parse(whole.map.createdAt)
  const paintedBy = paintedByWords(paintedByName, Number.isFinite(madeMs) ? formatDenverCalendarDayShort(madeMs) : null)
  const open = () => openPaintedMap(whole.map.id)
  const key = taskMapPlaceKey(whole.places)

  return (
    <div data-task-map-block style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem' }}>
      <div style={photoUrl ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'stretch' } : undefined}>
        {photoUrl ? <TaskSpotPhotoView url={photoUrl} height={150} /> : null}
        {!frame ? null : mapFailed ? (
          <p role="status" data-task-map-no-picture style={noMap}>
            {TASK_PLACE_NO_MAP_WORDS}
          </p>
        ) : (
          <div
            {...(canOpen
              ? {
                  role: 'button',
                  tabIndex: 0,
                  onClick: open,
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      open()
                    }
                  },
                  'aria-label': `Open the map ${whole.map.name}`,
                }
              : { role: 'img', 'aria-label': `The map ${whole.map.name}, seen from above` })}
            data-task-map-picture
            style={{ height: 150, background: 'var(--bg-muted)', borderRadius: 10, overflow: 'hidden', cursor: canOpen ? 'pointer' : 'default', position: 'relative' }}
          >
            <Suspense fallback={null}>
              <OnSiteMapLazy center={frame.center} pins={pins} height={150} startZoom={frame.zoom} still onTilesFailed={() => setMapFailed(true)} painted={painted} />
            </Suspense>
            {/* The picture takes no press of its own: the whole of it is one press. */}
            <span aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 600 }} />
          </div>
        )}
      </div>
      {key.named.length > 0 ? (
        <p data-task-map-places style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
          {key.named.map((p) => (
            <span key={p.id}>
              <b>{p.number}</b> {p.name}
            </span>
          ))}
          {key.more > 0 ? <span style={{ color: 'var(--text-muted)' }}>and {key.more} more</span> : null}
        </p>
      ) : null}
      {asked.kind === 'found' && far ? (
        <p role="status" data-task-map-far style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          <b>{far.lead}</b>
          {far.sure ? ` ${far.sure}` : ''}
        </p>
      ) : null}
      {areaM != null ? (
        <div data-task-map-far-rough>
          <PreciseReadingLine accuracyM={areaM} roughNote={HOW_FAR_ROUGH_NOTE_WORDS} />
        </div>
      ) : null}
      {asked.kind === 'none' ? (
        <p role="status" data-task-map-no-fix style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          {asked.words}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {canOpen ? (
          <button type="button" data-task-map-open style={pressBlue} onClick={open}>
            {TASK_MAP_WORDS.open}
          </button>
        ) : null}
        {directions ? (
          <button type="button" data-task-map-directions style={canOpen ? press : pressBlue} onClick={() => openInExternalBrowser(directions)}>
            {TASK_MAP_WORDS.directionsToStart}
          </button>
        ) : null}
        {start ? (
          <button type="button" data-task-map-how-far style={press} onClick={howFar} disabled={asked.kind === 'finding'}>
            {asked.kind === 'finding' ? TASK_MAP_WORDS.finding : TASK_MAP_WORDS.howFar}
          </button>
        ) : null}
      </div>
      <p style={quiet}>
        {paintedBy ? `${paintedBy} ` : ''}
        {TASK_PLACE_PRIVACY_WORDS}
      </p>
    </div>
  )
}
