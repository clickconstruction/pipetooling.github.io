/**
 * Google Maps half of the Dashboard "Your jobs on a map" card (v2.3145).
 *
 * Mounted by `DashboardJobsMapCard` only when `VITE_GOOGLE_MAPS_BROWSER_KEY` is
 * configured; lazy so the Maps loader stays out of the Dashboard bundle. Since
 * v2.3162 the API handling — load / timeout / auth / paint watchdogs, the
 * render boundary, the theme-following color scheme — lives in the shared
 * `PinsMapGoogleCanvas`; this file maps job pins into it and renders the same
 * popup body as the Leaflet adapter. `onUnavailable` is the card's cue to fall
 * back to OpenStreetMap for the rest of the page.
 */
import { useCallback, useMemo } from 'react'
import PinsMapGoogleCanvas from '../map/PinsMapGoogleCanvas'
import { dashboardJobsMapCanvasPins } from '../../lib/dashboardJobsMap'
import { DashboardJobsMapPopupBody, type DashboardJobsMapCanvasProps } from './DashboardJobsMapCanvas'

export type DashboardJobsMapGoogleCanvasProps = DashboardJobsMapCanvasProps & {
  apiKey: string
  /** The API could not be used on this page — the card switches to OpenStreetMap. */
  onUnavailable: (reason: string) => void
}

export default function DashboardJobsMapGoogleCanvas({ pins, selectedId, onSelect, onOpenJob, onDirections, fitSignal, height, isMobile, apiKey, onUnavailable }: DashboardJobsMapGoogleCanvasProps) {
  const canvasPins = useMemo(() => dashboardJobsMapCanvasPins(pins), [pins])
  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins])
  const renderPopup = useCallback(
    (id: string) => {
      const p = byId.get(id)
      return p ? <DashboardJobsMapPopupBody pin={p} onOpenJob={onOpenJob} onDirections={onDirections} /> : null
    },
    [byId, onOpenJob, onDirections],
  )
  return (
    <PinsMapGoogleCanvas
      apiKey={apiKey}
      onUnavailable={onUnavailable}
      pins={canvasPins}
      selectedId={selectedId}
      onSelect={onSelect}
      renderPopup={renderPopup}
      fitSignal={fitSignal}
      height={height}
      isMobile={isMobile}
    />
  )
}
