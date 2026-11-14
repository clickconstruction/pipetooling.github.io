/**
 * A painted map's window (punch list #345): the map, its lines and its places, and the tools that
 * draw a line by hand. It opens over whatever asked for it (the line under a job's address), so it
 * is a portal at its own layer, as the task's place sheet is.
 *
 * A new map is not saved until its first line is. Closing before then leaves nothing behind.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ConfirmDialog from '../ConfirmDialog'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { useAuth } from '../../hooks/useAuth'
import { usePaintedWalk, writeKeptWalk } from '../../hooks/usePaintedWalk'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { directionsUrlForPoint } from '../../lib/directionsUrl'
import { isOfficeRole } from '../../lib/doorRoles'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import { requestMyLocation } from '../../lib/materials/myLocation'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  addCorner,
  canSaveDraftLine,
  canUndoDraftLine,
  draftLengthMeters,
  emptyDraftLine,
  insertCorner,
  legsAtCorner,
  moveCorner,
  pickCorner,
  removeCorner,
  undoDraftLine,
  type DraftLine,
} from '../../lib/paintedMap/draftLine'
import {
  PAINTED_MAP_NAME_MAX,
  PAINTED_MAP_WORDS_MAX,
  aboutLengthWords,
  lineHowWords,
  lineLengthWords,
  mapStart,
  mapSummaryWords,
  numberedPlaces,
  paintedByWords,
  parseMeasuredFeet,
  type PaintedLine,
  type PaintedMap,
  type PaintedMeasuredHow,
  type PaintedPlace,
} from '../../lib/paintedMap/paintedMap'
import { paintedMapsChanged, type PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import {
  addPaintedLine,
  addPaintedPlace,
  createPaintedMap,
  deletePaintedLine,
  deletePaintedMap,
  deletePaintedPlace,
  loadPaintedMap,
  loadPainterNames,
  paintedPlacePhotoUrls,
  removePaintedPlacePhotoFile,
  savePaintedLineMeasure,
  savePaintedLineShape,
  putPaintedMapOnJob,
  savePaintedMapWords,
  savePaintedPlace,
  uploadPaintedPlacePhoto,
  type PaintedMapWhole,
} from '../../lib/paintedMap/paintedMapIo'
import type { PaintedPoint, SnapTarget } from '../../lib/paintedMap/paintedLine'
import { clockWords, strokeMarginMeters } from '../../lib/paintedMap/paintedTrack'
import { walkHasLine, walkPause, walkPaintedMs, walkStrokes, type WalkState, type WalkStroke } from '../../lib/paintedMap/paintedWalk'
import { lineLengthMeters } from '../../lib/paintedMap/paintedLine'
import { haversineMeters } from '../../lib/jobTravelEstimate'
import { taskPlaceAccuracyWords } from '../../lib/tasks/taskPlace'
import { PAINTED_MAP_SHEET_Z, PAINTED_MAP_WINDOW_Z } from '../../lib/windowLayers'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import type { PaintedCanvasDot, PaintedCanvasDraft } from './PaintedMapCanvas'
import { CostBatchJobPicker } from '../costBatches/CostBatchJobPicker'
import { PaintedMapShareSheet } from './PaintedMapShareSheet'
import { PaintedPlacePanel, type PaintedPlacePhotoChoice } from './PaintedPlacePanel'
import { PaintedWalkPanel } from './PaintedWalkPanel'
import { PaintedWalkReview } from './PaintedWalkReview'
import { PAINT_SWATCH } from './paintedMapLook'

const PaintedMapCanvasLazy = lazy(() => import('./PaintedMapCanvas'))

/** A map that is about to be made: named on the start sheet, saved with its first line. */
export type PaintedMapToStart = { id: string; name: string; words: string; home: PaintedMapHome; /** What the painter starts with: a line drawn by hand (the default), a place, or a walk. */ first?: 'line' | 'place' | 'walk' }

/** What is kept on the phone beside a walk, so its window can open again after a reload. */
export type KeptPaintedWalk = { mapId: string; start: PaintedMapToStart | null; address: string | null; pending: WalkStroke[] }

