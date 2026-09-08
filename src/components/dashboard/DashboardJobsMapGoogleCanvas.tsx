/**
 * Google Maps half of the Dashboard "Your jobs on a map" card (v2.3145).
 *
 * Mounted by `DashboardJobsMapCard` only when `VITE_GOOGLE_MAPS_BROWSER_KEY` is
 * configured; lazy so the Maps loader stays out of the Dashboard bundle. The
 * same props as the Leaflet canvas plus `onUnavailable`, which the card treats
 * as "fall back to OpenStreetMap for the rest of this page": the API failed to
 * load (bad key, blocked referrer, network), took longer than the timeout, or
 * threw while rendering. Circle markers in the Jobs status colors, a desktop
 * info window with Open job / Directions, fit-to-all, and Google's native dark
 * color scheme following the app's `<html data-theme>` stamp.
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
import {
  DASHBOARD_JOBS_MAP_STATUS_COLOR,
  DASHBOARD_JOBS_MAP_STATUS_LABEL,
  dashboardJobsMapBounds,
  dashboardJobsMapDetailLine,
  googleColorSchemeForTheme,
  type DashboardJobsMapPin,
} from '../../lib/dashboardJobsMap'
import type { DashboardJobsMapCanvasProps } from './DashboardJobsMapCanvas'

export type DashboardJobsMapGoogleCanvasProps = DashboardJobsMapCanvasProps & {
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
    typeof document === 'undefined'
      ? null
      : (document.documentElement.dataset.theme ?? null),
  )
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const obs = new MutationObserver(() =>
      setTheme(document.documentElement.dataset.theme ?? null),
    )
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => obs.disconnect()
  }, [])
  return theme
}

function FitToPins({
  pins,
  fitSignal,
}: {
  pins: DashboardJobsMapPin[]
  fitSignal: number
}) {
  const map = useMap()
  const b = dashboardJobsMapBounds(pins)
  const key = b ? `${b.south},${b.west},${b.north},${b.east}` : ''
  useEffect(() => {
    if (!map || !b) return
    const bounds = new google.maps.LatLngBounds(
      { lat: b.south, lng: b.west },
      { lat: b.north, lng: b.east },
    )
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

const POPUP_BUTTON_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '0.35rem 0.75rem',
  fontSize: '0.875rem',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function pinIcon(
  p: DashboardJobsMapPin,
  selected: boolean,
  isMobile: boolean,
): google.maps.Symbol {
  const c = DASHBOARD_JOBS_MAP_STATUS_COLOR[p.status]
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: selected ? 10 : isMobile ? 9 : 8,
    fillColor: c,
    fillOpacity: selected ? 0.9 : 0.8,
    strokeColor: selected ? '#1d4ed8' : c,
    strokeWeight: selected ? 2 : 1,
  }
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
  pin: DashboardJobsMapPin
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
  return (
    <Marker
      ref={markerRef}
      position={{ lat: pin.lat, lng: pin.lng }}
      icon={pinIcon(pin, selected, isMobile)}
      title={pin.label}
      onClick={() => onSelect(pin.id)}
    />
  )
}

function Pins({
  pins,
  selectedId,
  onSelect,
  onOpenJob,
  onDirections,
  isMobile,
}: Omit<
  DashboardJobsMapGoogleCanvasProps,
  'apiKey' | 'onUnavailable' | 'fitSignal' | 'height'
>) {
  const [markers, setMarkers] = useState<
    Record<string, google.maps.Marker | null>
  >({})
  const onReady = useCallback((id: string, m: google.maps.Marker | null) => {
    setMarkers((prev) => (prev[id] === m ? prev : { ...prev, [id]: m }))
  }, [])
  const selected = useMemo(
    () => pins.find((p) => p.id === selectedId) ?? null,
    [pins, selectedId],
  )
  return (
    <>
      {pins.map((p) => (
        <PinMarker
          key={p.id}
          pin={p}
          selected={p.id === selectedId}
          isMobile={isMobile}
          onSelect={onSelect}
          onReady={onReady}
        />
      ))}
      {!isMobile && selected && markers[selected.id] ? (
        <InfoWindow
          anchor={markers[selected.id]}
          onCloseClick={() => onSelect(null)}
          headerDisabled
        >
          <div
            style={{
              fontSize: '0.8125rem',
              lineHeight: 1.4,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minWidth: 200,
              color: 'var(--text-base)',
              fontFamily:
                'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                {selected.label}
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: DASHBOARD_JOBS_MAP_STATUS_COLOR[selected.status],
                  border: `1px solid ${DASHBOARD_JOBS_MAP_STATUS_COLOR[selected.status]}`,
                  borderRadius: 999,
                  padding: '1px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {DASHBOARD_JOBS_MAP_STATUS_LABEL[selected.status]}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>{selected.address}</div>
            {dashboardJobsMapDetailLine(selected) ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {dashboardJobsMapDetailLine(selected)}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button
                type="button"
                onClick={() => onOpenJob(selected)}
                style={POPUP_BUTTON_STYLE}
              >
                Open job
              </button>
              <button
                type="button"
                onClick={() => onDirections(selected)}
                style={POPUP_BUTTON_STYLE}
              >
                Directions
              </button>
            </div>
          </div>
        </InfoWindow>
      ) : null}
    </>
  )
}

/** Any exception inside the Google canvas → the card falls back rather than blanking. */
class GoogleCanvasBoundary extends Component<
  { onUnavailable: (reason: string) => void; children: ReactNode },
  { failed: boolean }
> {
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

export default function DashboardJobsMapGoogleCanvas(
  props: DashboardJobsMapGoogleCanvasProps,
) {
  const { apiKey, onUnavailable, pins, fitSignal, height, isMobile } = props
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
        onUnavailable(
          'render: the Maps API loaded but never painted a map (key rejected or blocked?)',
        )
      }
    }, PAINT_POLL_MS)
    return () => window.clearInterval(tick)
  }, [loaded, onUnavailable])
  useEffect(() => {
    if (loaded) return
    const t = window.setTimeout(
      () => onUnavailable('timeout: Maps JavaScript API did not load'),
      LOAD_TIMEOUT_MS,
    )
    return () => window.clearTimeout(t)
  }, [loaded, onUnavailable])
  // A rejected key (invalid, referrer-blocked, API not enabled, billing off) does NOT fail the
  // script load — the API paints a grey map and calls this global instead.
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void }
    const prev = w.gm_authFailure
    w.gm_authFailure = () =>
      onUnavailable('auth: Google rejected the browser key for this page')
    return () => {
      w.gm_authFailure = prev
    }
  }, [onUnavailable])
  const first = pins[0]
  return (
    <GoogleCanvasBoundary onUnavailable={onUnavailable}>
      <div ref={frameRef} style={{ width: '100%', height }}>
        <APIProvider
          apiKey={apiKey}
          onLoad={() => setLoaded(true)}
          onError={(e) =>
            onUnavailable(`load: ${e instanceof Error ? e.message : String(e)}`)
          }
        >
          <GoogleMap
            style={{ width: '100%', height }}
            defaultCenter={
              first
                ? { lat: first.lat, lng: first.lng }
                : { lat: 39.5, lng: -98.35 }
            }
            defaultZoom={first ? 12 : 4}
            colorScheme={googleColorSchemeForTheme(theme)}
            gestureHandling={isMobile ? 'cooperative' : 'greedy'}
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            onClick={() => props.onSelect(null)}
          >
            <FitToPins pins={pins} fitSignal={fitSignal} />
            <Pins {...props} />
          </GoogleMap>
        </APIProvider>
      </div>
    </GoogleCanvasBoundary>
  )
}
