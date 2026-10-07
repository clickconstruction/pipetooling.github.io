import { useEffect, useRef } from 'react'
import { Polygon, Tooltip, useMap } from 'react-leaflet'
import type L from 'leaflet'
import type { CourtArea, CourtAreaPolygon } from '../../lib/legal/courtAreas'
import { polygonFromDrawn } from '../../lib/legal/courtAreasDraft'

/**
 * The court areas on the Map page's map (v2.4769). Draws every active area as a
 * tinted polygon with its name, and while the mode is on, takes the shape the
 * polygon tool draws and hands its GeoJSON up to be named. The drawn shape stays
 * on the map until it is saved or discarded (`clearSignal`).
 */
const COUNTY_TINTS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#4f46e5', '#65a30d']

function tintFor(county: string, counties: ReadonlyArray<string>): string {
  const i = counties.indexOf(county)
  return COUNTY_TINTS[(i < 0 ? 0 : i) % COUNTY_TINTS.length]!
}

/** Leaflet wants [lat, lng]; GeoJSON holds [lng, lat]. */
function toLatLngs(p: CourtAreaPolygon): L.LatLngExpression[][] | L.LatLngExpression[][][] {
  const ring = (r: number[][]) => r.map(([lng, lat]) => [lat, lng] as [number, number])
  return p.type === 'Polygon' ? p.coordinates.map(ring) : p.coordinates.map((poly) => poly.map(ring))
}

export function CourtAreasLayer({ areas, drawing, onDrawn, clearSignal }: {
  areas: ReadonlyArray<CourtArea>
  /** True while the office is in Court areas mode: a drawn polygon is a new area, not a filter. */
  drawing: boolean
  onDrawn: (polygon: CourtAreaPolygon) => void
  clearSignal: number
}) {
  const map = useMap()
  const pendingRef = useRef<L.Layer | null>(null)
  const counties = [...new Set(areas.map((a) => a.county))].sort()

  useEffect(() => {
    if (!drawing) return
    type MapWithPm = L.Map & { on: (t: string, h: (e: { layer: L.Layer }) => void) => L.Map; off: (t: string, h: (e: { layer: L.Layer }) => void) => L.Map }
    const onCreate = (ev: { layer: L.Layer }) => {
      const lr = ev.layer as L.Polygon
      const polygon = polygonFromDrawn(lr.toGeoJSON())
      if (!polygon) {
        map.removeLayer(lr)
        return
      }
      if (pendingRef.current) map.removeLayer(pendingRef.current)
      pendingRef.current = lr
      onDrawn(polygon)
    }
    ;(map as unknown as MapWithPm).on('pm:create', onCreate)
    return () => {
      ;(map as unknown as MapWithPm).off('pm:create', onCreate)
      if (pendingRef.current) {
        map.removeLayer(pendingRef.current)
        pendingRef.current = null
      }
    }
  }, [map, drawing, onDrawn])

  useEffect(() => {
    if (clearSignal === 0) return
    if (pendingRef.current) {
      map.removeLayer(pendingRef.current)
      pendingRef.current = null
    }
  }, [clearSignal, map])

  return (
    <>
      {areas.map((a) => {
        const c = tintFor(a.county, counties)
        return (
          <Polygon key={a.id} positions={toLatLngs(a.polygon)} pathOptions={{ color: c, weight: 1.5, fillColor: c, fillOpacity: 0.08, dashArray: a.source === 'imported' ? undefined : '4 3' }}>
            <Tooltip sticky>{a.county} · JP Pct {a.precinct}{a.label ? ` · ${a.label}` : ''}</Tooltip>
          </Polygon>
        )
      })}
    </>
  )
}
