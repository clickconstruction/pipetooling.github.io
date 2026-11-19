/**
 * The popup body of the Dashboard "Your jobs on a map" card (v2.3131): label, status chip, address,
 * stage / last report, Open job / Directions. On a phone the popup is skipped and the card shows the
 * selected job as a bar under the map.
 *
 * It was the body inside the card's two canvas adapters. Since punch list #395 the card draws in
 * the shared `PinsMapFrame`, which holds both canvases, so the adapters are gone and this is what
 * the card hands the frame for a pin.
 */
import {
  DASHBOARD_JOBS_MAP_STATUS_COLOR,
  DASHBOARD_JOBS_MAP_STATUS_LABEL,
  dashboardJobsMapDetailLine,
  type DashboardJobsMapPin,
} from '../../lib/dashboardJobsMap'

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
