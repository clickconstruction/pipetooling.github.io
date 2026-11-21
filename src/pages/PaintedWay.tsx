/**
 * A painted map, shared (punch list #345, PR 4, v2.7223): what `/way/<code>` opens, with no sign-in. The link carries
 * one painted map: its name, its lines, and its places with their words and photos. The ten-letter code is the key, as
 * an estimate's link is, and the page shows nothing else from the app: not who painted the map, not when, not the job.
 *
 * **Who is looking** (v2.7414, Taunya's ask of 2026-11-15): a reader who is not signed in gives a name before the map
 * opens, and the page says first what the company keeps: the name, the phone or computer, and when. A signed-in
 * teammate is named from their account and types nothing. The name is kept on the phone so nobody is asked twice.
 *
 * **Show where I am** puts the reader's own dot on the map so they can follow the line. It is asked for on a press, and
 * the line under the press says the company will see where they are while it is on: the first point and then the
 * latest, about once a minute. Not pressing it shares nothing. The sample sends nothing and keeps nothing. Light, on
 * the portal's paper, as `/e`, `/pay`, `/b` and `/r` are.
 *
 * **How sure the reader's phone is** (punch list #402, call 6). A sure reading keeps its words and gains a tick. A
 * weak one says the signal is weak, and never names the switch. A reading that is only an area, and has stayed one
 * for the wait, draws no dot and gets no word about where the reader stands: the page says the phone is only giving
 * an area, and names Precise Location there alone, with the steps for this phone. A stranger was never told what the
 * switch is, so it is named only where it is the thing to press.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { SAMPLE_BANNER_TEXT, sampleStateFromToken } from '../lib/customerSampleMode'
import { directionsUrlForPoint } from '../lib/directionsUrl'
import { lineLengthWords, mapLengthMeters, aboutLengthWords } from '../lib/paintedMap/paintedMap'
import { PAINTED_MAP_LINK_WORDS, PAINTED_MAP_VISITOR_NAME_MAX, linkEndsWords, paintedMapLinkCode, paintedMapVisitorName, sharedLineForCanvas, sharedPlacesForCanvas } from '../lib/paintedMap/paintedMapLink'
import { paintedWayIo, type PaintedWayAsk, type PaintedWayIo, type PaintedWayView } from '../lib/paintedMap/paintedMapLinkIo'
import { WAY_AREA_PRIVACY_WORDS, WAY_LENGTH_GUIDE_WORDS, WAY_NAME_WORDS, WAY_PRIVACY_WORDS, rememberWayName, wayAreaSeenWords, wayDeviceId, wayIsSeenWords, wayKeptWords, wayLineUnderWords, wayNoFixWords, wayOpenedAsWords, wayPointIsDue, wayReading, wayRememberedName, wayScreenWords, wayWillSeeWords, wayWords } from '../lib/paintedMap/paintedWay'
import { SAMPLE_PAINTED_WAY, SAMPLE_PAINTED_WAY_COMPANY } from '../lib/paintedMap/paintedWaySample'
import { roughCircleWords, wayRoughWords, wayWeakWords } from '../lib/paintedMap/preciseLocation'
import { usePhoneKind, useRoughHeld } from '../hooks/usePreciseLocation'
import { PaintedPlaceMark } from '../components/paintedMap/PaintedPlaceMark'
import { PaintedPlaceWords } from '../components/paintedMap/PaintedPlaceWords'
import { PreciseSteps, PreciseTick } from '../components/paintedMap/PreciseLocationLine'
import { PAINT_COLOR } from '../components/paintedMap/paintedMapLook'
import { CARD, HAIR, INK, MUTED, NOTE_BAND, PAPER, PORTAL_FONT } from '../lib/portal/portalTheme'

const PaintedMapCanvasLazy = lazy(() => import('../components/paintedMap/PaintedMapCanvas'))

type View = PaintedWayView | { kind: 'loading' }
type Me = { lat: number; lng: number; accuracyM: number | null }

const page: CSSProperties = { minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, fontSize: 16, lineHeight: 1.45 }
const column: CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '0 0 40px' }
const pad: CSSProperties = { padding: '0 16px' }
const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, padding: 14, marginTop: 12 }
const press: CSSProperties = { display: 'block', width: '100%', minHeight: 50, borderRadius: 10, border: `1px solid ${HAIR}`, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '8px 12px', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', lineHeight: '32px' }
const tiny: CSSProperties = { fontSize: 12.5, color: MUTED }
/** A weak signal, or a phone that gives only an area: the app's own amber, which this light page reads as it is. */
const amber: CSSProperties = { margin: '8px 0 0', fontSize: 14, color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '9px 11px' }

