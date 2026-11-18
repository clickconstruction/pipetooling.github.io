import { TileLayer } from 'react-leaflet'
import PinsMapCanvas, { type PinsMapCanvasProps } from './PinsMapCanvas'
import type { MapLayerChoice } from '../../lib/map/googleMapType'

/** A view from above other than today's: one release of the photo archive (v2.7693). */
export type PinsMapImagery = { url: string; attribution: string }

export type PinsMapImageryCanvasProps = PinsMapCanvasProps & { layer: MapLayerChoice; imagery?: PinsMapImagery | null }

const TODAY: PinsMapImagery = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery &copy; Esri, Vantor, Earthstar Geographics, and the GIS User Community',
}

/**
 * The app's shared Leaflet canvas with a view from above laid over its streets when asked (punch
 * list #328, PR 4, as `TaskPlacesMapCanvas`; shared since #395). One file and one lazy load for the
 * two, on purpose: a layer that loads lazily inside a map that is already up suspends the map, and
 * Leaflet refuses to start twice in one box ("Map container is already initialized").
 *
 * Since v2.7693 the view from above may be an older one: `imagery` names a release of the photo
 * archive and it is drawn in place of today's. The layer is keyed by its address, so a new date is
 * a new layer and the old tiles do not linger under it.
 *
 * It is the canvas every map with a Time press draws on while Time is on (`PinsMapFrame`), and the
 * fall back of the Google canvas when a card has a Satellite / Streets switch. More Leaflet layers
 * (the Map page's tools) go in as children, over the photograph.
 */
export default function PinsMapImageryCanvas({ layer, imagery, children, ...canvas }: PinsMapImageryCanvasProps) {
  const from = imagery ?? TODAY
  return (
    <PinsMapCanvas {...canvas}>
      {layer === 'satellite' ? <TileLayer key={from.url} url={from.url} attribution={from.attribution} maxNativeZoom={19} maxZoom={19} /> : null}
      {children}
    </PinsMapCanvas>
  )
}
