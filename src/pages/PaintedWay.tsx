/**
 * A painted map, shared (punch list #345, PR 4, v2.7223): what `/way/<code>` opens, with no sign-in. The link carries
 * one painted map: its name, its lines, and its places with their words and photos. The ten-letter code is the key, as
 * an estimate's link is, and the page shows nothing else from the app: not who painted the map, not when, not the job.
 *
 * **Show where I am** puts the reader's own dot on the map so they can follow the line. It is asked for on a press, it
 * moves while the page is open and on the screen, and it never leaves the phone: nothing here sends a position
 * anywhere. Light, on the portal's paper, as `/e`, `/pay`, `/b` and `/r` are.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { SAMPLE_BANNER_TEXT, sampleStateFromToken } from '../lib/customerSampleMode'
import { directionsUrlForPoint } from '../lib/directionsUrl'
import { lineHowWords, lineLengthWords, mapLengthMeters, aboutLengthWords } from '../lib/paintedMap/paintedMap'
import { PAINTED_MAP_LINK_WORDS, linkEndsWords, paintedMapLinkCode, sharedLineForCanvas, sharedPlacesForCanvas } from '../lib/paintedMap/paintedMapLink'
import { paintedWayIo, type PaintedWayIo, type PaintedWayView } from '../lib/paintedMap/paintedMapLinkIo'
import { WAY_PRIVACY_WORDS, wayNearMap, wayNoFixWords, wayWords } from '../lib/paintedMap/paintedWay'
import { SAMPLE_PAINTED_WAY, SAMPLE_PAINTED_WAY_COMPANY } from '../lib/paintedMap/paintedWaySample'
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
    setView(await io.read(code))
  }, [code, io, sample])

  useEffect(() => {
    void load()
  }, [load])

  const shared = view.kind === 'open' ? view.map : null
  useEffect(() => {
    document.title = shared ? `${shared.name}${view.kind === 'open' && view.company.name ? ` · ${view.company.name}` : ''}` : 'A painted map'
  }, [shared, view])

  // The reader's own dot: read only after their press, only while they keep it on, and kept in this page alone.
  useEffect(() => {
    if (!showMe) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNoFix(wayNoFixWords('none'))
      setShowMe(false)
      return
    }
    setNoFix(null)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null }),
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
      setMe(null)
    }
  }, [showMe])

  const lines = useMemo(() => (shared ? shared.lines.map(sharedLineForCanvas) : []), [shared])
  const places = useMemo(() => (shared ? sharedPlacesForCanvas(shared) : []), [shared])
  const start = useMemo(() => {
    const first = lines[0]?.points[0]
    if (first) return first
    const place = places[0]
    return place ? { lat: place.lat, lng: place.lng } : null
  }, [lines, places])
  const directions = start ? directionsUrlForPoint(start.lat, start.lng) : null
  // Near the map, the picture holds the reader and the map together. Across town it stays on the map, and the words say how far.
  const near = useMemo(() => (me ? wayNearMap(me, [...lines.flatMap((l) => l.points), ...places]) : false), [me, lines, places])
  const where = me ? wayWords(me, lines, start) : null

  return (
    <div data-theme="light" data-painted-way={view.kind} style={page}>
      <div style={column}>
        {sample ? <div role="status" style={{ background: INK, color: CARD, fontSize: 13, padding: '8px 16px' }}>{SAMPLE_BANNER_TEXT}</div> : null}
        <header style={{ ...pad, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `3px solid ${INK}`, background: CARD }}>
          <div>
            <div style={{ fontWeight: 700 }}>{view.kind === 'open' && view.company.name ? view.company.name : 'A painted map'}</div>
            <div style={tiny}>{view.kind === 'open' ? 'sent you a map' : ' '}</div>
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
        ) : shared ? (
          <>
            <div style={{ ...pad, paddingTop: 14 }}>
              <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{shared.name}</h1>
              {shared.words ? <p style={{ margin: '4px 0 0', color: MUTED }}>{shared.words}</p> : null}
            </div>
            <div style={{ marginTop: 12, position: 'relative' }}>
              <Suspense fallback={<p style={{ ...pad, color: MUTED }}>Loading the map…</p>}>
                <PaintedMapCanvasLazy lines={lines} places={places} height={360} me={me} frameMe={showMe && near} onTilesFailed={() => setMapFailed(true)} onPlaceTap={(id) => document.getElementById(`way-place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
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
              {noFix ? <p role="status" style={{ ...tiny, margin: '8px 0 0' }}>{noFix}</p> : null}
              {showMe ? (
                <div role="status" data-way-where style={{ marginTop: 10, borderRadius: 10, padding: '10px 12px', background: NOTE_BAND, border: `1px solid ${HAIR}` }}>
                  {where ? (
                    <>
                      <b>{where.lead}</b> {where.sure}
                    </>
                  ) : (
                    'Finding you…'
                  )}
                  <div style={{ ...tiny, marginTop: 6 }}>{WAY_PRIVACY_WORDS}</div>
                </div>
              ) : null}

              {places.length > 0 ? (
                <div style={card}>
                  {shared.places.map((p, i) => (
                    <div key={p.id} id={`way-place-${p.id}`} data-way-place style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start', paddingTop: i === 0 ? 0 : 12, marginTop: i === 0 ? 0 : 12, borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
                      <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${INK}`, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800 }}>{p.number}</span>
                      <div>
                        <b>{p.name}</b>
                        {p.words ? <div style={{ color: MUTED }}>{p.words}</div> : null}
                      </div>
                      {p.photo && code ? (
                        <button type="button" aria-label={`Open the photo of ${p.name}`} onClick={() => setPhoto({ url: io.photoUrl(code, p.id), name: p.name })} style={{ padding: 0, border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden', background: NOTE_BAND, cursor: 'pointer', width: 84, height: 63 }}>
                          <img src={io.photoUrl(code, p.id)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')} />
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
                      <div key={i} style={{ fontSize: 15, marginTop: i === 0 ? 0 : 4 }}>
                        <span style={{ display: 'inline-block', width: 20, height: 5, borderRadius: 3, background: PAINT_COLOR, verticalAlign: 'middle', marginRight: 8 }} />
                        <b>{w.lead}</b>
                        {w.tail ? `, ${w.tail}` : ''} <span style={{ color: MUTED }}>· {lineHowWords(l)}</span>
                      </div>
                    )
                  })}
                  <div style={{ ...tiny, marginTop: 8 }}>A length here is a guide for how far. It is not a measurement.</div>
                </div>
              ) : null}

              <p style={{ ...tiny, marginTop: 16 }}>
                {view.kind === 'open' && view.company.name ? `${view.company.name} shared this map with you.` : 'This map was shared with you.'} {view.kind === 'open' ? linkEndsWords(view.endsOn) : null}
              </p>
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
