import { Suspense, lazy, useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { Layers } from 'lucide-react'
import { useMapTime } from '../../hooks/useMapTime'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { googleKeyRefusedOnPage } from '../../lib/map/googleAuthFailure'
import { googleMapTypeForLayer, type MapLayerChoice } from '../../lib/map/googleMapType'
import {
  MAP_CORNER_PRESS_BOTTOM_PX,
  MAP_CORNER_PRESS_SIDE_PX,
  MAP_CORNER_PRESS_SIZE_PX,
  mapProviderSwitch,
  readMapProviderPick,
  resolvePickedMapProvider,
  writeMapProviderPick,
  type MapProviderPick,
} from '../../lib/map/mapProviderPick'
import { mapTimeSpotFromPins, type MapTimeSpot } from '../../lib/map/mapTime'
import { OLDER_PHOTOS_VIEW_ZOOM } from '../../lib/map/olderPhotos'
import { MapTimeRow } from './MapTimeRow'
import { MapViewControl } from './MapViewControl'
import type { PinsMapCanvasProps } from './PinsMapCanvas'

const PinsMapImageryCanvasLazy = lazy(() => import('./PinsMapImageryCanvas'))
const PinsMapGoogleCanvasLazy = lazy(() => import('./PinsMapGoogleCanvas'))

export type PinsMapFrameProps = PinsMapCanvasProps & {
  /** A short name for this map, for the console's one line when Google fails and for the retry panel: `team tasks map`. */
  surface: string
  /** The view the map opens on. A press on Satellite or Streets is kept for the visit, in the frame. */
  defaultLayer?: MapLayerChoice
  /** A map that never draws on Google: its tools are Leaflet's own (the Map page), or it has no reason to (a person's tasks). */
  leafletOnly?: boolean
  /**
   * A map with its own switch between Google Maps and the OpenStreetMap map: the name this device keeps
   * the person's pick under. The switch is an icon at the map's bottom right, and Google's zoom buttons
   * move to the top left, where the other map's are, so the corner is free and the two maps read alike.
   */
  providerSwitchKey?: string
  /** A map with no Time press. */
  noTime?: boolean
  /** The place Time looks at when it is not a dot: the screen's own place. It wins over the dots. */
  timeSpot?: MapTimeSpot | null
  /** What on the map is not from the photograph's day, said beside a date: `The pins are today’s.` */
  timeDotsWords?: string
  /** A card's own press on the map, laid in the map's box beside the frame's: My tasks' Show where I am. */
  overlay?: ReactNode
  /** More styles for the map's own box: its corners, its border. */
  boxStyle?: CSSProperties
  style?: CSSProperties
}

/**
 * The frame every map of dots draws in (punch list #395): the provider rule, the Satellite and
 * Streets switch, the **Time** press and its row. A card hands it dots and a height and writes none
 * of those itself.
 *
 * - **Today.** Google Maps when the browser key is set and the API loads, Satellite as Google's
 *   photograph with street names. With no key, or once Google fails on this page, the shared Leaflet
 *   canvas, with Esri's view from above over its streets for Satellite. The failure is kept for the
 *   page, so a rejected key never flickers between the two maps.
 * - **Time.** The archive is Esri's, and Google's terms keep another provider's map off and away
 *   from a Google map. So while Time is on the Google canvas is down and the map is the Leaflet
 *   canvas, framed close on one spot, with today's photograph or an older one. Flipping between
 *   Today and a date changes one tile layer and nothing else. A pin opens no popup while Time is
 *   on: the popup would cover the ground the person came to see.
 *
 * - **The switch.** A card that hands `providerSwitchKey` lets the person pick between the two maps
 *   of today (`mapProviderPick.ts`): an icon at the bottom right, kept on the device, never offered
 *   when the page can draw one map alone, and waiting while Time is on. A card that hands none is
 *   as it was.
 *
 * Time's state lives in `useMapTime`, here, so it ends when the map leaves the screen: another tab,
 * a closed window, a card's own Hide map.
 */
export function PinsMapFrame({ surface, defaultLayer = 'streets', leafletOnly = false, providerSwitchKey, noTime = false, timeSpot, timeDotsWords, overlay, boxStyle, style, children, ...canvas }: PinsMapFrameProps) {
  const { pins, selectedId, height, isMobile } = canvas
  const [layerPick, setLayerPick] = useState<MapLayerChoice | null>(null)
  // A key Google refused earlier on this page is refused for this map too: it opens on the other map at once.
  const [googleFailed, setGoogleFailed] = useState(() => googleKeyRefusedOnPage())
  const layer = layerPick ?? defaultLayer
  const [providerPick, setProviderPick] = useState<MapProviderPick | null>(() => (providerSwitchKey ? readMapProviderPick(providerSwitchKey) : null))
  const key = googleMapsBrowserKey()
  const hasSwitch = !leafletOnly && providerSwitchKey != null
  const provider = leafletOnly ? 'osm' : hasSwitch ? resolvePickedMapProvider({ key, googleFailed, pick: providerPick }) : resolveDashboardMapProvider({ key, googleFailed })
  const googleUnavailable = useCallback(
    (reason: string) => {
      console.warn(`[${surface}] Google Maps unavailable, using OpenStreetMap: ${reason}`)
      setGoogleFailed(true)
    },
    [surface],
  )

  const time = useMapTime(noTime ? null : timeSpot !== undefined ? timeSpot : mapTimeSpotFromPins(pins, selectedId))
  const { off: timeOff } = time
  const pickLayer = useCallback(
    (next: MapLayerChoice) => {
      timeOff()
      setLayerPick(next)
    },
    [timeOff],
  )
  // Time with no spot yet leaves the map as it is: the row asks for a dot.
  const inTime = time.frame != null
  const onLeaflet = inTime || provider !== 'google'
  const shownLayer: MapLayerChoice = inTime ? 'satellite' : layer
  const providerPress = hasSwitch ? mapProviderSwitch({ key, googleFailed, provider, inTime }) : null
  const pickProvider = (to: MapProviderPick) => {
    setProviderPick(to)
    if (providerSwitchKey) writeMapProviderPick(providerSwitchKey, to)
  }

  return (
    <div data-map-frame style={{ minWidth: 0, ...style }}>
      <div
        data-map-provider={inTime ? 'archive' : provider}
        className={onLeaflet && shownLayer === 'satellite' ? 'mapImagery' : undefined}
        style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', background: 'var(--bg-muted)', height, ...boxStyle }}
      >
        <Suspense fallback={<div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading map…</div>}>
          {onLeaflet ? (
            <PinsMapImageryCanvasLazy
              key={isMobile ? 'phone' : 'desk'}
              {...canvas}
              layer={shownLayer}
              imagery={inTime ? time.imagery : null}
              // The photograph is what Time is for, and a pin's popup would sit on the middle of it. The row names the place.
              renderPopup={inTime ? undefined : canvas.renderPopup}
              fitPoints={inTime ? time.frame : canvas.fitPoints}
              fitMaxZoom={inTime ? OLDER_PHOTOS_VIEW_ZOOM : canvas.fitMaxZoom}
            >
              {children}
            </PinsMapImageryCanvasLazy>
          ) : (
            <PinsMapGoogleCanvasLazy key={isMobile ? 'phone' : 'desk'} {...canvas} apiKey={key} onUnavailable={googleUnavailable} mapTypeId={googleMapTypeForLayer(layer)} zoomAtTopLeft={hasSwitch} />
          )}
        </Suspense>
        <MapViewControl layer={layer} onLayer={pickLayer} time={noTime ? null : time} isMobile={isMobile} />
        {overlay}
        {providerPress ? (
          <button
            type="button"
            data-map-provider-switch={providerPress.to}
            aria-label={providerPress.label}
            title={providerPress.label}
            onClick={() => pickProvider(providerPress.to)}
            // Over the map's own controls (Leaflet's sit at 800 to 1000), inside the map's own stacking box.
            style={{ position: 'absolute', zIndex: 1001, right: MAP_CORNER_PRESS_SIDE_PX, bottom: MAP_CORNER_PRESS_BOTTOM_PX, width: MAP_CORNER_PRESS_SIZE_PX, height: MAP_CORNER_PRESS_SIZE_PX, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
          >
            <Layers size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {noTime ? null : <MapTimeRow time={time} isMobile={isMobile} surface={surface} dotsWords={timeDotsWords} />}
    </div>
  )
}
