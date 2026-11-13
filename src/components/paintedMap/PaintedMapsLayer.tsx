/**
 * Painted maps drawn on another Leaflet map (punch list #345, PR 6): the Map page, and under the
 * boxes on Materials on site's map. A child of a react-leaflet `MapContainer`. A press on a line
 * or a dot opens that painted map.
 */
import { Fragment } from 'react'
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import { lineRuns } from '../../lib/paintedMap/paintedLine'
import type { PaintedLayerMap } from '../../lib/paintedMap/paintedMapLayer'
import { PAINT_COLOR } from './paintedMapLook'

/** A map's own ink, the same in both themes: the picture under it does not change with the theme. */
const CASING = '#ffffff'
const DOT_RING = '#111827'

type Props = {
  maps: ReadonlyArray<PaintedLayerMap>
  onOpen?: (mapId: string) => void
  /** Thinner strokes and smaller dots, for a map that is mostly about something else. */
  quiet?: boolean
}

export function PaintedMapsLayer({ maps, onOpen, quiet = false }: Props) {
  const weight = quiet ? 4 : 5
  return (
    <>
      {maps.map((m) => {
        const handlers = onOpen ? { click: () => onOpen(m.id) } : undefined
        return (
          <Fragment key={m.id}>
            {m.lines.map((line) => {
              const runs = lineRuns(line.points, line.poorParts)
              return (
                <Fragment key={line.id}>
                  {runs.sure.map((run, i) => (
                    <Fragment key={`s${i}`}>
                      {/* A white casing under the paint, so the line reads over a roof and over a field. */}
                      <Polyline positions={run.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: CASING, weight: weight + 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
                      <Polyline positions={run.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: PAINT_COLOR, weight, lineCap: 'round', lineJoin: 'round' }} eventHandlers={handlers}>
                        <Tooltip sticky>{m.tip}</Tooltip>
                      </Polyline>
                    </Fragment>
                  ))}
                  {runs.poor.map((run, i) => (
                    <Polyline key={`p${i}`} positions={run.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: PAINT_COLOR, weight, dashArray: '2 12', lineCap: 'round' }} eventHandlers={handlers}>
                      <Tooltip sticky>{m.tip}</Tooltip>
                    </Polyline>
                  ))}
                </Fragment>
              )
            })}
            {m.places.map((p) => (
              <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={quiet ? 6 : 8} pathOptions={{ color: DOT_RING, weight: 2, fillColor: CASING, fillOpacity: 1 }} eventHandlers={handlers}>
                <Tooltip direction="top" offset={[0, -6]}>{`${p.number}. ${p.name} · ${m.name}`}</Tooltip>
              </CircleMarker>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}