type Props = {
  /** A saved map by its id, or a new one from the start sheet. */
  ask: { mapId: string } | { start: PaintedMapToStart }
  /** A walk found on the phone from before, for this map: it opens paused, with the lines already looked over. */
  kept?: { state: WalkState | null; pending: WalkStroke[] } | null
  /** The job's or the site's address. Looked up only when the map has nothing on it to open on. */
  address?: string | null
  /** Where the map opens when nothing is on it, for a caller that already knows the point. */
  center?: PaintedPoint | null
  onClose: () => void
}

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const bluePress: CSSProperties = { ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 32 }
const field: CSSProperties = { minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

const MEASURED_CHIPS: ReadonlyArray<{ how: PaintedMeasuredHow; label: string }> = [
  { how: 'wheel', label: 'A wheel' },
  { how: 'tape', label: 'A tape' },
  { how: 'other', label: 'Another way' },
]

/** What each confirm asks, and the press that names its act. */
const CONFIRM_WORDS: Record<'line' | 'place' | 'map' | 'leave' | 'stop' | 'walk' | 'leaveWalk' | 'leaveOut', { title: string; body: string; confirm: string; cancel: string }> = {
  line: { title: 'Remove this line?', body: 'The line comes off the map for everyone. This cannot be undone.', confirm: 'Remove the line', cancel: 'Cancel' },
  place: { title: 'Remove this place?', body: 'The place and its photo come off the map for everyone. This cannot be undone.', confirm: 'Remove the place', cancel: 'Cancel' },
  map: { title: 'Throw this map away?', body: 'The map, its lines and its places go for everyone. This cannot be undone.', confirm: 'Throw the map away', cancel: 'Cancel' },
  leave: { title: 'Stop without saving?', body: 'The line you are drawing is not saved yet.', confirm: 'Stop, and lose the line', cancel: 'Keep drawing' },
  stop: { title: 'Stop without saving?', body: 'The line you are drawing is not saved yet.', confirm: 'Stop, and lose the line', cancel: 'Keep drawing' },
  walk: { title: 'Throw the walk away?', body: 'What you painted goes from this phone. Nothing was sent anywhere, so nothing is left behind.', confirm: 'Throw the walk away', cancel: 'Keep it' },
  leaveWalk: { title: 'Close the map?', body: 'The walk is not saved. It stays on this phone for a day, paused, and the app offers it back when you open it.', confirm: 'Close, and keep the walk on this phone', cancel: 'Stay' },
  leaveOut: { title: 'Leave this line out?', body: 'The line goes from this phone. It was not saved, so it cannot be brought back.', confirm: 'Leave the line out', cancel: 'Keep it' },
}

/** A dot dragged further than this from the phone's reading is the painter's own call: about 10 ft. */
const OFF_READING_METERS = 3

/** A place being added or changed: where its dot is now, and the reading it came from, if one was taken. */
type Placing = { place: PaintedPlace | null; point: PaintedPoint; fix: (PaintedPoint & { accuracyM: number | null }) | null }

/** `185 ft back, 180 ft on`: the two legs at the corner a finger has, said the way a length is. */
function cornerWords(points: ReadonlyArray<PaintedPoint>, index: number): string | null {
  const legs = legsAtCorner(points, index)
  const parts: string[] = []
  if (legs.backM != null) parts.push(`${aboutLengthWords(legs.backM).replace('about ', '')} back`)
  if (legs.onM != null) parts.push(`${aboutLengthWords(legs.onM).replace('about ', '')} on`)
  return parts.length > 0 ? parts.join(', ') : null
}

export function PaintedMapWindow({ ask, kept = null, address = null, center: givenCenter = null, onClose }: Props) {
  const { user, role } = useAuth()
  const phone = useIsMobile()
  const isTopmost = useModalStackEntry()
  const starting = 'start' in ask ? ask.start : null
  const askedId = 'mapId' in ask ? ask.mapId : null

  const [whole, setWhole] = useState<PaintedMapWhole | null>(null)
  const [saved, setSaved] = useState(!starting)
  const [loading, setLoading] = useState(!starting)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const [names, setNames] = useState<Map<string, string>>(() => new Map())
  // A new map opens on what the painter chose to start with. A place needs somewhere to put its dot, and waits for one.
  const placeFirst = starting?.first === 'place'
  const walkFirst = starting?.first === 'walk' || !!kept
  const [mode, setMode] = useState<'view' | 'draw' | 'place' | 'walk' | 'review'>(kept && !kept.state ? 'review' : walkFirst ? 'walk' : !starting ? 'view' : !placeFirst ? 'draw' : givenCenter ? 'place' : 'view')
  const walk = usePaintedWalk()
  // The lines a walk made, looked over and not yet saved. They live on the phone until Save.
  const [pending, setPending] = useState<WalkStroke[]>(() => kept?.pending ?? [])
  // The line of those being set right by hand, by its place in the list.
  const [fixing, setFixing] = useState<number | null>(null)
  // Where a place goes back to when it is done: the map, or the walk it was added during.
  const [placeReturn, setPlaceReturn] = useState<'view' | 'walk'>('view')
  // This window has had a walk of its own: only then is what the phone keeps this window's to write or clear.
  const ownsWalk = useRef(walkFirst)
  // Bumped when a walk ends: the map followed the walker, and Look it over frames the whole of it.
  const [refit, setRefit] = useState(0)
  const began = useRef(false)
  const [placing, setPlacing] = useState<Placing | null>(() => (placeFirst && givenCenter ? { place: null, point: givenCenter, fix: null } : null))
  const openedOnPlace = useRef(placeFirst && !!givenCenter)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(() => new Map())
  const [viewing, setViewing] = useState<string | null>(null)
  const [pickedPlace, setPickedPlace] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  // The middle of what the map is showing: where a new dot starts.
  const viewCenter = useRef<PaintedPoint | null>(null)
  const [draft, setDraft] = useState<DraftLine>(() => emptyDraftLine())
  const [reshaping, setReshaping] = useState<PaintedLine | null>(null)
  const [glass, setGlass] = useState<{ point: PaintedPoint; caught: SnapTarget | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const [fly, setFly] = useState<PaintedPoint | null>(null)
  const [finding, setFinding] = useState(false)
  const [measuring, setMeasuring] = useState<{ lineId: string; text: string; how: PaintedMeasuredHow } | null>(null)
  const [renaming, setRenaming] = useState<{ name: string; words: string } | null>(null)
  // A map on no job is found only by its name: its maker or the office can put it on a job.
  const [homing, setHoming] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'line'; line: PaintedLine } | { kind: 'place'; place: PaintedPlace } | { kind: 'map' } | { kind: 'leave' } | { kind: 'stop' } | { kind: 'walk' } | { kind: 'leaveWalk' } | { kind: 'leaveOut'; index: number } | null>(null)

  // Somewhere to open: only a map with nothing on it needs the address looked up. A saved map with a line or a place
  // frames itself, and its window asks the geocoder nothing.
  const needsStart = !givenCenter && (starting ? true : !!whole && whole.lines.length === 0 && whole.places.length === 0)
  const addresses = useMemo(() => {
    const display = (address ?? '').trim()
    return display ? [{ key: normalizeAddressForGeocodeKey(display), display }] : []
  }, [address])
  const { coords } = useAddressGeocodeCoords(addresses, needsStart && addresses.length > 0, 'painted map start')
  const found = addresses[0] ? (coords.get(addresses[0].key) ?? null) : null
  const center = givenCenter ?? found

  // The address was found after the window opened: the map goes there, and a map that starts with a place gets its dot.
  useEffect(() => {
    if (!found || givenCenter) return
    setFly((f) => f ?? { lat: found.lat, lng: found.lng })
    if (placeFirst && !openedOnPlace.current) {
      openedOnPlace.current = true
      setPlacing((pl) => pl ?? { place: null, point: { lat: found.lat, lng: found.lng }, fix: null })
      setMode((m) => (m === 'view' ? 'place' : m))
    }
  }, [found, givenCenter, placeFirst])

  const map: PaintedMap | null = whole?.map ?? (starting ? { id: starting.id, name: starting.name, words: starting.words, jobId: starting.home.jobId ?? null, developmentId: starting.home.jobId ? null : (starting.home.developmentId ?? null), createdBy: user?.id ?? null, createdAt: new Date().toISOString() } : null)
  const lines = useMemo(() => whole?.lines ?? [], [whole])
  const places = useMemo(() => numberedPlaces(whole?.places ?? []), [whole])

  const load = useCallback(async (mapId: string) => {
    setLoading(true)
    setLoadError(null)
    const res = await loadPaintedMap(mapId)
    setLoading(false)
    if (!res.ok) {
      setLoadError(res.error)
      return
    }
    if (!res.value) {
      setGone(true)
      return
    }
    setWhole(res.value)
    const [people, photos] = await Promise.all([
      loadPainterNames([res.value.map.createdBy, ...res.value.lines.map((l) => l.madeBy), ...res.value.places.map((p) => p.setBy)]),
      paintedPlacePhotoUrls(res.value.places.map((p) => p.photoPath)),
    ])
    setNames(people)
    setPhotoUrls(photos)
  }, [])

  useEffect(() => {
    if (askedId) void load(askedId)
  }, [askedId, load])

  const dirty = mode === 'draw' && canUndoDraftLine(draft)
  const walkOpen = !!walk.state || pending.length > 0
  const leave = useCallback(() => {
    if (walkOpen) setConfirm({ kind: 'leaveWalk' })
    else if (dirty) setConfirm({ kind: 'leave' })
    else onClose()
  }, [walkOpen, dirty, onClose])

  // A map that starts with a walk begins reading once, when the window opens. A kept walk comes back paused.
  useEffect(() => {
    if (began.current) return
    began.current = true
    if (kept?.state) walk.restore(kept.state)
    else if (!kept && starting?.first === 'walk') walk.start()
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        leave()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, leave])

  const mine = (by: string | null) => !!user?.id && (by === user.id || isOfficeRole(role))
  const canChangeMap = !!map && mine(map.createdBy)

  // What a dragged corner catches: every place, and the two ends of every other line.
  const targets = useMemo<SnapTarget[]>(() => {
    const out: SnapTarget[] = places.map((p) => ({ id: `place:${p.id}`, label: p.name, lat: p.lat, lng: p.lng }))
    for (const [i, l] of lines.entries()) {
      if (reshaping && l.id === reshaping.id) continue
      const name = l.label || `line ${i + 1}`
      const first = l.points[0]
      const last = l.points[l.points.length - 1]
      if (first) out.push({ id: `start:${l.id}`, label: `the start of ${name}`, ...first })
      if (last) out.push({ id: `end:${l.id}`, label: `the end of ${name}`, ...last })
    }
    return out
  }, [places, lines, reshaping])

  const canvasDraft = useMemo<PaintedCanvasDraft | null>(
    () =>
      mode === 'draw'
        ? {
            points: draft.points,
            picked: draft.picked,
            targets,
            onAdd: (p) => setDraft((d) => addCorner(d, p)),
            onMove: (i, p) => setDraft((d) => moveCorner(d, i, p)),
            onInsert: (after, p) => setDraft((d) => insertCorner(d, after, p)),
            onPick: (i) => setDraft((d) => pickCorner(d, i)),
          }
        : null,
    [mode, draft.points, draft.picked, targets],
  )

  // The walk is kept on the phone as it goes, so a reload or the camera does not lose it. It is cleared when the
  // lines are saved or thrown away. Readings carry their time here, and here only: what is saved has none.
  const liveStrokes = useMemo(() => (walk.state ? walkStrokes(walk.state) : []), [walk.state])
  const keptKey = `${walk.state?.status ?? 'none'}:${walk.state?.pausedWhy ?? ''}:${walk.state?.strokes.length ?? 0}:${walk.state?.current.length ?? 0}`
  useEffect(() => {
    if (!user?.id || !map || !ownsWalk.current) return
    if (!walk.state && pending.length === 0) {
      writeKeptWalk(user.id, null)
      return
    }
    const keptMap: KeptPaintedWalk = { mapId: map.id, start: saved ? null : { id: map.id, name: map.name, words: map.words, home: starting?.home ?? { jobId: map.jobId, developmentId: map.developmentId }, first: 'walk' }, address, pending }
    writeKeptWalk(user.id, { savedAtMs: Date.now(), map: keptMap, state: walk.state })
    // keptKey stands for the walk's state: a reading that was not a step changes nothing worth keeping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keptKey, pending, saved, user?.id])

  const startWalking = () => {
    setError(null)
    ownsWalk.current = true
    walk.start()
    setMode('walk')
  }
  /** The walk is over: its lines join the ones already looked over, and the phone stops being read. */
  const walkDone = () => {
    if (walk.state) setPending((p) => [...p, ...walkStrokes(walk.state!)])
    walk.clear()
    setMode('review')
    setRefit((n) => n + 1)
  }
  const fixPending = (index: number) => {
    const stroke = pending[index]
    if (!stroke) return
    setError(null)
    setReshaping(null)
    setFixing(index)
    setDraft(emptyDraftLine(stroke.points))
    setMode('draw')
  }
  const saveWalk = async () => {
    if (!map || !user?.id || pending.length === 0 || busy) return
    setBusy(true)
    setError(null)
    const current = await ensureSaved()
    if (!current) {
      setBusy(false)
      return
    }
    const landed: PaintedLine[] = []
    let failed: string | null = null
    for (const stroke of pending) {
      const res = await addPaintedLine(map.id, stroke, user.id)
      if (!res.ok) {
        failed = res.error
        break
      }
      landed.push(res.value)
    }
    setBusy(false)
    setWhole({ ...current, lines: [...current.lines, ...landed] })
    setPending((p) => p.slice(landed.length))
    if (landed.length > 0) paintedMapsChanged()
    if (failed) {
      setError(`${failed} The line is kept on this phone. Press Save again when you have signal.`)
      return
    }
    if (!names.has(user.id)) setNames(await loadPainterNames([user.id, ...names.keys()]))
    setMode('view')
  }

  const startDrawing = () => {
    setError(null)
    setReshaping(null)
    setDraft(emptyDraftLine())
    setMode('draw')
  }
  const startReshaping = (line: PaintedLine) => {
    setError(null)
    setReshaping(line)
    setDraft(emptyDraftLine(line.points))
    setMode('draw')
  }
  const stopDrawing = () => {
    // A line of a walk being set right goes back to the walk's own look-over.
    setMode(fixing != null ? 'review' : 'view')
    setFixing(null)
    setReshaping(null)
    setDraft(emptyDraftLine())
    setGlass(null)
  }

  /** A new map is made by its first save, whichever it is: a line or a place. The map as saved, or null with the reason shown. */
  const ensureSaved = async (): Promise<PaintedMapWhole | null> => {
    if (!map || !user?.id) return null
    if (saved && whole) return whole
    const made = await createPaintedMap({ id: map.id, name: map.name, words: map.words, jobId: map.jobId, developmentId: map.developmentId, by: user.id })
    if (!made.ok) {
      setError(made.error)
      return null
    }
    const current: PaintedMapWhole = { map: made.value, lines: [], places: [] }
    setSaved(true)
    setWhole(current)
    return current
  }

  const saveLine = async () => {
    if (!map || !user?.id || !canSaveDraftLine(draft) || busy) return
    if (fixing != null) {
      // Nothing is sent: the line is still on the phone. Set right by hand, it has no faint part left.
      const was = pending[fixing]
      if (was) {
        const lengthM = lineLengthMeters(draft.points)
        const fixed: WalkStroke = { ...was, points: draft.points, poorParts: [], fixedByHand: true, lengthM, marginM: strokeMarginMeters({ how: was.how, lengthM }) }
        setPending((p) => p.map((s, i) => (i === fixing ? fixed : s)))
      }
      stopDrawing()
      return
    }
    setBusy(true)
    setError(null)
    const current = await ensureSaved()
    if (!current) {
      setBusy(false)
      return
    }
    const how = reshaping?.how ?? 'drawn'
    const lineDraft = { how, points: draft.points, label: reshaping?.label ?? '', fixedByHand: reshaping ? reshaping.how !== 'drawn' : false, marginM: strokeMarginMeters({ how: 'drawn', lengthM: draftLengthMeters(draft) }) }
    const res = reshaping ? await savePaintedLineShape(reshaping, lineDraft, user.id) : await addPaintedLine(map.id, lineDraft, user.id)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      paintedMapsChanged()
      return
    }
    setWhole({ ...current, lines: reshaping ? current.lines.map((l) => (l.id === res.value.id ? res.value : l)) : [...current.lines, res.value] })
    if (user.id && !names.has(user.id)) setNames(await loadPainterNames([user.id, ...names.keys()]))
    paintedMapsChanged()
    stopDrawing()
  }

  /** A place added during a walk: the dot starts where the phone last was, with how sure it was. The walk keeps painting. */
  const placeOnWalk = () => {
    const last = walk.state?.last
    const at = last ? { lat: last.lat, lng: last.lng } : viewCenter.current
    if (!at) return
    setError(null)
    setPlaceReturn('walk')
    setPlacing({ place: null, point: at, fix: last ? { lat: last.lat, lng: last.lng, accuracyM: last.accuracyM } : null })
    setMode('place')
  }
  const startPlace = () => {
    const at = viewCenter.current ?? center ?? mapStart(lines, whole?.places ?? [])
    if (!at) {
      setError('Zoom the map in to the site first, then press ＋ Place.')
      return
    }
    setError(null)
    setPlacing({ place: null, point: at, fix: null })
    setMode('place')
  }
  const changePlace = (place: PaintedPlace) => {
    setError(null)
    setPlacing({ place, point: { lat: place.lat, lng: place.lng }, fix: place.accuracyM != null ? { lat: place.lat, lng: place.lng, accuracyM: place.accuracyM } : null })
    setMode('place')
  }
  const stopPlacing = () => {
    setMode(placeReturn)
    setPlaceReturn('view')
    setPlacing(null)
    setGlass(null)
  }
  const putDotWhereIAm = () => {
    setFinding(true)
    setError(null)
    requestMyLocation(
      (p) => {
        setFinding(false)
        setPlacing((pl) => (pl ? { ...pl, point: { lat: p.lat, lng: p.lng }, fix: p } : pl))
        setFly({ lat: p.lat, lng: p.lng })
      },
      (words) => {
        setFinding(false)
        setError(words)
      },
    )
  }
  // The margin belongs to the reading. Once the dot is dragged off it, the place is the painter's own call.
  const placingOnReading = !!placing?.fix && haversineMeters(placing.fix, placing.point) <= OFF_READING_METERS
  const placingAccuracy = placing?.fix && placingOnReading ? placing.fix.accuracyM : null

  const savePlace = async (input: { name: string; words: string; photo: PaintedPlacePhotoChoice }) => {
    if (!map || !user?.id || !placing || busy) return
    setBusy(true)
    setError(null)
    const current = await ensureSaved()
    if (!current) {
      setBusy(false)
      return
    }
    const old = placing.place
    let photoPath: string | null = input.photo.kind === 'keep' ? (old?.photoPath ?? null) : null
    if (input.photo.kind === 'new') {
      const up = await uploadPaintedPlacePhoto(map.id, input.photo.id, input.photo.blob)
      if (!up.ok) {
        setBusy(false)
        setError(up.error)
        return
      }
      photoPath = up.value
    }
    const res = old
      ? await savePaintedPlace(old.id, { name: input.name, words: input.words, lat: placing.point.lat, lng: placing.point.lng, accuracyM: placingAccuracy, photoPath })
      : await addPaintedPlace(map.id, { ...placing.point, name: input.name, words: input.words, accuracyM: placingAccuracy, photoPath }, user.id)
    setBusy(false)
    if (!res.ok) {
      // The picture went up for a place that did not save: it is taken back out.
      if (input.photo.kind === 'new') void removePaintedPlacePhotoFile(photoPath)
      setError(res.error)
      return
    }
    if (old?.photoPath && old.photoPath !== res.value.photoPath) void removePaintedPlacePhotoFile(old.photoPath)
    const places = old ? current.places.map((p) => (p.id === res.value.id ? res.value : p)) : [...current.places, res.value]
    setWhole({ ...current, places })
    setPhotoUrls(await paintedPlacePhotoUrls(places.map((p) => p.photoPath)))
    if (!names.has(user.id)) setNames(await loadPainterNames([user.id, ...names.keys()]))
    paintedMapsChanged()
    stopPlacing()
  }

  const saveMeasure = async () => {
    if (!measuring || busy) return
    const feet = parseMeasuredFeet(measuring.text)
    if (feet == null) {
      setError('Type the length in feet, such as 612 or 612.5.')
      return
    }
    setBusy(true)
    setError(null)
    const res = await savePaintedLineMeasure(measuring.lineId, { feet, how: measuring.how })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setWhole((w) => (w ? { ...w, lines: w.lines.map((l) => (l.id === res.value.id ? res.value : l)) } : w))
    setMeasuring(null)
    paintedMapsChanged()
  }
  const clearMeasure = async (lineId: string) => {
    setBusy(true)
    setError(null)
    const res = await savePaintedLineMeasure(lineId, null)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setWhole((w) => (w ? { ...w, lines: w.lines.map((l) => (l.id === res.value.id ? res.value : l)) } : w))
    paintedMapsChanged()
  }

  const saveName = async () => {
    if (!map || !renaming || busy) return
    setBusy(true)
    setError(null)
    const res = await savePaintedMapWords(map.id, renaming)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setWhole((w) => (w ? { ...w, map: res.value } : w))
    setRenaming(null)
    paintedMapsChanged()
  }

  const putOnJob = async (jobId: string) => {
    if (!map || busy) return
    setBusy(true)
    setError(null)
    const res = await putPaintedMapOnJob(map.id, jobId)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setWhole((w) => (w ? { ...w, map: res.value } : w))
    setHoming(false)
    paintedMapsChanged()
  }

  const confirmed = async () => {
    const what = confirm
    setConfirm(null)
    if (!what) return
    if (what.kind === 'leave') {
      onClose()
      return
    }
    if (what.kind === 'stop') {
      stopDrawing()
      return
    }
    if (what.kind === 'leaveOut') {
      setPending((p) => p.filter((_, i) => i !== what.index))
      return
    }
    if (what.kind === 'walk') {
      // Thrown away: the readings and the lines go from the phone, and nothing was ever sent.
      walk.clear()
      setPending([])
      setMode('view')
      return
    }
    if (what.kind === 'leaveWalk') {
      // The phone stops being read now. The walk stays on this phone, paused, for a day.
      if (user?.id && map && walk.state) {
        const keptMap: KeptPaintedWalk = { mapId: map.id, start: saved ? null : { id: map.id, name: map.name, words: map.words, home: starting?.home ?? { jobId: map.jobId, developmentId: map.developmentId }, first: 'walk' }, address, pending }
        writeKeptWalk(user.id, { savedAtMs: Date.now(), map: keptMap, state: walkPause(walk.state, Date.now()) })
      }
      walk.pause()
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    if (what.kind === 'place') {
      const res = await deletePaintedPlace(what.place.id)
      setBusy(false)
      if (!res.ok || !res.value) {
        setError(res.ok ? 'The place was not removed. Only whoever set a place, or the office, may remove it.' : res.error)
        return
      }
      void removePaintedPlacePhotoFile(what.place.photoPath)
      setWhole((w) => (w ? { ...w, places: w.places.filter((p) => p.id !== what.place.id) } : w))
      paintedMapsChanged()
      stopPlacing()
      return
    }
    if (what.kind === 'line') {
      const res = await deletePaintedLine(what.line.id)
      setBusy(false)
      if (!res.ok || !res.value) {
        setError(res.ok ? 'The line was not removed. Only whoever made a line, or the office, may remove it.' : res.error)
        return
      }
      setWhole((w) => (w ? { ...w, lines: w.lines.filter((l) => l.id !== what.line.id) } : w))
      paintedMapsChanged()
      return
    }
    if (!map) return
    const res = await deletePaintedMap(map.id)
    setBusy(false)
    if (!res.ok || !res.value) {
      setError(res.ok ? 'The map was not removed. Only whoever painted a map, or the office, may remove it.' : res.error)
      return
    }
    paintedMapsChanged()
    onClose()
  }

  const startWhereIAm = () => {
    setFinding(true)
    setError(null)
    requestMyLocation(
      (p) => {
        setFinding(false)
        setFly({ lat: p.lat, lng: p.lng })
      },
      (words) => {
        setFinding(false)
        setError(words)
      },
    )
  }

  const canWalk = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const start = map ? mapStart(lines, whole?.places ?? []) : null
  const directions = start ? directionsUrlForPoint(start.lat, start.lng) : null
  const summary = mapSummaryWords(lines, places.length)
  const paintedBy = map && saved ? paintedByWords(map.createdBy ? (names.get(map.createdBy) ?? null) : null, formatDenverCalendarDayShort(Date.parse(map.createdAt))) : null
  const pickedWords = mode === 'draw' && glass ? null : mode === 'draw' && draft.picked != null ? cornerWords(draft.points, draft.picked) : null
  const emptyAndNowhere = mode === 'draw' && draft.points.length === 0 && lines.length === 0 && places.length === 0 && !center && !fly
  const title = map?.name ?? 'Painted map'

  const canvasDot = useMemo<PaintedCanvasDot | null>(
    () => (mode === 'place' && placing ? { point: placing.point, label: placing.place?.name ?? 'the place', onMove: (p) => setPlacing((pl) => (pl ? { ...pl, point: p } : pl)) } : null),
    [mode, placing],
  )
  // The place whose dot is being moved is the blue dot now, not also its numbered one.
  const canvasPlaces = useMemo(() => places.filter((p) => !(mode === 'place' && placing?.place && p.id === placing.place.id)), [places, mode, placing])
  const onView = useCallback((c: PaintedPoint) => {
    viewCenter.current = c
  }, [])

  const canvasLines = useMemo(
    () => [
      ...lines.filter((l) => !(reshaping && l.id === reshaping.id)).map((l) => ({ id: l.id, points: l.points, poorParts: l.poorParts, how: l.how })),
      // The lines of a walk, looked over and waiting, and the one being painted now.
      ...pending.map((s, i) => ({ id: `pending-${i}`, points: s.points.slice(), poorParts: s.poorParts ?? [], how: s.how })).filter((_, i) => i !== fixing),
      ...liveStrokes.map((s, i) => ({ id: `walk-${i}`, points: s.points.slice(), poorParts: s.poorParts ?? [], how: s.how })),
    ],
    [lines, reshaping, pending, fixing, liveStrokes],
  )
  const painting = walk.state?.status === 'painting'
  const walkMe = mode === 'walk' && walk.state?.last ? { lat: walk.state.last.lat, lng: walk.state.last.lng, accuracyM: walk.state.last.accuracyM } : null
  const walkLengthM = pending.reduce((sum, s) => sum + s.lengthM, 0) + liveStrokes.reduce((sum, s) => sum + s.lengthM, 0)

  return createPortal(
    <>
    <div
      data-painted-map-window
      style={{ position: 'fixed', inset: 0, zIndex: PAINTED_MAP_WINDOW_Z, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: phone ? 'env(safe-area-inset-top, 0px) 0 0' : '3vh 2vw' }}
      onClick={(e) => {
        // The window that opened this one sits behind: this press closes the map alone.
        e.stopPropagation()
        leave()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 1080, display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: phone ? '14px 14px 0 0' : 14, overflow: 'hidden' }}
      >
        {mode === 'walk' && walk.state ? (
          // The bar is red for every second the phone is being read, and at no other time.
          <div data-painted-bar={painting ? 'painting' : 'paused'} role="status" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: painting ? '#b91c1c' : '#4b5563', color: '#fff', fontWeight: 700 }}>
            <span aria-hidden style={{ width: 11, height: 11, borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 0 4px rgba(255,255,255,.3)', flex: 'none' }} />
            <span>{painting ? 'Painting' : 'Paused'} · {clockWords(walkPaintedMs(walk.state, walk.nowMs))}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: '0.8125rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{painting ? title : 'The phone is not being read'}</span>
            <button type="button" onClick={leave} aria-label="Close the painted map" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem', fontFamily: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Close
            </button>
          </div>
        ) : (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mode === 'draw' ? (fixing != null ? 'Fix the line by hand' : reshaping ? 'Move the corners' : 'Draw it by hand') : mode === 'place' ? (placing?.place ? 'Change this place' : 'A place on the map') : mode === 'review' ? 'Look it over' : title}</h2>
          <button type="button" onClick={leave} aria-label="Close the painted map" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
            Close
          </button>
        </div>
        )}

        {loading ? (
          <p style={{ margin: '1rem', color: 'var(--text-muted)' }}>Loading the map…</p>
        ) : loadError ? (
          <div style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
            <p role="alert" style={note}>{loadError}</p>
            {askedId ? <button type="button" style={press} onClick={() => void load(askedId)}>Try again</button> : null}
          </div>
        ) : gone || !map ? (
          <p style={{ margin: '1rem', color: 'var(--text-700)' }}>This painted map is gone, or it is not yours to open.</p>
        ) : (
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: phone ? 'column' : 'row' }}>
            <div style={{ flex: phone ? '1 1 46%' : '1 1 60%', minHeight: phone ? 260 : 420, minWidth: 0, position: 'relative' }}>
              <Suspense fallback={<p style={{ margin: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the map…</p>}>
                <PaintedMapCanvasLazy lines={canvasLines} places={canvasPlaces} height="100%" start={center ?? null} draft={canvasDraft} dot={canvasDot} flyTo={fly} me={walkMe} follow={mode === 'walk' && painting} refit={refit} onTilesFailed={() => setMapFailed(true)} onGlass={setGlass} onView={onView} onPlaceTap={setPickedPlace} />
              </Suspense>
              {mode === 'place' ? (
                <div style={{ position: 'absolute', left: 8, right: 8, bottom: 26, zIndex: 600, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ background: 'rgba(17, 24, 39, 0.84)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.7rem', borderRadius: 999, textAlign: 'center' }}>{glass ? 'Lift your finger to set it.' : 'Drag the blue dot onto the spot.'}</span>
                </div>
              ) : null}
              {mode === 'draw' ? (
                <div style={{ position: 'absolute', left: 8, right: 8, bottom: 26, zIndex: 600, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ background: 'rgba(17, 24, 39, 0.84)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.7rem', borderRadius: 999, textAlign: 'center' }}>
                    {glass ? 'Lift your finger to set it.' : draft.points.length === 0 ? 'Press the map where the line starts.' : 'Press the next corner. Drag a corner to move it.'}
                  </span>
                </div>
              ) : null}
            </div>

            <div style={{ flex: phone ? '0 1 auto' : '0 0 360px', maxHeight: phone ? '54%' : undefined, overflowY: 'auto', borderTop: phone ? '1px solid var(--border)' : undefined, borderLeft: phone ? undefined : '1px solid var(--border)', padding: '0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px))', display: 'grid', gap: '0.65rem', alignContent: 'start' }}>
              {mapFailed ? <p role="status" style={note}>The picture did not load. There may be no signal here. The line still draws.</p> : null}
              {error ? <p role="alert" data-painted-error style={note}>{error}</p> : null}

              {mode === 'walk' && walk.state ? (
                <PaintedWalkPanel
                  state={walk.state}
                  refusal={walk.refusal}
                  awake={walk.awake}
                  lengthM={walkLengthM}
                  placeCount={places.length}
                  hasLine={pending.length > 0 || walkHasLine(walk.state)}
                  onPlace={placeOnWalk}
                  onPause={walk.pause}
                  onResume={walk.resume}
                  onTryAgain={() => (walk.state && walk.state.status === 'paused' ? walk.resume(false) : walk.start())}
                  onDone={walkDone}
                  onDrawInstead={() => {
                    // What was painted so far is kept to look over. The rest is drawn by hand.
                    if (walk.state && walkHasLine(walk.state)) setPending((p) => [...p, ...walkStrokes(walk.state!)])
                    walk.clear()
                    startDrawing()
                  }}
                />
              ) : mode === 'review' ? (
                <PaintedWalkReview strokes={pending} busy={busy} mapSaved={saved} onFix={fixPending} onRemove={(index) => setConfirm({ kind: 'leaveOut', index })} onSave={() => void saveWalk()} onKeepPainting={startWalking} onThrowAway={() => setConfirm({ kind: 'walk' })} />
              ) : mode === 'place' && placing ? (
                <PaintedPlacePanel
                  key={placing.place?.id ?? 'new'}
                  place={placing.place}
                  photoUrl={placing.place?.photoPath ? (photoUrls.get(placing.place.photoPath) ?? null) : null}
                  accuracyM={placingAccuracy}
                  movedOffReading={!!placing.fix && !placingOnReading}
                  finding={finding}
                  busy={busy}
                  canRemove={!!placing.place && mine(placing.place.setBy)}
                  onUseWhereIAm={putDotWhereIAm}
                  onSave={(input) => void savePlace(input)}
                  onRemove={() => placing.place && setConfirm({ kind: 'place', place: placing.place })}
                  onCancel={stopPlacing}
                />
              ) : mode === 'draw' ? (
                <>
                  <div data-painted-readout style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.15rem 0.75rem' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>{draft.points.length >= 2 ? aboutLengthWords(draftLengthMeters(draft)) : 'A new line'}</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      {draft.points.length} corner{draft.points.length === 1 ? '' : 's'} · drawn by hand
                    </span>
                    {pickedWords ? <span style={{ flexBasis: '100%', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>this corner: {pickedWords}</span> : null}
                  </div>
                  {emptyAndNowhere ? (
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>The map opened wide, since this map has no address to open on. Zoom in to the site, or start it where you stand.</p>
                      <button type="button" style={finding ? deadPress : press} disabled={finding} onClick={startWhereIAm}>
                        {finding ? 'Finding you…' : 'Start the map where I am'}
                      </button>
                    </div>
                  ) : null}
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {phone
                      ? 'Press and hold, then slide: a magnifying glass shows the spot under your finger. It shows when you drag a corner too.'
                      : 'Drag a corner to move it. Drag the small dot on a leg to make a corner there.'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" style={canUndoDraftLine(draft) ? press : deadPress} disabled={!canUndoDraftLine(draft)} onClick={() => setDraft((d) => undoDraftLine(d))}>
                      Undo
                    </button>
                    {draft.picked != null ? (
                      <button type="button" style={press} onClick={() => setDraft((d) => (d.picked != null ? removeCorner(d, d.picked) : d))}>
                        Remove this corner
                      </button>
                    ) : null}
                    <button type="button" style={press} onClick={() => (dirty ? setConfirm({ kind: 'stop' }) : stopDrawing())}>
                      Cancel
                    </button>
                  </div>
                  <button type="button" data-painted-save style={canSaveDraftLine(draft) && !busy ? { ...bluePress, minHeight: 52 } : { ...deadPress, minHeight: 52 }} disabled={!canSaveDraftLine(draft) || busy} onClick={() => void saveLine()}>
                    {busy ? 'Saving…' : fixing != null ? 'Use this line' : reshaping ? 'Save the line' : saved ? 'Save the line' : 'Save the map'}
                  </button>
                  {fixing != null ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Drag a corner onto the right spot, or press one and remove it. The line is still on this phone alone.</p>
                  ) : !saved ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>The map is saved when you press Save the map, and not before.</p>
                  ) : null}
                </>
              ) : (
                <>
                  {renaming ? (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                        What is it?
                        <input type="text" value={renaming.name} maxLength={PAINTED_MAP_NAME_MAX} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} style={field} />
                      </label>
                      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                        A line for whoever opens it
                        <input type="text" value={renaming.words} maxLength={PAINTED_MAP_WORDS_MAX} onChange={(e) => setRenaming({ ...renaming, words: e.target.value })} placeholder="Start at the truck gate, not the sales entrance." style={field} />
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" style={busy ? deadPress : bluePress} disabled={busy} onClick={() => void saveName()}>Save the name</button>
                        <button type="button" style={press} onClick={() => setRenaming(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.2rem' }}>
                      {map.words ? <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-base)' }}>{map.words}</p> : null}
                      {summary ? <p data-painted-summary style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>{summary.charAt(0).toUpperCase() + summary.slice(1)}</p> : null}
                      {paintedBy ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{paintedBy}</p> : null}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" data-painted-draw style={bluePress} onClick={startDrawing}>Draw a line</button>
                    {canWalk ? <button type="button" data-painted-walk-start style={press} onClick={startWalking}>Walk or drive a line</button> : null}
                    <button type="button" data-painted-place style={press} onClick={startPlace}>＋ Place</button>
                    {directions ? (
                      <button type="button" style={press} onClick={() => openInExternalBrowser(directions)}>Directions to the start</button>
                    ) : null}
                    {/* A link is its maker's and the office's to hand out, and a map with nothing on it has nothing to show. */}
                    {saved && canChangeMap && (lines.length > 0 || places.length > 0) ? (
                      <button type="button" data-painted-share style={press} onClick={() => setSharing(true)}>Share</button>
                    ) : null}
                  </div>

                  {lines.length === 0 && places.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      Nothing is painted on this map yet. Press Draw a line or ＋ Place to start it.{saved ? '' : ' The map is saved with its first line or place.'}
                    </p>
                  ) : lines.length === 0 ? null : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <h3 style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Lines</h3>
                      {lines.map((line, i) => {
                        const words = lineLengthWords(line)
                        const by = line.madeBy ? names.get(line.madeBy) : null
                        const open = measuring?.lineId === line.id
                        return (
                          <div key={line.id} data-painted-line style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.55rem 0.7rem', display: 'grid', gap: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span aria-hidden style={PAINT_SWATCH} />
                              <b style={{ fontSize: '0.9375rem' }}>{line.label || `Line ${i + 1}`}</b>
                            </div>
                            <div style={{ fontSize: '0.9375rem' }}>
                              <b>{words.lead}</b>
                              {words.tail ? <span style={{ color: 'var(--text-700)' }}>, {words.tail}</span> : null}
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {lineHowWords(line)}
                              {by ? ` by ${by}` : ''} · {formatDenverCalendarDayShort(Date.parse(line.madeAt))}
                            </div>
                            {open && measuring ? (
                              <div style={{ display: 'grid', gap: '0.4rem' }}>
                                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                                  The measured length, in feet
                                  <input type="text" inputMode="decimal" value={measuring.text} onChange={(e) => setMeasuring({ ...measuring, text: e.target.value })} placeholder="612" style={field} />
                                </label>
                                <div role="group" aria-label="Measured with" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  {MEASURED_CHIPS.map((c) => (
                                    <button key={c.how} type="button" aria-pressed={measuring.how === c.how} style={{ ...press, minHeight: 36, fontSize: '0.8125rem', borderRadius: 999, ...(measuring.how === c.how ? { background: '#2563eb', borderColor: '#2563eb', color: '#fff' } : {}) }} onClick={() => setMeasuring({ ...measuring, how: c.how })}>
                                      {c.label}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button type="button" style={busy ? deadPress : bluePress} disabled={busy} onClick={() => void saveMeasure()}>Save the length</button>
                                  <button type="button" style={press} onClick={() => setMeasuring(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : mine(line.madeBy) ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.9rem' }}>
                                {words.measured ? (
                                  <button type="button" style={quiet} onClick={() => void clearMeasure(line.id)}>Take the measured length off</button>
                                ) : (
                                  <button type="button" style={quiet} onClick={() => setMeasuring({ lineId: line.id, text: '', how: 'wheel' })}>Type a length measured with a wheel or a tape</button>
                                )}
                                {line.how === 'drawn' ? <button type="button" style={quiet} onClick={() => startReshaping(line)}>Move its corners</button> : null}
                                <button type="button" style={quiet} onClick={() => setConfirm({ kind: 'line', line })}>Remove this line</button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {places.length > 0 ? (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <h3 style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Places</h3>
                      {places.map((p) => {
                        const url = p.photoPath ? photoUrls.get(p.photoPath) : null
                        const by = p.setBy ? names.get(p.setBy) : null
                        const sure = taskPlaceAccuracyWords(p.accuracyM)
                        return (
                          <div key={p.id} data-painted-place-row data-picked={pickedPlace === p.id ? 'true' : undefined} style={{ borderWidth: pickedPlace === p.id ? 2 : 1, borderStyle: 'solid', borderColor: pickedPlace === p.id ? '#2563eb' : 'var(--border)', borderRadius: 10, padding: '0.55rem 0.7rem', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.15rem 0.6rem', alignItems: 'start' }}>
                            <span aria-hidden style={{ gridRow: '1 / 4', width: 24, height: 24, borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--text-strong)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 800 }}>{p.number}</span>
                            <b style={{ fontSize: '0.9375rem' }}>{p.name}</b>
                            {url ? (
                              <button type="button" aria-label={`Open the photo of ${p.name}`} onClick={() => setViewing(url)} style={{ gridRow: '1 / 4', gridColumn: 3, padding: 0, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-muted)', cursor: 'pointer', width: 72, height: 54 }}>
                                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              </button>
                            ) : null}
                            {p.words ? <span style={{ gridColumn: 2, fontSize: '0.875rem', color: 'var(--text-base)' }}>{p.words}</span> : null}
                            <span style={{ gridColumn: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {sure ? `the phone was sure ${sure}` : 'placed by hand'}
                              {by ? ` · ${by}` : ''}
                              {mine(p.setBy) ? (
                                <>
                                  {' · '}
                                  <button type="button" style={{ ...quiet, fontSize: '0.8125rem', minHeight: 0 }} onClick={() => changePlace(p)}>Change this place</button>
                                </>
                              ) : null}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}

                  {canChangeMap && saved && !map.jobId && !map.developmentId ? (
                    <div data-painted-no-home style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
                      <span>This map is on no job. Only you and the office can open it.</span>
                      {homing ? (
                        <>
                          <CostBatchJobPicker title="Which job is it for?" autoFocus onPick={(job) => void putOnJob(job.id)} />
                          <button type="button" style={quiet} onClick={() => setHoming(false)}>Leave it on no job</button>
                        </>
                      ) : (
                        <button type="button" data-painted-put-on-job style={{ ...quiet, justifySelf: 'start' }} disabled={busy} onClick={() => setHoming(true)}>Put it on a job…</button>
                      )}
                    </div>
                  ) : null}

                  {canChangeMap && saved && !renaming ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.9rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>
                      <button type="button" style={quiet} onClick={() => setRenaming({ name: map.name, words: map.words })}>Rename this map</button>
                      <button type="button" style={quiet} onClick={() => setConfirm({ kind: 'map' })}>Throw this map away</button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    {/* Beside the window, not inside it: a press on the confirm must not reach the window's own backdrop. */}
    {confirm ? (
      <ConfirmDialog
        zIndex={PAINTED_MAP_SHEET_Z + 60}
        title={CONFIRM_WORDS[confirm.kind].title}
        body={CONFIRM_WORDS[confirm.kind].body}
        confirmLabel={CONFIRM_WORDS[confirm.kind].confirm}
        cancelLabel={CONFIRM_WORDS[confirm.kind].cancel}
        onConfirm={() => void confirmed()}
        onCancel={() => setConfirm(null)}
      />
    ) : null}
    {sharing && map ? <PaintedMapShareSheet mapId={map.id} mapName={map.name} whole={{ map: { id: map.id, name: map.name, words: map.words, jobId: map.jobId }, lines, places }} onClose={() => setSharing(false)} /> : null}
    {viewing ? (
      <div role="dialog" aria-modal="true" aria-label="The photo of the place" data-painted-photo-view style={{ position: 'fixed', inset: 0, zIndex: PAINTED_MAP_SHEET_Z, background: 'rgba(0,0,0,0.88)', display: 'grid', placeItems: 'center', padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }} onClick={() => setViewing(null)}>
        <img src={viewing} alt="The place" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        <button type="button" onClick={() => setViewing(null)} style={{ position: 'absolute', right: 12, top: 'calc(12px + env(safe-area-inset-top, 0px))', minHeight: 40, padding: '0 0.9rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.5)', background: 'rgba(17,24,39,0.7)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
          Close
        </button>
      </div>
    ) : null}
    </>,
    document.fullscreenElement ?? document.body,
  )
}
