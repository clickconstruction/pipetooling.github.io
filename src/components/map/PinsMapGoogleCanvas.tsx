/**
 * Google Maps pins canvas (v2.3162) — the Maps JavaScript API half shared by
 * the Dashboard "Your jobs on a map" card and the Bid Board "Bids on a map"
 * card. Same props as `PinsMapCanvas` plus `apiKey` and `onUnavailable`,
 * which the card treats as "fall back to OpenStreetMap for the rest of this
 * page": the API failed to load (bad key, blocked referrer, network), took
 * longer than the timeout, never painted while its frame was in the window,
 * or threw while rendering.
 *
 * Circle markers in the caller's colors (a ring color becomes a thick stroke),
 * a desktop info window whose body the caller renders, an optional anchor
 * diamond with distance rings, fit-to-all, and Google's native dark color
 * scheme following the app's `<html data-theme>` stamp. Since v2.7686 a card
 * with a Satellite / Streets switch passes `mapTypeId`; a card that passes none
 * draws the road map as before. Lazy-load this file.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  APIProvider,
  ControlPosition,
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
import { clusterBounds, clusterLabel, clusterPins, clusterRadiusPx, type PinCluster } from '../../lib/map/clusterPins'
import { pinLabelInkHex } from '../../lib/map/pinLabelInk'
import { GOOGLE_MAP_STYLES } from '../../lib/map/googleMapLook'
import { googleMapTypeIsImagery, type GoogleMapTypeId } from '../../lib/map/googleMapType'
import { mapPulseTarget } from '../../lib/map/pulseTarget'
import { googleScrollwheelOption } from '../../lib/map/scrollZoomGate'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useGoogleCanvasDoors, useStampedTheme } from '../../hooks/useGoogleCanvasDoors'
import { GoogleCanvasBoundary } from './GoogleCanvasBoundary'
import { MapLoadingLine } from './MapLoadingLine'

export type PinsMapGoogleCanvasProps = PinsMapCanvasProps & {
  apiKey: string
  /** The API could not be used on this page — the card switches to OpenStreetMap. */
  onUnavailable: (reason: string) => void
  /** v2.7686: the base map, for a card with a Satellite / Streets switch. Omitted, the map is the road map. */
  mapTypeId?: GoogleMapTypeId
  /**
   * v2.8032: the zoom buttons at the top left, where the Leaflet canvas has its own, for a map that
   * keeps its bottom right for a press of its own (the frame's switch between the two maps).
   * Omitted, they sit where Google puts them, at the bottom right.
   */
  zoomAtTopLeft?: boolean
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
  // v2.3756: a badged pin (the clocked-in map's head count) is a size up so the text fits.
  const scale = p.label ? (selected ? 12 : 11) : selected ? 10 : isMobile ? 9 : 8
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
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
  return (
    <Marker
      ref={markerRef}
      position={{ lat: pin.lat, lng: pin.lng }}
      icon={pinIcon(pin, selected, isMobile)}
      label={pin.label ? { text: pin.label, color: pinLabelInkHex(pin.color), fontWeight: '800', fontSize: '11px' } : undefined}
      title={pin.title}
      onClick={() => onSelect(pin.id)}
    />
  )
}

/** One cluster disc (v2.3213): the count over the majority color, an urgent ring when a member has one; click zooms to its members. */
function ClusterMarker({ cluster, noun }: { cluster: PinCluster<MapCanvasPin>; noun: string }) {
  const map = useMap()
  const r = clusterRadiusPx(cluster.count)
  return (
    <Marker
      position={{ lat: cluster.lat, lng: cluster.lng }}
      title={`${cluster.count} ${noun} here — click to zoom in`}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: r,
        fillColor: cluster.color,
        fillOpacity: 0.92,
        strokeColor: cluster.ringColor ?? '#ffffff',
        strokeWeight: cluster.ringColor ? 4 : 2,
      }}
      label={{ text: clusterLabel(cluster.count), color: pinLabelInkHex(cluster.color), fontWeight: '700', fontSize: r >= 18 ? '13px' : '11px' }}
      onClick={() => {
        if (!map) return
        const b = clusterBounds(cluster)
        map.fitBounds(new google.maps.LatLngBounds({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east }), 40)
        const once = google.maps.event.addListenerOnce(map, 'idle', () => {
          const z = map.getZoom()
          if (z != null && z > 17) map.setZoom(17)
        })
        void once
      }}
    />
  )
}

/** Follows the map's zoom so the cluster grid re-buckets as the person zooms. */
function useMapZoom(enabled: boolean): number {
  const map = useMap()
  const [zoom, setZoom] = useState<number>(12)
  useEffect(() => {
    if (!map || !enabled) return
    const read = () => {
      const z = map.getZoom()
      if (z != null) setZoom(z)
    }
    read()
    const l = map.addListener('zoom_changed', read)
    return () => google.maps.event.removeListener(l)
  }, [map, enabled])
  return zoom
}

