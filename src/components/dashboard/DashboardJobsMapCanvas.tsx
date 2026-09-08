/**
 * The Leaflet half of the Dashboard "Your jobs on a map" card (v2.3131).
 *
 * Since v2.3162 the drawing lives in the shared `PinsMapCanvas` (the Bid Board
 * map uses the same one); this file turns job pins into canvas pins in the
 * Jobs status colors and renders the popup body — label, status chip, address,
 * stage / last report, Open job / Directions. On a phone the popup is skipped:
 * the card shows the selected job as a bar under the map.
 *
 * Lazy-loaded by `DashboardJobsMapCard` so Leaflet stays out of the Dashboard bundle.
 */
import { useCallback, useMemo } from 'react'
import PinsMapCanvas from '../map/PinsMapCanvas'
import {
  DASHBOARD_JOBS_MAP_STATUS_COLOR,
  DASHBOARD_JOBS_MAP_STATUS_LABEL,
  dashboardJobsMapCanvasPins,
  dashboardJobsMapDetailLine,
  type DashboardJobsMapPin,
} from '../../lib/dashboardJobsMap'

export type DashboardJobsMapCanvasProps = {
  pins: DashboardJobsMapPin[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenJob: (pin: DashboardJobsMapPin) => void
  onDirections: (pin: DashboardJobsMapPin) => void
  /** Bumped by the card's Fit all button. */
  fitSignal: number
  height: number
  /** Phone form: no popup; the card renders the selected bar. */
  isMobile: boolean
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

/** The popup / info-window body — shared by the Leaflet and Google adapters. */
export function DashboardJobsMapPopupBody({
  pin,
  onOpenJob,
  onDirections,
}: {
  pin: DashboardJobsMapPin
  onOpenJob: (pin: DashboardJobsMapPin) => void
  onDirections: (pin: DashboardJobsMapPin) => void
}) {
  const c = DASHBOARD_JOBS_MAP_STATUS_COLOR[pin.status]
  const detail = dashboardJobsMapDetailLine(pin)
  return (
    <div
      style={{
        fontSize: '0.8125rem',
        lineHeight: 1.4,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 200,
        color: 'var(--text-base)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{pin.label}</div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: c,
            border: `1px solid ${c}`,
            borderRadius: 999,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {DASHBOARD_JOBS_MAP_STATUS_LABEL[pin.status]}
        </span>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>{pin.address}</div>
      {detail ? <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{detail}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button type="button" onClick={() => onOpenJob(pin)} style={POPUP_BUTTON_STYLE}>
          Open job
        </button>
        <button type="button" onClick={() => onDirections(pin)} style={POPUP_BUTTON_STYLE}>
          Directions
        </button>
      </div>
    </div>
  )
}

export default function DashboardJobsMapCanvas({ pins, selectedId, onSelect, onOpenJob, onDirections, fitSignal, height, isMobile }: DashboardJobsMapCanvasProps) {
  const canvasPins = useMemo(() => dashboardJobsMapCanvasPins(pins), [pins])
  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins])
  const renderPopup = useCallback(
    (id: string) => {
      const p = byId.get(id)
      return p ? <DashboardJobsMapPopupBody pin={p} onOpenJob={onOpenJob} onDirections={onDirections} /> : null
    },
    [byId, onOpenJob, onDirections],
  )
  return <PinsMapCanvas pins={canvasPins} selectedId={selectedId} onSelect={onSelect} renderPopup={renderPopup} fitSignal={fitSignal} height={height} isMobile={isMobile} />
}
