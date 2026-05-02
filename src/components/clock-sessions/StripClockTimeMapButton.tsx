import type { CSSProperties, ReactNode } from 'react'
import { openGoogleMapsAt } from '../../lib/ipGeolocationMaps'

function mapTitleForSource(source: string | null | undefined): string {
  if (source === 'ip') {
    return 'Approximate location from IP (opens Google Maps)'
  }
  return 'View location in Google Maps'
}

function ariaLabelForKind(kind: 'in' | 'out', source: string | null | undefined): string {
  const edge = kind === 'in' ? 'Clock-in' : 'Clock-out'
  if (source === 'ip') {
    return `Open approximate ${edge.toLowerCase()} location from IP in Google Maps`
  }
  return `Open ${edge.toLowerCase()} location in Google Maps`
}

/** Clock strip: clickable time that opens Google Maps when lat/lng exist; otherwise plain text (no link styling). */
export function StripClockTimeMapButton({
  children,
  lat,
  lng,
  locationSource = null,
  baseStyle,
  kind,
}: {
  children: ReactNode
  lat: number | null
  lng: number | null
  locationSource?: string | null
  baseStyle: CSSProperties
  kind: 'in' | 'out'
}) {
  const has = lat != null && lng != null
  if (!has) {
    return <span style={baseStyle}>{children}</span>
  }
  return (
    <button
      type="button"
      className="stripClockTimeMapButton"
      title={mapTitleForSource(locationSource)}
      aria-label={ariaLabelForKind(kind, locationSource)}
      onClick={() => {
        openGoogleMapsAt(lat, lng)
      }}
      style={{
        ...baseStyle,
        border: 'none',
        background: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      {children}
    </button>
  )
}