function Pins({ pins, selectedId, onSelect, renderPopup, isMobile, cluster = false, clusterRingPriority, pulseId, clusterNoun = 'bids' }: Pick<PinsMapGoogleCanvasProps, 'pins' | 'selectedId' | 'onSelect' | 'renderPopup' | 'isMobile' | 'cluster' | 'clusterRingPriority' | 'pulseId' | 'clusterNoun'>) {
  const [markers, setMarkers] = useState<Record<string, google.maps.Marker | null>>({})
  const onReady = useCallback((id: string, m: google.maps.Marker | null) => {
    setMarkers((prev) => (prev[id] === m ? prev : { ...prev, [id]: m }))
  }, [])
  const zoom = useMapZoom(cluster)
  const items = useMemo(() => (cluster ? clusterPins(pins, zoom, { ringPriority: clusterRingPriority }) : null), [cluster, pins, zoom, clusterRingPriority])
  const singlePins = items ? items.flatMap((i) => (i.kind === 'pin' ? [i.pin] : [])) : pins
  const clusters = items ? items.flatMap((i) => (i.kind === 'cluster' ? [i.cluster] : [])) : []
  const selected = useMemo(() => singlePins.find((p) => p.id === selectedId) ?? null, [singlePins, selectedId])
  const pulse = mapPulseTarget(pins, items, pulseId)
  return (
    <>
      {pulse ? (
        // Symbol markers cannot animate, so the Google halo is a steady wide ring in the pin's color.
        <Marker
          key={`pulse-${pulse.markId}`}
          position={{ lat: pulse.lat, lng: pulse.lng }}
          clickable={false}
          zIndex={0}
          icon={{ path: google.maps.SymbolPath.CIRCLE, scale: pulse.radiusPx, fillOpacity: 0, strokeColor: pulse.color, strokeWeight: 3, strokeOpacity: 0.85 }}
        />
      ) : null}
      {clusters.map((c) => (
        <ClusterMarker key={c.id} cluster={c} noun={clusterNoun} />
      ))}
      {singlePins.map((p) => (
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

export default function PinsMapGoogleCanvas(props: PinsMapGoogleCanvasProps) {
  const { apiKey, onUnavailable, pins, fitSignal, height, isMobile, anchor, fitPoints, mapTypeId, zoomAtTopLeft = false } = props
  const theme = useStampedTheme()
  const [loaded, setLoaded] = useState(false)
  const frameRef = useRef<HTMLDivElement | null>(null)
  // The doors to OpenStreetMap that are not the loader's own: the load timeout, Google's word that
  // the key is rejected, and the paint clock, which runs only while the frame is in the window.
  useGoogleCanvasDoors({ frameRef, loaded, onUnavailable })
  const first = pins[0] ?? anchor ?? null
  // The wheel gate: the capture phase sees a press anywhere in the frame — the map, a pin, the + / − buttons.
  const [mapClicked, setMapClicked] = useState(false)
  const gated = props.scrollZoomAfterClick === true
  const scrollwheel = googleScrollwheelOption({ isMobile, afterClick: gated, clicked: mapClicked })
  return (
    <GoogleCanvasBoundary onUnavailable={onUnavailable}>
      <div ref={frameRef} style={{ position: 'relative', width: '100%', height }} onPointerDownCapture={gated && !mapClicked ? () => setMapClicked(true) : undefined}>
        {/* Until the script is in, the library draws an empty div. On a slow connection that can last the whole
            load timeout, so the frame says what it is doing, in the words the frame used before this canvas came. */}
        {loaded ? null : <MapLoadingLine />}
        <APIProvider apiKey={apiKey} onLoad={() => setLoaded(true)} onError={(e) => onUnavailable(`load: ${formatErrorMessage(e)}`)}>
          <GoogleMap
            style={{ width: '100%', height }}
            defaultCenter={first ? { lat: first.lat, lng: first.lng } : { lat: 39.5, lng: -98.35 }}
            defaultZoom={first ? 12 : 4}
            colorScheme={googleColorSchemeForTheme(theme)}
            gestureHandling={isMobile ? 'cooperative' : 'greedy'}
            // Spread, so a map without the gate never sends the option at all
            {...(scrollwheel === undefined ? {} : { scrollwheel })}
            // Spread, so a card with no switch sends no map type. A photograph is held flat: Google tilts to its 45° view when zoomed in, and a dot would sit off its spot
            {...(mapTypeId ? { mapTypeId, ...(googleMapTypeIsImagery(mapTypeId) ? { tilt: 0 } : {}) } : {})}
            disableDefaultUI
            zoomControl
            // Spread, so a map that leaves the buttons where Google puts them never sends the option at all
            {...(zoomAtTopLeft ? { zoomControlOptions: { position: ControlPosition.LEFT_TOP } } : {})}
            clickableIcons={false}
            styles={GOOGLE_MAP_STYLES}
            onClick={() => props.onSelect(null)}
          >
            <FitToPoints points={mapCanvasFitPoints(pins, anchor, fitPoints)} fitSignal={fitSignal} />
            {anchor ? <AnchorLayer anchor={anchor} /> : null}
            <Pins pins={pins} selectedId={props.selectedId} onSelect={props.onSelect} renderPopup={props.renderPopup} isMobile={isMobile} cluster={props.cluster} clusterRingPriority={props.clusterRingPriority} pulseId={props.pulseId} clusterNoun={props.clusterNoun} />
          </GoogleMap>
        </APIProvider>
      </div>
    </GoogleCanvasBoundary>
  )
}
