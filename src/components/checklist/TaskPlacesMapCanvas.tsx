import { TileLayer } from 'react-leaflet'
import PinsMapCanvas, { type PinsMapCanvasProps } from '../map/PinsMapCanvas'

type Props = Omit<PinsMapCanvasProps, 'children'> & { layer: 'satellite' | 'streets' }

/**
 * The canvas of Where my tasks are (punch list #328, PR 4): the app's shared canvas, with the box
 * map's view from above laid over its streets when asked. One file and one lazy load for the two,
 * on purpose: a layer that loads lazily inside a map that is already up suspends the map, and
 * Leaflet refuses to start twice in one box ("Map container is already initialized").
 */
export default function TaskPlacesMapCanvas({ layer, ...canvas }: Props) {
  return (
    <PinsMapCanvas {...canvas}>
      {layer === 'satellite' ? (
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
          maxNativeZoom={19}
          maxZoom={19}
        />
      ) : null}
    </PinsMapCanvas>
  )
}
