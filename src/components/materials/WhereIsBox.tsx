/**
 * Where is it? on a cage or a box (punch list #372, step 2): one body for the phone's sheet and the office's box
 * window. Words first, then the newest photo, then the view from above with the box's pin and the other boxes of its
 * place faint around it. **Show where I am** adds the reader's own dot, a dashed straight line and an honest distance;
 * the dot is drawn here and sent nowhere. **I found it** reads the phone once and pins the box where the finder
 * stands, so every search ends by correcting the record. **Move the pin by hand** is the map to drag, for a pin that
 * landed wrong or a phone that cannot say where it is.
 *
 * A reading that is only an area (punch list #402, call 8) pins nothing, measures nothing and moves no map. The
 * sheet then draws the Precise Location line with the way to the switch, in place of *Try again in the open*, which
 * would not help. **Use my location** draws the line in every state, as a task's Use where I am does. When the map
 * has nowhere to open and that press gets an area, a refusal or nothing, the map opens wide to be dragged, and
 * **Put A7 here** waits until the ring has left the wide start (`boxMapStart.ts`).
 *
 * The words and the rules are `whereIsBox.ts`. Leaflet loads only when this is drawn.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PaintedLayerMap } from '../../lib/paintedMap/paintedMapLayer'
import { directionsUrlForAddress, directionsUrlForPoint } from '../../lib/directionsUrl'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { requestMyFix, type LatLng, type MyFix } from '../../lib/materials/myLocation'
import { boxMapOpening, boxMapReading, boxPinReady } from '../../lib/materials/boxMapStart'
import type { Container, ContainerMove, Movement, Place } from '../../lib/materials/onSite'
import type { PhotoNote } from '../../lib/materials/photo'
import { pinContainer } from '../../lib/materials/onSiteStore'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { taskPlaceNoFixWords, taskPlaceSheetAccuracy } from '../../lib/tasks/taskPlace'
import { HOW_FAR_ROUGH_NOTE_WORDS, WHERE_I_AM_WEAK_NOTE_WORDS, WHERE_I_AM_WIDE_WORDS, whereIAmRoughNoteWords, whereIAmRoughWideNoteWords } from '../../lib/tasks/taskPlaceReading'
import { isRoughFix } from '../../lib/paintedMap/paintedTrack'
import { useRoughHeld } from '../../hooks/usePreciseLocation'
import { PreciseReadingLine } from '../paintedMap/PreciseLocationLine'
import {
  WHERE_DIRECTIONS_PRESS,
  WHERE_FOUND_PRESS,
  WHERE_MOVE_PIN_PRESS,
  WHERE_PRIVACY_WORDS,
  WHERE_SAME_PLACE_PRESS,
  WHERE_SEND_SOMEONE_PRESS,
  WHERE_SHOW_ME_PRESS,
  WHERE_SITE_DIRECTIONS_PRESS,
  WHERE_TRY_AGAIN_PRESS,
  boxIsPinned,
  findBoxTask,
  type FindBoxTask,
  foundNoFixWords,
  foundRoughNoteWords,
  foundVerdict,
  lastPutOf,
  WHERE_LIVE_FIX_MS,
  lastTouchOf,
  newestPhotoWords,
  noPlaceAsk,
  stillThereAsk,
  whereIsBoxFar,
  whereIsBoxWords,
  whereMapPins,
  whereNoPinWords,
} from '../../lib/materials/whereIsBox'
import { BoxPhotos } from './PhotoPress'
import { PLACE_WAY_OPEN_PRESS, placeWayName, placeWaySentence } from '../../lib/materials/placeWay'
import { openPaintedMap } from '../../lib/paintedMap/paintedMapDoor'

const OnSiteMapLazy = lazy(() => import('./OnSiteMap'))

const BLUE = '#2563eb'
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const tint = (bg: string, border: string, color: string): CSSProperties => ({ background: bg, borderWidth: 1, borderStyle: 'solid', borderColor: border, color, borderRadius: 10, padding: '0.55rem 0.7rem', fontSize: '0.9rem', margin: 0 })
const okBox = tint('var(--bg-green-tint)', 'var(--border-green)', 'var(--text-green-700)')
const waitBox = tint('var(--bg-amber-tint)', 'var(--border-amber)', 'var(--text-amber-800)')
const farBox: CSSProperties = { ...tint('var(--bg-blue-tint)', 'var(--border)', 'var(--text-muted)'), display: 'grid', gap: 2 }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 36, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', fontSize: '0.9rem', cursor: 'pointer', justifySelf: 'start', textAlign: 'left' }

type Props = {
  /** The box as the store holds it now, so a pin made here is drawn at once. */
  container: Container
  /** Every container of the box's job: the others of its place are drawn faint. */
  containers: ReadonlyArray<Container>
  places: ReadonlyArray<Place>
  moves: ReadonlyArray<ContainerMove>
  movements: ReadonlyArray<Movement>
  /** The job's box photos; the newest of this box is shown. */
  photos: ReadonlyArray<PhotoNote>
  /** The job's address on the map, where the view opens when the box has no pin. */
  jobCenter: LatLng | null
  jobAddress: string
  /** The job's painted maps (#345), drawn under the pin. */
  painted?: ReadonlyArray<PaintedLayerMap>
  /** Whose name the pin carries on the screen until the row is read again; the database stamps its own. */
  byName: string
  /** Opens the host's Move box: the phone's sheet, the office window's Cage tab. */
  onMoveBox: () => void
  /** Opens the painted way to the box's place (v2.7581). A host with a sheet of its own closes it first; by default the map opens over this one. */
  onOpenWay?: (mapId: string) => void
  /**
   * Send someone to it (v2.7582): the host opens the New task window on this, *Find A7* with the pin as the task's
   * place and the place's way as its map. With no host for it the press is not drawn.
   */
  onSendSomeone?: (task: FindBoxTask) => void
  /** Thumb-sized presses, for the phone. */
  touch?: boolean
  now?: Date
}

