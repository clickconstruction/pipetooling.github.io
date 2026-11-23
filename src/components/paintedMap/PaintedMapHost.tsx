/**
 * The one host for painted maps (punch list #345), mounted in the Layout. Any screen asks through
 * `paintedMapDoor`, and this answers with the start sheet or the map's window. The line under a
 * job's address sits inside the job's window and needs no provider above it to open one.
 *
 * It also offers back a walk that was never saved. A walk is kept on the phone while it is painted,
 * so a reload or a trip to the camera does not lose it, and the readings in it are the one thing
 * here that says where a person was and when. So it is never left lying there unseen: the app says
 * it is on the phone, offers to look it over or throw it away, and drops it after a day.
 *
 * And it sends a place that was set with no signal (punch list #413, step 2b). Such a place waits
 * on the phone with its photos. The host tries to send it when the app opens, when the phone says
 * the signal is back and when a map's window closes, and says how many still wait, with a press to
 * try now.
 */
import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../ConfirmDialog'
import { useAuth } from '../../hooks/useAuth'
import { readKeptWalkRaw, writeKeptWalk } from '../../hooks/usePaintedWalk'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { onPaintedMapAsk, type PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import { KEPT_SPOT_WORDS, keptSpotsWords } from '../../lib/paintedMap/paintedKeptSpot'
import { readKeptSpots, sendKeptSpots } from '../../lib/paintedMap/paintedKeptSpotIo'
import { paintedMapAskFromSearch, withoutPaintedMapAsk } from '../../lib/paintedMap/paintedMapSearch'
import type { PaintedSpot } from '../../lib/paintedMap/paintedSpot'
import { readKeptWalk, walkHasLine, type KeptWalk } from '../../lib/paintedMap/paintedWalk'
import { keptWalkWords } from '../../lib/paintedMap/paintedWalkWords'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { lazyWindow } from '../../lib/lazyWindow'
import { WINDOW_NAMES } from '../../lib/windowLoad'
import { WindowLoadBoundary } from '../WindowLoadBoundary'
import { WindowOpening } from '../WindowOpening'
import type { KeptPaintedWalk, PaintedMapToStart } from './PaintedMapWindow'

// The start sheet and the map's window are chunks of their own (`lazyWindow`). The host is mounted in the Layout
// to hear a door from anywhere, and importing them here put the map, its canvas glue and its lists in the entry's chunk.
const PaintAMapStartSheet = lazyWindow(() => import('./PaintAMapStartSheet').then((m) => ({ default: m.PaintAMapStartSheet })))
const PaintedMapWindow = lazyWindow(() => import('./PaintedMapWindow').then((m) => ({ default: m.PaintedMapWindow })))
const MAP_OPENING = <WindowOpening words="Opening the map…" />
/** The host's two windows, for a caller that wants them loaded before anyone asks (a test's setup does). */
// eslint-disable-next-line react-refresh/only-export-components -- the windows this host loads, beside the host
export const PAINTED_MAP_WINDOWS = [PaintAMapStartSheet, PaintedMapWindow] as const

type Open =
  | { kind: 'sheet'; home: PaintedMapHome }
  | { kind: 'new'; start: PaintedMapToStart; /** A caller that asked for this map by the door hears when its window closes. */ onClosed?: () => void }
  | { kind: 'map'; mapId: string; address: string | null; add?: 'place'; spot?: PaintedSpot; place?: string }
  | { kind: 'kept'; kept: KeptWalk<KeptPaintedWalk> }

const press: CSSProperties = { minHeight: 40, padding: '0 0.8rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }

/**
 * One of the host's windows, in a boundary of its own. While its code comes the note shows and the host keeps what
 * it holds. When the code does not come only the window gives up (`WindowLoadBoundary`): `close` shuts it, and the
 * kept walk's offer and the places that wait are back on the page.
 */
function heldMapWindow(window: ReactNode, close: () => void) {
  return (
    <WindowLoadBoundary what={WINDOW_NAMES.map} onGaveUp={close}>
      <Suspense fallback={MAP_OPENING}>{window}</Suspense>
    </WindowLoadBoundary>
  )
}

/** The host, in a boundary of its own: its windows load on demand, and a load must never blank the page around it. */
export function PaintedMapHost() {
  return (
    <Suspense fallback={MAP_OPENING}>
      <PaintedMapHostBody />
    </Suspense>
  )
}

function PaintedMapHostBody() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [open, setOpen] = useState<Open | null>(null)
  const [offer, setOffer] = useState<KeptWalk<KeptPaintedWalk> | null>(null)
  const [throwing, setThrowing] = useState(false)

  useEffect(
    () =>
      onPaintedMapAsk((ask) => {
        if (ask.kind === 'start') setOpen({ kind: 'sheet', home: ask.home })
        else if (ask.kind === 'paint') setOpen({ kind: 'new', start: ask.start, ...(ask.onClosed ? { onClosed: ask.onClosed } : {}) })
        else setOpen({ kind: 'map', mapId: ask.mapId, address: ask.address ?? null, ...(ask.add ? { add: ask.add } : {}), ...(ask.spot ? { spot: ask.spot } : {}), ...(ask.place ? { place: ask.place } : {}) })
      }),
    [],
  )

  // The header search's doors are links: `?paintMap=1` opens the start sheet with no job, `?paintedMap=<id>` opens a
  // map. The key is taken off the address at once, so a reload or Back does not open the window again.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const ask = paintedMapAskFromSearch(searchParams)
    if (!ask) return
    if (ask.kind === 'start') setOpen({ kind: 'sheet', home: { jobId: null, developmentId: null, label: '', developmentLabel: '', address: null, center: null } })
    else setOpen({ kind: 'map', mapId: ask.mapId, address: null })
    setSearchParams(withoutPaintedMapAsk(searchParams), { replace: true })
  }, [searchParams, setSearchParams])

  // What the phone keeps, read whenever no map is open: on arrival, and after a window closes.
  const readOffer = useCallback(() => {
    if (!userId) {
      setOffer(null)
      return
    }
    const kept = readKeptWalk<KeptPaintedWalk>(readKeptWalkRaw(userId), Date.now())
    const worth = !!kept && typeof kept.map?.mapId === 'string' && ((kept.map.pending?.length ?? 0) > 0 || (!!kept.state && walkHasLine(kept.state)))
    // A day old, mangled, or with no line in it: it is not offered, and it is not left on the phone either.
    if (!worth && readKeptWalkRaw(userId)) writeKeptWalk(userId, null)
    setOffer(worth ? kept : null)
  }, [userId])

  useEffect(() => {
    if (!open) readOffer()
  }, [open, readOffer])

  // Places set with no signal (#413, step 2b): how many wait on this phone, and one try to send them at a time.
  const [waiting, setWaiting] = useState(0)
  const [sending, setSending] = useState(false)
  const busySending = useRef(false)
  const sendWaiting = useCallback(async () => {
    if (!userId || busySending.current) return
    const count = readKeptSpots(userId).length
    setWaiting(count)
    if (count === 0) return
    // An offline phone is not asked: the try would only fail, and the count already says what waits.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    busySending.current = true
    setSending(true)
    try {
      const res = await sendKeptSpots(userId)
      setWaiting(res.waiting)
    } finally {
      busySending.current = false
      setSending(false)
    }
  }, [userId])
  // When the app opens, when a map's window closes, and when the phone says the signal is back.
  useEffect(() => {
    if (!open) void sendWaiting()
  }, [open, sendWaiting])
  useEffect(() => {
    const onBack = () => void sendWaiting()
    window.addEventListener('online', onBack)
    return () => window.removeEventListener('online', onBack)
  }, [sendWaiting])

  const shut = () => setOpen(null)
  if (open?.kind === 'sheet') return heldMapWindow(<PaintAMapStartSheet home={open.home} onStart={(start) => setOpen({ kind: 'new', start })} onClose={shut} />, shut)
  if (open?.kind === 'new') {
    const { onClosed } = open
    // A caller that asked for this map by the door hears that its window closed, a window that never came included.
    const shutAndTell = () => {
      setOpen(null)
      onClosed?.()
    }
    return heldMapWindow(
      <PaintedMapWindow
        key={open.start.id}
        ask={{ start: open.start }}
        address={open.start.home.address ?? null}
        center={open.start.home.center ?? null}
        spot={open.start.spot ?? null}
        onClose={shutAndTell}
      />,
      shutAndTell,
    )
  }
  if (open?.kind === 'map') return heldMapWindow(<PaintedMapWindow key={open.mapId} ask={{ mapId: open.mapId }} address={open.address} openOn={open.add ?? null} spot={open.spot ?? null} pickPlace={open.place ?? null} onClose={shut} />, shut)
  if (open?.kind === 'kept') {
    const { map, state } = open.kept
    return heldMapWindow(<PaintedMapWindow key={`kept-${map.mapId}`} ask={map.start ? { start: map.start } : { mapId: map.mapId }} kept={{ state, pending: map.pending ?? [] }} address={map.address ?? null} onClose={shut} />, shut)
  }
  // Places that wait for a signal: said above the dock, over a kept walk's offer when there is one.
  const waitingBand =
    userId && waiting > 0 ? (
      <div data-painted-spots-waiting role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: `calc(${offer ? 196 : 84}px + env(safe-area-inset-bottom, 0px))`, zIndex: 760, margin: '0 auto', maxWidth: 520, background: 'var(--surface)', color: 'var(--text-strong)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-amber)', borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,.22)', padding: '0.65rem 0.8rem', display: 'grid', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem' }}>{keptSpotsWords(waiting)}</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" data-painted-spots-send style={sending ? { ...press, minHeight: 44, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' } : { ...press, minHeight: 44 }} disabled={sending} onClick={() => void sendWaiting()}>
            {sending ? KEPT_SPOT_WORDS.sending : KEPT_SPOT_WORDS.send}
          </button>
        </div>
      </div>
    ) : null

  if (!offer || !userId) return waitingBand

  const at = new Date(offer.savedAtMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
  return (
    <>
      {waitingBand}
      <div data-painted-walk-kept role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 760, margin: '0 auto', maxWidth: 520, background: 'var(--surface)', color: 'var(--text-strong)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-amber)', borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,.22)', padding: '0.65rem 0.8rem', display: 'grid', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem' }}>{keptWalkWords(at)}</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} onClick={() => setOpen({ kind: 'kept', kept: offer })}>
            Look it over
          </button>
          <button type="button" style={press} onClick={() => setThrowing(true)}>
            Throw it away
          </button>
        </div>
      </div>
      {throwing ? (
        <ConfirmDialog
          title="Throw the walk away?"
          body="What you painted goes from this phone. Nothing was sent anywhere, so nothing is left behind."
          confirmLabel="Throw the walk away"
          cancelLabel="Keep it"
          onConfirm={() => {
            writeKeptWalk(userId, null)
            setThrowing(false)
            setOffer(null)
          }}
          onCancel={() => setThrowing(false)}
        />
      ) : null}
    </>
  )
}
