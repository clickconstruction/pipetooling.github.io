/**
 * Google Maps pins canvas (v2.3162) — the Maps JavaScript API half shared by
 * the Dashboard "Your jobs on a map" card and the Bid Board "Bids on a map"
 * card. Same props as `PinsMapCanvas` plus `apiKey` and `onUnavailable`,
 * which the card treats as "fall back to OpenStreetMap for the rest of this
 * page": the API failed to load (bad key, blocked referrer, network), took
 * longer than the timeout, never painted, or threw while rendering.
 *
 * Circle markers in the caller's colors (a ring color becomes a thick stroke),
 * a desktop info window whose body the caller renders, an optional anchor
 * diamond with distance rings, fit-to-all, and Google's native dark color
 * scheme following the app's `<html data-theme>` stamp. Lazy-load this file.
 */
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import {
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Marker,
  useMap,
  useMarkerRef,
} from '@vis.gl/react-google-maps'
import { googleColorSchemeForTheme } from '../../lib/dashboardJobsMap'
import { mapPointsBounds, type MapPoint } from '../../lib/map/mapPointsBounds'
import {
  MAP_CANVAS_ANCHOR_COLOR,
  MAP_CANVAS_SELECTED_COLOR,
  METERS_PER_MILE,
  mapCanvasFitPoints,
  type MapCanvasAnchor,
  type MapCanvasPin,
} from '../../lib/map/mapCanvasTypes'
import type { PinsMapCanvasProps } from './PinsMapCanvas'

export type PinsMapGoogleCanvasProps = PinsMapCanvasProps & {
  apiKey: string
  /** The API could not be used on this page — the card switches to OpenStreetMap. */
  onUnavailable: (reason: string) => void
}

/** How long the Maps script may take before the card gives up on it. */
const LOAD_TIMEOUT_MS = 10000
/**
 * How long a loaded API may take to actually paint a map (`.gm-style` in the
 * container). Live-tested 2026-09-08 with a bogus key: the script loads, markers
 * are created, but the map stays an empty div and neither `onError` nor
 * `gm_authFailure` fires — this watchdog is what catches that case.
 */
const PAINT_TIMEOUT_MS = 8000
const PAINT_POLL_MS = 500

