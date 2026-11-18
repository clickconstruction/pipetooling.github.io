import { TileLayer } from 'react-leaflet'
import PinsMapCanvas, { type PinsMapCanvasProps } from '../map/PinsMapCanvas'

/** A view from above other than today's: one release of the photo archive (v2.7693). */
export type TaskPlacesImagery = { url: string; attribution: string }

type Props = Omit<PinsMapCanvasProps, 'children'> & { layer: 'satellite' | 'streets'; imagery?: TaskPlacesImagery | null }

const TODAY: TaskPlacesImagery = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
}

/**
 * The canvas of Where my tasks are (punch list #328, PR 4): the app's shared canvas, with the box
 * map's view from above laid over its streets when asked. One file and one lazy load for the two,
 * on purpose: a layer that loads lazily inside a map that is already up suspends the map, and
 * Leaflet refuses to start twice in one box ("Map container is already initialized").
 *
 * Since v2.7693 the view from above may be an older one: `imagery` names a release of the photo
 * archive and it is drawn in place of today's. The layer is keyed by its address, so a new date is
 * a new layer and the old tiles do not linger under it.
 */
export default function TaskPlacesMapCanvas({ layer, imagery, ...canvas }: Props) {
  const from = imagery ?? TODAY
  return (
    <PinsMapCanvas {...canvas}>
      {layer === 'satellite' ? <TileLayer key={from.url} url={from.url} attribution={from.attribution} maxNativeZoom={19} maxZoom={19} /> : null}
    </PinsMapCanvas>
  )
}