export default function WhereIsBox({ container, containers, places, moves, movements, photos, jobCenter, jobAddress, painted, byName, onMoveBox, onOpenWay, onSendSomeone, touch = false, now }: Props) {
  const today = useMemo(() => now ?? new Date(), [now])
  const h = touch ? 48 : 40
  const btn: CSSProperties = { minHeight: h, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }
  const primary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
  const two: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }

  const label = container.label
  const pinned = boxIsPinned(container)
  const pin = pinned ? { lat: container.lat as number, lng: container.lng as number } : null
  const words = whereIsBoxWords({ box: container, places, lastPut: lastPutOf(moves, container.id), lastTouch: lastTouchOf(movements, container.id), now: today })
  const newest = useMemo(() => photos.filter((p) => p.containerId === container.id).sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null, [photos, container.id])

  // The reader's own dot: read only after their press and only while the sheet is open. It is drawn and never sent.
  const [showMe, setShowMe] = useState(false)
  const [me, setMe] = useState<MyFix | null>(null)
  const [noFix, setNoFix] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)
  /** When the newest reading came, so I found it can use it while it is fresh. */
  const meAt = useRef(0)
  useEffect(() => {
    if (!showMe) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNoFix(taskPlaceNoFixWords('none'))
      setShowMe(false)
      return
    }
    setNoFix(null)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setNoFix(null)
        meAt.current = Date.now()
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null })
      },
      (err) => {
        if (err.code === 1) {
          setNoFix(taskPlaceNoFixWords('refused'))
          setShowMe(false)
        } else setNoFix(taskPlaceNoFixWords('failed')) // No position, or none in time: the watch goes on, and a later reading clears the words.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    )
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
      setMe(null)
    }
  }, [showMe])
  // How sure the phone is (#402). A rough reading is an area and not a spot, so it draws no dot and measures no
  // distance. This press follows the phone, so the sheet waits 4 seconds for a better reading before it says so.
  const liveRough = me != null && isRoughFix(me.accuracyM)
  const liveRoughHeld = useRoughHeld(showMe ? (me?.accuracyM ?? null) : null)
  const meSpot = liveRough ? null : me
  const far = meSpot && pin ? whereIsBoxFar(meSpot, pin) : null

  // I found it: one reading, one pin. What became of the press is said at the top of the sheet.
  const [finding, setFinding] = useState(false)
  const [found, setFound] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  // I found it got an area and not a spot: its margin, for the Precise Location line. Nothing was pinned.
  const [refusedRoughM, setRefusedRoughM] = useState<number | null>(null)
  // A later reading that is a spot proves the switch on: what the press said about an area no longer holds.
  useEffect(() => {
    if (me && !isRoughFix(me.accuracyM)) setRefusedRoughM(null)
  }, [me])
  const [asked, setAsked] = useState(false)
  const foundIt = () => {
    if (finding) return
    setRefused(null)
    setRefusedRoughM(null)
    const take = (fix: MyFix) => {
      setFinding(false)
      const v = foundVerdict(label, fix)
      if (!v.ok) {
        // The open sky is not the cure for a phone that gives only an area: the line shows the way to the switch.
        if (isRoughFix(fix.accuracyM)) setRefusedRoughM(fix.accuracyM)
        else setRefused(v.words)
        return
      }
      pinContainer(container.id, v.pin, { accuracyM: v.accuracyM, byName })
      setFound(v.words)
      setAsked(true)
    }
    // The dot is on and its reading is fresh: that reading is where the finder stands, and asking again only waits.
    if (showMe && me && Date.now() - meAt.current < WHERE_LIVE_FIX_MS) {
      take(me)
      return
    }
    setFinding(true)
    requestMyFix(
      take,
      (why) => {
        setFinding(false)
        setRefused(foundNoFixWords(label, why))
      },
    )
  }

  // Move the pin by hand: the map to drag, with the ring at its centre.
  const [placing, setPlacing] = useState(false)
  const [center, setCenter] = useState<LatLng | null>(null)
  const [fly, setFly] = useState<MyFix | null>(null)
  const [locating, setLocating] = useState<string | null>(null)
  // Use my location got an area and not a spot: its margin, for the line. The map was not moved.
  const [flyRoughM, setFlyRoughM] = useState<number | null>(null)
  // Use my location got no spot. A map with nowhere to open then opens wide, so there is still a map to drag.
  const [openWide, setOpenWide] = useState(false)
  const startPlacing = () => { setPlacing(true); setCenter(null); setFly(null); setLocating(null); setFlyRoughM(null); setOpenWide(false); setRefused(null); setRefusedRoughM(null) }
  const useMyLocation = () => {
    setLocating('Finding you…')
    requestMyFix(
      (p) => {
        setLocating(null)
        const read = boxMapReading(p)
        if (read.kind === 'area') {
          setFlyRoughM(read.roughM)
          setOpenWide(true)
          return
        }
        setFlyRoughM(null)
        setFly(read.fly)
      },
      (why) => {
        setFlyRoughM(null)
        setOpenWide(true)
        setLocating(why === 'refused' ? 'Location is off for this app. Drag the map by hand, or allow location in the phone’s settings.' : why === 'none' ? 'This device gives no location. Drag the map by hand.' : 'Could not find you. Drag the map by hand.')
      },
    )
  }
  // The margin belongs to the reading: the line speaks of the phone only while the ring still sits on it.
  const flyAccuracy = fly && center ? taskPlaceSheetAccuracy(fly, center) : null
  const mapPins = whereMapPins(container, containers, today)
  const mapFocusId = pinned ? container.id : null
  const opening = boxMapOpening({ pins: mapPins, focusId: mapFocusId, center: jobCenter, painted, fly, openWide: placing && openWide })
  // The wide view's own centre is nobody's place: the press waits for a drag.
  const canPut = boxPinReady(center, opening.wide)
  const putHere = () => {
    if (!center || !canPut) return
    // The phone's margin stands only while the ring is still on the phone's reading; a drag makes it a person's word.
    pinContainer(container.id, center, { accuracyM: taskPlaceSheetAccuracy(fly, center), byName })
    setPlacing(false)
    setFound(`${label} is pinned where the ring was.`)
    setAsked(true)
  }
  const removePin = () => {
    pinContainer(container.id, null)
    setPlacing(false)
    setFound(`${label}’s pin is removed.`)
    setAsked(false)
  }

  const directions = pin ? directionsUrlForPoint(pin.lat, pin.lng) : directionsUrlForAddress(jobAddress)
  const directionsPress = directions ? <button type="button" style={btn} onClick={() => openInExternalBrowser(directions)}>{pin ? WHERE_DIRECTIONS_PRESS : WHERE_SITE_DIRECTIONS_PRESS}</button> : null
  const foundPress = (strong: boolean) => <button type="button" style={strong ? primary : btn} onClick={foundIt} aria-busy={finding}>{finding ? 'Finding you…' : WHERE_FOUND_PRESS}</button>
  const still = stillThereAsk(label, places, container.locationId)
  // The way to the box's place, painted once by someone who knows the site (v2.7581): it knows the gate and the fence.
  const place = places.find((p) => p.id === container.locationId) ?? null
  const wayId = place?.wayMapId ?? null
  // The way's name as its painter left it, when the job's maps are read; else the name it was made with.
  const sendSomeone = onSendSomeone
    ? () => onSendSomeone(findBoxTask({ box: container, places, way: place && wayId ? { id: wayId, name: painted?.find((m) => m.id === wayId)?.name ?? placeWayName(place.name) } : null }))
    : null
  const sendPress = sendSomeone && !placing ? <button type="button" style={btn} onClick={sendSomeone}>{WHERE_SEND_SOMEONE_PRESS}</button> : null

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="where-is-box">
      {found ? <p role="status" style={{ ...okBox, fontWeight: 600 }}>{found}</p> : null}
      {refused ? <p role="alert" style={waitBox}>{refused}</p> : null}
      {refusedRoughM != null ? (
        <div data-testid="where-is-box-rough">
          <PreciseReadingLine accuracyM={refusedRoughM} roughNote={(kind) => foundRoughNoteWords(label, kind)} />
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: '0.2rem' }} data-testid="where-is-box-words">
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)' }}>{words.lead}</span>
        {words.lines.map((line) => <span key={line}>{line}</span>)}
      </div>
      {words.old && !found ? <p style={waitBox}>{words.old}</p> : null}
      {place && wayId && !placing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }} data-testid="where-is-box-way">
          <span style={{ minWidth: 0 }}>{placeWaySentence(place.name)}</span>
          <button type="button" style={{ ...btn, width: 'auto', minHeight: touch ? 44 : 36, flex: 'none' }} onClick={() => (onOpenWay ? onOpenWay(wayId) : void openPaintedMap(wayId, jobAddress || null))}>{PLACE_WAY_OPEN_PRESS}</button>
        </div>
      ) : null}
      {asked && !placing ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{still ?? noPlaceAsk(label)}</span>
          <div style={two}>
            {still ? <button type="button" style={btn} onClick={() => setAsked(false)}>{WHERE_SAME_PLACE_PRESS}</button> : null}
            <button type="button" style={btn} onClick={onMoveBox}>Move box</button>
          </div>
        </div>
      ) : null}
      {far && !placing ? (
        <p style={farBox} data-testid="where-is-box-far">
          <strong style={{ fontSize: '1.1rem', color: 'var(--text-strong)' }}>{far.lead}</strong>
          <span style={{ fontSize: '0.82rem' }}>{[far.sure, far.rough ? null : far.note].filter(Boolean).join(' ')}</span>
        </p>
      ) : null}
      {far?.rough && far.note && !placing ? <p style={waitBox}>{far.note}</p> : null}
      {showMe && liveRough && !placing && refusedRoughM == null ? (
        // Until the readings have stayed rough the line is still finding you, in the words it uses everywhere.
        // I found it's own answer about the same area stands in for this one: the steps are drawn once.
        <div data-testid={liveRoughHeld ? 'where-is-box-far-rough' : 'where-is-box-finding'}>
          <PreciseReadingLine accuracyM={liveRoughHeld ? me?.accuracyM : null} roughNote={HOW_FAR_ROUGH_NOTE_WORDS} />
        </div>
      ) : null}
      {noFix ? <p style={muted}>{noFix}</p> : null}
      {newest && !placing ? (
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={muted}>{newestPhotoWords(newest.at, today)}</span>
          <BoxPhotos photos={[newest]} canAct={false} size={72} />
        </div>
      ) : null}
      <Suspense fallback={<p style={muted}>Loading the map…</p>}>
        <OnSiteMapLazy
          center={opening.center}
          startZoom={opening.startZoom}
          pins={mapPins}
          height={placing ? (touch ? 320 : 380) : touch ? 240 : 300}
          focusId={mapFocusId}
          painted={painted}
          me={placing ? null : meSpot}
          lineTo={placing ? null : pin}
          placing={placing ? { label } : null}
          flyTo={placing ? fly : null}
          onCenterChange={placing ? setCenter : undefined}
          emptyWords={placing ? undefined : `The job’s address is not on the map yet, and ${label} has no pin. Press ${WHERE_FOUND_PRESS} when you stand at it.`}
        />
      </Suspense>
      {placing ? (
        <>
          <div style={two}>
            <button type="button" style={btn} onClick={useMyLocation}>Use my location</button>
            <button type="button" style={canPut ? primary : { ...btn, background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }} disabled={!canPut} onClick={putHere}>Put {label} here</button>
          </div>
          {locating ? <p style={muted}>{locating}</p> : null}
          {flyRoughM != null ? (
            <div data-testid="where-is-box-fly-rough">
              {/* A map that has just opened wide was not left where it was, so the sentence does not say so. */}
              <PreciseReadingLine accuracyM={flyRoughM} roughNote={opening.wide ? whereIAmRoughWideNoteWords : whereIAmRoughNoteWords} />
            </div>
          ) : flyAccuracy != null ? (
            <div data-testid="where-is-box-fly-read">
              <PreciseReadingLine accuracyM={flyAccuracy} weakNote={WHERE_I_AM_WEAK_NOTE_WORDS} />
            </div>
          ) : opening.wide && !canPut ? (
            <p role="status" style={muted} data-testid="where-is-box-wide">{WHERE_I_AM_WIDE_WORDS}</p>
          ) : null}
          <button type="button" style={quiet} onClick={() => setPlacing(false)}>Back, leave the pin as it is</button>
          {pinned ? <button type="button" style={{ ...quiet, color: 'var(--text-muted)', fontSize: '0.85rem' }} onClick={removePin}>Remove the pin</button> : null}
        </>
      ) : refused || refusedRoughM != null ? (
        <>
          <button type="button" style={primary} onClick={foundIt} aria-busy={finding}>{finding ? 'Finding you…' : WHERE_TRY_AGAIN_PRESS}</button>
          <button type="button" style={btn} onClick={startPlacing}>{WHERE_MOVE_PIN_PRESS}</button>
        </>
      ) : pinned ? (
        <>
          {showMe ? null : <button type="button" style={found ? btn : primary} onClick={() => setShowMe(true)}>{WHERE_SHOW_ME_PRESS}</button>}
          <div style={directionsPress ? two : undefined}>
            {directionsPress}
            {foundPress(showMe && !found)}
          </div>
          {showMe ? <p style={muted}>{WHERE_PRIVACY_WORDS}</p> : null}
          {sendPress}
          <button type="button" style={quiet} onClick={startPlacing}>{WHERE_MOVE_PIN_PRESS}</button>
        </>
      ) : (
        <>
          <p style={waitBox}>{whereNoPinWords(label)}</p>
          {foundPress(true)}
          {directionsPress}
          {sendPress}
          <button type="button" style={quiet} onClick={startPlacing}>{WHERE_MOVE_PIN_PRESS}</button>
        </>
      )}
    </div>
  )
}