function useStampedTheme(): string | null {
  const [theme, setTheme] = useState<string | null>(() =>
    typeof document === 'undefined' ? null : (document.documentElement.dataset.theme ?? null),
  )
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const obs = new MutationObserver(() => setTheme(document.documentElement.dataset.theme ?? null))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

function FitToPoints({ points, fitSignal }: { points: MapPoint[]; fitSignal: number }) {
  const map = useMap()
  const b = mapPointsBounds(points)
  const key = b ? `${b.south},${b.west},${b.north},${b.east}` : ''
  useEffect(() => {
    if (!map || !b) return
    const bounds = new google.maps.LatLngBounds({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east })
    map.fitBounds(bounds, 28)
    const once = google.maps.event.addListenerOnce(map, 'idle', () => {
      const z = map.getZoom()
      if (z != null && z > 15) map.setZoom(15)
    })
    return () => google.maps.event.removeListener(once)
    // key captures the bounds; fitSignal re-fits on demand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, fitSignal])
  return null
}

function pinIcon(p: MapCanvasPin, selected: boolean, isMobile: boolean): google.maps.Symbol {
  const ring = p.ringColor ?? null
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: selected ? 10 : isMobile ? 9 : 8,
    fillColor: p.color,
    fillOpacity: selected ? 0.9 : 0.8,
    strokeColor: selected ? MAP_CANVAS_SELECTED_COLOR : (ring ?? p.color),
    strokeWeight: selected ? 2 : ring ? 3 : 1,
  }
}

/** The office anchor: a diamond plus imperative circles (the library has no ring primitive we need). */
function AnchorLayer({ anchor }: { anchor: MapCanvasAnchor }) {
  const map = useMap()
  const ringsKey = (anchor.ringMiles ?? []).join(',')
  useEffect(() => {
    if (!map) return
    const circles = (anchor.ringMiles ?? []).map(
      (mi) =>
        new google.maps.Circle({
          map,
          center: { lat: anchor.lat, lng: anchor.lng },
          radius: mi * METERS_PER_MILE,
          strokeColor: MAP_CANVAS_SELECTED_COLOR,
          strokeOpacity: 0.5,
          strokeWeight: 1,
          fillOpacity: 0,
          clickable: false,
        }),
    )
    return () => circles.forEach((c) => c.setMap(null))
    // ringsKey captures the ring list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, anchor.lat, anchor.lng, ringsKey])
  return (
    <Marker
      position={{ lat: anchor.lat, lng: anchor.lng }}
      title={anchor.label}
      clickable={false}
      icon={{
        path: 'M 0 -8 L 8 0 L 0 8 L -8 0 Z',
        fillColor: MAP_CANVAS_ANCHOR_COLOR,
        fillOpacity: 1,
        strokeColor: MAP_CANVAS_SELECTED_COLOR,
        strokeWeight: 2,
        scale: 1,
      }}
    />
  )
}

/**
 * One pin. `useMarkerRef` gives a stable ref callback (an inline `ref={(m) => setState…}`
 * re-registers every render — null then marker — and loops React); the marker instance
 * is reported up through an effect, which only fires when the instance changes.
 */
function PinMarker({
  pin,
  selected,
  isMobile,
  onSelect,
  onReady,
}: {
  pin: MapCanvasPin
  selected: boolean
  isMobile: boolean
  onSelect: (id: string) => void
  onReady: (id: string, m: google.maps.Marker | null) => void
}) {
  const [markerRef, marker] = useMarkerRef()
  useEffect(() => {
    onReady(pin.id, marker)
    return () => onReady(pin.id, null)
  }, [pin.id, marker, onReady])
  return <Marker ref={markerRef} position={{ lat: pin.lat, lng: pin.lng }} icon={pinIcon(pin, selected, isMobile)} title={pin.title} onClick={() => onSelect(pin.id)} />
}

function Pins({ pins, selectedId, onSelect, renderPopup, isMobile }: Pick<PinsMapGoogleCanvasProps, 'pins' | 'selectedId' | 'onSelect' | 'renderPopup' | 'isMobile'>) {
  const [markers, setMarkers] = useState<Record<string, google.maps.Marker | null>>({})
  const onReady = useCallback((id: string, m: google.maps.Marker | null) => {
    setMarkers((prev) => (prev[id] === m ? prev : { ...prev, [id]: m }))
  }, [])
  const selected = useMemo(() => pins.find((p) => p.id === selectedId) ?? null, [pins, selectedId])
  return (
    <>
      {pins.map((p) => (
        <PinMarker key={p.id} pin={p} selected={p.id === selectedId} isMobile={isMobile} onSelect={onSelect} onReady={onReady} />
      ))}
      {!isMobile && renderPopup && selected && markers[selected.id] ? (
        <InfoWindow anchor={markers[selected.id]} onCloseClick={() => onSelect(null)} headerDisabled>
          {renderPopup(selected.id)}
        </InfoWindow>
      ) : null}
    </>
  )
}

/** Any exception inside the Google canvas → the card falls back rather than blanking. */
class GoogleCanvasBoundary extends Component<{ onUnavailable: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onUnavailable(`render: ${error.message}`)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function PinsMapGoogleCanvas(props: PinsMapGoogleCanvasProps) {
  const { apiKey, onUnavailable, pins, fitSignal, height, isMobile, anchor, fitPoints } = props
  const theme = useStampedTheme()
  const [loaded, setLoaded] = useState(false)
  const frameRef = useRef<HTMLDivElement | null>(null)
  // Paint watchdog: once the script has loaded, the map must materialise in the frame.
  useEffect(() => {
    if (!loaded) return
    const started = Date.now()
    const tick = window.setInterval(() => {
      if (frameRef.current?.querySelector('.gm-style')) {
        window.clearInterval(tick)
        return
      }
      if (Date.now() - started >= PAINT_TIMEOUT_MS) {
        window.clearInterval(tick)
        onUnavailable('render: the Maps API loaded but never painted a map (key rejected or blocked?)')
      }
    }, PAINT_POLL_MS)
    return () => window.clearInterval(tick)
  }, [loaded, onUnavailable])
  useEffect(() => {
    if (loaded) return
    const t = window.setTimeout(() => onUnavailable('timeout: Maps JavaScript API did not load'), LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [loaded, onUnavailable])
  // A rejected key (invalid, referrer-blocked, API not enabled, billing off) does NOT fail the
  // script load — the API paints a grey map and calls this global instead.
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void }
    const prev = w.gm_authFailure
    w.gm_authFailure = () => onUnavailable('auth: Google rejected the browser key for this page')
    return () => {
      w.gm_authFailure = prev
    }
  }, [onUnavailable])
  const first = pins[0] ?? anchor ?? null
  return (
    <GoogleCanvasBoundary onUnavailable={onUnavailable}>
      <div ref={frameRef} style={{ width: '100%', height }}>
        <APIProvider apiKey={apiKey} onLoad={() => setLoaded(true)} onError={(e) => onUnavailable(`load: ${e instanceof Error ? e.message : String(e)}`)}>
          <GoogleMap
            style={{ width: '100%', height }}
            defaultCenter={first ? { lat: first.lat, lng: first.lng } : { lat: 39.5, lng: -98.35 }}
            defaultZoom={first ? 12 : 4}
            colorScheme={googleColorSchemeForTheme(theme)}
            gestureHandling={isMobile ? 'cooperative' : 'greedy'}
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            onClick={() => props.onSelect(null)}
          >
            <FitToPoints points={mapCanvasFitPoints(pins, anchor, fitPoints)} fitSignal={fitSignal} />
            {anchor ? <AnchorLayer anchor={anchor} /> : null}
            <Pins pins={pins} selectedId={props.selectedId} onSelect={props.onSelect} renderPopup={props.renderPopup} isMobile={isMobile} />
          </GoogleMap>
        </APIProvider>
      </div>
    </GoogleCanvasBoundary>
  )
}