/** The browser's own store, or none where it is switched off. */
const wayStore = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** A new id for a device that has none: the browser's own, or one built from its random bytes. */
const newDeviceId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default function PaintedWay({ io = paintedWayIo }: { io?: PaintedWayIo }) {
  const { code: raw } = useParams<{ code: string }>()
  const code = paintedMapLinkCode(raw)
  // What customers see: the sample token draws a made-up map and reads no link, table or function.
  const sample = sampleStateFromToken(raw ?? null) !== null
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [me, setMe] = useState<Me | null>(null)
  const [showMe, setShowMe] = useState(false)
  const [noFix, setNoFix] = useState<string | null>(null)
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const watchId = useRef<number | null>(null)
  const [nameText, setNameText] = useState('')
  const [nameNote, setNameNote] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  // One id for the whole visit, the kept one when the browser keeps things.
  const deviceId = useRef<string | null>(null)
  // The name the reader just typed, so Try again after no signal does not ask for it twice.
  const typedName = useRef<string | null>(null)
  const pointSentAt = useRef<number | null>(null)
  // The last point sent was an area: the first spot after it does not wait out the minute.
  const sentArea = useRef(false)

  const askFor = useCallback((name: string | null): PaintedWayAsk => {
    deviceId.current ??= wayDeviceId(wayStore(), newDeviceId)
    let timeZone = ''
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    } catch {
      // A browser with no time zone to tell.
    }
    return { name, device: { id: deviceId.current, screen: wayScreenWords(window.screen?.width, window.screen?.height, window.devicePixelRatio), language: navigator.language ?? '', timeZone } }
  }, [])

  const landed = useCallback((next: PaintedWayView) => {
    // The name the function kept is the one remembered: a signed-in teammate's is their account's, not this phone's.
    if (next.kind === 'open' && next.visitor && !next.visitor.signedIn) rememberWayName(wayStore(), next.visitor.name)
    if (next.kind === 'open' || next.kind === 'name') typedName.current = null
    setView(next)
  }, [])

  const load = useCallback(async () => {
    if (sample) {
      setView({ kind: 'open', map: SAMPLE_PAINTED_WAY, company: { ...SAMPLE_PAINTED_WAY_COMPANY }, endsOn: null })
      return
    }
    if (!code) {
      setView({ kind: 'gone' })
      return
    }
    setView({ kind: 'loading' })
    landed(await io.open(code, askFor(typedName.current ?? wayRememberedName(wayStore()))))
  }, [code, io, sample, askFor, landed])

  const giveName = useCallback(async () => {
    if (!code || opening) return
    const name = paintedMapVisitorName(nameText)
    if (!name) {
      setNameNote(PAINTED_MAP_LINK_WORDS.needsName)
      return
    }
    setNameNote(null)
    setOpening(true)
    typedName.current = name
    const next = await io.open(code, askFor(name))
    setOpening(false)
    landed(next)
  }, [code, opening, nameText, io, askFor, landed])

  useEffect(() => {
    void load()
  }, [load])

  const shared = view.kind === 'open' ? view.map : null
  useEffect(() => {
    document.title = shared ? `${shared.name}${view.kind === 'open' && view.company.name ? ` · ${view.company.name}` : ''}` : 'A painted map'
  }, [shared, view])

  // The reader's own dot: read only after their press and only while they keep it on. On a real link the company sees
  // it too, as the line under the press says. What is sent, and when, is the effect under `reading`.
  useEffect(() => {
    if (!showMe) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNoFix(wayNoFixWords('none'))
      setShowMe(false)
      return
    }
    setNoFix(null)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null }
        setMe(at)
      },
      (err) => {
        if (err.code === 1) {
          setNoFix(wayNoFixWords('refused'))
          setShowMe(false)
        } else if (err.code === 2) {
          setNoFix(wayNoFixWords('failed'))
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    )
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
      pointSentAt.current = null
      sentArea.current = false
      setMe(null)
    }
  }, [showMe, sample, code, io])

  const lines = useMemo(() => (shared ? shared.lines.map(sharedLineForCanvas) : []), [shared])
  const places = useMemo(() => (shared ? sharedPlacesForCanvas(shared) : []), [shared])
  const start = useMemo(() => {
    const first = lines[0]?.points[0]
    if (first) return first
    const place = places[0]
    return place ? { lat: place.lat, lng: place.lng } : null
  }, [lines, places])
  const directions = start ? directionsUrlForPoint(start.lat, start.lng) : null
  // How sure the reader's phone is (#402). A rough reading is called an area only once the readings have stayed rough
  // for the wait, and until then the page is still finding them: a phone can open with one reading off a cell tower.
  const phoneKind = usePhoneKind()
  const roughHeld = useRoughHeld(showMe ? (me?.accuracyM ?? null) : null)
  const mapPoints = useMemo(() => [...lines.flatMap((l) => l.points), ...places], [lines, places])
  // A spot near the map is held in one picture with it, and across town the picture stays on the map and the words
  // say how far. An area whose edge is near the map is shown whole. Its middle is nobody's spot, so it gets no dot.
  const reading = useMemo(() => wayReading(showMe ? me : null, roughHeld, mapPoints), [showMe, me, roughHeld, mapPoints])
  // What the company is sent is what the page has made up its mind about: a spot, or an area once the readings have
  // stayed rough for the wait, with its margin, which the office reads as an area. A reading still being waited on is
  // sent to nobody, so a first reading off a cell tower is never kept as where the reader was. The sample sends none.
  useEffect(() => {
    if (sample || !code || !deviceId.current || reading.kind === 'finding') return
    const isArea = reading.kind === 'area'
    const now = Date.now()
    if (!wayPointIsDue(pointSentAt.current, now, { lastWasArea: sentArea.current, isArea })) return
    pointSentAt.current = now
    sentArea.current = isArea
    void io.here(code, deviceId.current, { lat: reading.me.lat, lng: reading.me.lng, accuracyM: reading.me.accuracyM })
  }, [reading, sample, code, io])
  const where = reading.kind === 'spot' ? wayWords(reading.me, lines, start) : null
  const weak = reading.kind === 'spot' && reading.weak ? wayWeakWords(reading.me.accuracyM, phoneKind) : null
  const area = reading.kind === 'area' ? wayRoughWords(reading.me.accuracyM, phoneKind) : null
  // Whoever sent the map, for the words that say who sees what. The sample's reader is seen by nobody.
  const sentBy = view.kind === 'open' || view.kind === 'name' ? view.company.name : ''
  const visitor = view.kind === 'open' ? (view.visitor ?? null) : null
  const notMe = () => {
    if (view.kind !== 'open') return
    rememberWayName(wayStore(), null)
    setShowMe(false)
    setNameText('')
    setNameNote(null)
    setView({ kind: 'name', mapName: view.map.name, company: view.company, endsOn: view.endsOn })
  }

  return (
    <div data-theme="light" data-painted-way={view.kind} style={page}>
      <div style={column}>
        {sample ? <div role="status" style={{ background: INK, color: CARD, fontSize: 13, padding: '8px 16px' }}>{SAMPLE_BANNER_TEXT}</div> : null}
        <header style={{ ...pad, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `3px solid ${INK}`, background: CARD }}>
          <div>
            <div style={{ fontWeight: 700 }}>{sentBy || 'A painted map'}</div>
            <div style={tiny}>{view.kind === 'open' || view.kind === 'name' ? 'sent you a map' : ' '}</div>
          </div>
        </header>

        {view.kind === 'loading' ? (
          <p style={{ ...pad, marginTop: 20, color: MUTED }}>Opening the map…</p>
        ) : view.kind === 'gone' ? (
          <div style={{ ...pad, marginTop: 20 }} role="status">
            <b>{PAINTED_MAP_LINK_WORDS.gone.split('. ')[0]}.</b>
            <div style={{ color: MUTED }}>{PAINTED_MAP_LINK_WORDS.gone.split('. ').slice(1).join('. ')}</div>
          </div>
        ) : view.kind === 'locked' ? (
          <p style={{ ...pad, marginTop: 20 }} role="status">{PAINTED_MAP_LINK_WORDS.locked}</p>
        ) : view.kind === 'signal' || view.kind === 'failed' ? (
          <div style={{ ...pad, marginTop: 20, display: 'grid', gap: 12 }}>
            <p role="alert" style={{ margin: 0 }}>{view.kind === 'signal' ? 'The map did not load. There may be no signal here.' : view.words}</p>
            <button type="button" style={{ ...press, background: INK, color: CARD, borderColor: INK }} onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : view.kind === 'name' ? (
          <form
            data-way-name
            style={{ ...pad, marginTop: 16, display: 'grid', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault()
              void giveName()
            }}
          >
            {view.mapName ? <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{view.mapName}</h1> : null}
            <div style={card}>
              <label htmlFor="way-name" style={{ display: 'block', fontWeight: 700 }}>
                {WAY_NAME_WORDS.head}
              </label>
              <input
                id="way-name"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="go"
                maxLength={PAINTED_MAP_VISITOR_NAME_MAX}
                value={nameText}
                onChange={(e) => {
                  setNameText(e.target.value)
                  setNameNote(null)
                }}
                placeholder={WAY_NAME_WORDS.placeholder}
                aria-label={WAY_NAME_WORDS.label}
                aria-describedby="way-name-kept"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '12px 12px', fontSize: 17, borderRadius: 10, border: `1px solid ${HAIR}`, background: CARD, color: INK, fontFamily: 'inherit' }}
              />
              {nameNote ? <p role="alert" style={{ margin: '8px 0 0', fontSize: 14 }}>{nameNote}</p> : null}
              <p id="way-name-kept" data-way-kept style={{ ...tiny, margin: '10px 0 0' }}>
                {wayKeptWords(view.company.name)}
              </p>
            </div>
            <button type="submit" disabled={opening} style={{ ...press, background: INK, color: CARD, borderColor: INK, opacity: opening ? 0.7 : 1 }}>
              {opening ? WAY_NAME_WORDS.opening : WAY_NAME_WORDS.open}
            </button>
          </form>
        ) : shared ? (
          <>
            <div style={{ ...pad, paddingTop: 14 }}>
              <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{shared.name}</h1>
              {shared.words ? <p style={{ margin: '4px 0 0', color: MUTED }}>{shared.words}</p> : null}
            </div>
            <div style={{ marginTop: 12, position: 'relative' }}>
              <Suspense fallback={<p style={{ ...pad, color: MUTED }}>Loading the map…</p>}>
                <PaintedMapCanvasLazy lines={lines} places={places} height={360} me={reading.kind === 'finding' ? null : reading.me} frameMe={reading.kind === 'spot' && reading.together} frameMargin={reading.kind === 'area' && reading.circle} onTilesFailed={() => setMapFailed(true)} onPlaceTap={(id) => document.getElementById(`way-place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
              </Suspense>
            </div>
            <div style={pad}>
              {mapFailed ? <p role="status" style={{ ...tiny, margin: '8px 0 0' }}>The picture under the line did not load. There may be no signal here. The line is still right.</p> : null}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {directions ? (
                  <a href={directions} target="_blank" rel="noopener noreferrer" data-way-directions style={{ ...press, background: INK, color: CARD, borderColor: INK }}>
                    Directions to the start
                  </a>
                ) : null}
                <button type="button" data-way-me aria-pressed={showMe} style={{ ...press, background: CARD, color: INK }} onClick={() => setShowMe((on) => !on)}>
                  {showMe ? 'Hide where I am' : 'Show where I am'}
                </button>
              </div>
              {!sample && !showMe ? <p data-way-will-see style={{ ...tiny, margin: '6px 0 0' }}>{wayWillSeeWords(sentBy)}</p> : null}
              {noFix ? <p role="status" style={{ ...tiny, margin: '8px 0 0' }}>{noFix}</p> : null}
              {showMe ? (
                <div role="status" data-way-where={reading.kind === 'spot' ? (weak ? 'weak' : 'spot') : reading.kind} style={{ marginTop: 10, borderRadius: 10, padding: '10px 12px', background: NOTE_BAND, border: `1px solid ${HAIR}` }}>
                  {area && reading.kind === 'area' ? (
                    // The phone gives an area and not a spot: nothing is said about where the reader stands against the map.
                    <div data-way-rough style={{ ...amber, marginTop: 0 }}>
                      <b>{area.lead}</b> {area.tail}
                      {reading.circle ? ` ${roughCircleWords(reading.me.accuracyM) ?? ''}` : null}
                      <p style={{ margin: '8px 0 0' }}>{area.ask}</p>
                      <PreciseSteps kind={phoneKind} />
                    </div>
                  ) : where ? (
                    <>
                      <b>{where.lead}</b>
                      {weak ? (
                        <p data-way-weak style={amber}>
                          {weak.lead} {weak.tail}
                        </p>
                      ) : where.sure ? (
                        <span data-way-sure style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 14 }}>
                          <PreciseTick />
                          {where.sure}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    'Finding you…'
                  )}
                  {/* Under an area there is no dot, and the company is sent the area: the line says that and no more. */}
                  <div data-way-seen={reading.kind === 'area' ? 'area' : 'spot'} style={{ ...tiny, marginTop: 6 }}>
                    {reading.kind === 'area' ? (sample ? WAY_AREA_PRIVACY_WORDS : wayAreaSeenWords(sentBy)) : sample ? WAY_PRIVACY_WORDS : wayIsSeenWords(sentBy)}
                  </div>
                </div>
              ) : null}

              {places.length > 0 ? (
                <div style={card}>
                  {shared.places.map((p, i) => (
                    <div key={p.id} id={`way-place-${p.id}`} data-way-place style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start', paddingTop: i === 0 ? 0 : 12, marginTop: i === 0 ? 0 : 12, borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
                      <PaintedPlaceMark number={p.number} kind={p.kind} size={30} ink={INK} paper={CARD} />
                      <div>
                        <b>{p.name}</b>
                        <PaintedPlaceWords words={p.words} name={p.name} style={{ color: MUTED }} />
                      </div>
                      {p.photo && code ? (
                        <button type="button" aria-label={`Open the photo of ${p.name}`} onClick={() => setPhoto({ url: io.photoUrl(code, p.id, deviceId.current), name: p.name })} style={{ padding: 0, border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden', background: NOTE_BAND, cursor: 'pointer', width: 84, height: 63 }}>
                          <img src={io.photoUrl(code, p.id, deviceId.current)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {shared.lines.length > 0 ? (
                <div style={card} data-way-lines>
                  {shared.lines.length > 1 ? <div style={{ fontWeight: 700, marginBottom: 6 }}>{aboutLengthWords(mapLengthMeters(shared.lines)).replace(/^a/, 'A')} in {shared.lines.length} lines</div> : null}
                  {shared.lines.map((l, i) => {
                    const w = lineLengthWords(l)
                    return (
                      <div key={i} data-way-line style={{ fontSize: 15, marginTop: i === 0 ? 0 : 10 }}>
                        <div>
                          <span style={{ display: 'inline-block', width: 20, height: 5, borderRadius: 3, background: PAINT_COLOR, verticalAlign: 'middle', marginRight: 8 }} />
                          <b>{w.lead}</b>
                          {w.tail ? `, ${w.tail}` : ''}
                        </div>
                        {/* How it was made and what the length is worth: one sentence, under the length. */}
                        <div data-way-line-under style={{ ...tiny, marginTop: 4 }}>
                          {wayLineUnderWords(l, w.measured, shared.lines.length === 1)}
                        </div>
                      </div>
                    )
                  })}
                  {shared.lines.length > 1 && shared.lines.some((l) => !lineLengthWords(l).measured) ? <div style={{ ...tiny, marginTop: 10 }}>{WAY_LENGTH_GUIDE_WORDS}</div> : null}
                </div>
              ) : null}

              <p style={{ ...tiny, marginTop: 16 }}>
                {view.kind === 'open' && view.company.name ? `${view.company.name} shared this map with you.` : 'This map was shared with you.'} {view.kind === 'open' ? linkEndsWords(view.endsOn) : null}
              </p>
              {visitor ? (
                <p data-way-opened-as style={{ ...tiny, marginTop: 6 }}>
                  {wayOpenedAsWords(visitor.name)}{' '}
                  {visitor.signedIn ? null : (
                    <button type="button" onClick={notMe} style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: INK, textDecoration: 'underline', cursor: 'pointer' }}>
                      {WAY_NAME_WORDS.change}
                    </button>
                  )}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      {photo ? (
        <div role="dialog" aria-modal="true" aria-label={`The photo of ${photo.name}`} data-way-photo style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)', display: 'grid', placeItems: 'center', padding: 'calc(12px + var(--app-top-chrome, 0px)) 12px 12px' }} onClick={() => setPhoto(null)}>
          <img src={photo.url} alt={photo.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
          <button type="button" onClick={() => setPhoto(null)} style={{ position: 'absolute', right: 12, top: 'calc(12px + var(--app-top-chrome, 0px))', minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(17,24,39,0.7)', color: CARD, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  )
}
