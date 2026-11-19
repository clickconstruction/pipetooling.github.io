import type { CSSProperties } from 'react'
import type { MapLayerChoice } from '../../lib/map/googleMapType'
import { mapTimeButtonLabel } from '../../lib/map/mapTime'
import type { MapTime } from '../../hooks/useMapTime'

const press: CSSProperties = { border: 'none', padding: '0.35rem 0.55rem', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 700, background: 'var(--surface)', color: 'var(--text-strong)', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }
const pressOn: CSSProperties = { ...press, background: 'var(--text-strong)', color: 'var(--surface)' }
const box: CSSProperties = { display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)' }

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

/**
 * The presses a map wears in its top right corner (punch list #395): **Satellite** and **Streets**,
 * the map of today, and **Time**, the same place on earlier days.
 *
 * The two are one choice. While Time is on neither view is lit, and a press on either leaves Time
 * for that view. With a date on show the Time press reads it: `Time · Mar 2019`, and the date alone
 * on a phone, where the three sit beside the map's own zoom buttons.
 */
export function MapViewControl({ layer, onLayer, time, isMobile, satelliteLabel = 'Satellite', style }: { layer: MapLayerChoice; onLayer: (layer: MapLayerChoice) => void; time?: MapTime | null; isMobile: boolean; /** What this map calls its photograph: a painted map says *From above*. */ satelliteLabel?: string; style?: CSSProperties }) {
  const inTime = time?.on === true
  // A phone's presses are a finger tall: these sit on maps a crew reads on site.
  const tall: CSSProperties = isMobile ? { minHeight: 34 } : {}
  return (
    // Over the map's own controls (Leaflet's sit at 800 to 1000, Google's far lower), inside the map's own stacking box.
    <div data-map-view-control style={{ position: 'absolute', zIndex: 1001, right: 8, top: 8, display: 'flex', gap: 6, ...style }}>
      <div role="group" aria-label="Map view" style={box}>
        {(['satellite', 'streets'] as const).map((l) => (
          <button key={l} type="button" aria-pressed={!inTime && layer === l} onClick={() => onLayer(l)} style={{ ...(!inTime && layer === l ? pressOn : press), ...tall }}>
            {l === 'satellite' ? satelliteLabel : 'Streets'}
          </button>
        ))}
      </div>
      {time ? (
        <div style={box}>
          <button type="button" data-map-time-press aria-pressed={inTime} aria-expanded={inTime} onClick={time.toggle} style={{ ...(inTime ? pressOn : press), ...tall }}>
            <ClockIcon />
            {mapTimeButtonLabel(time.shown, isMobile)}
          </button>
        </div>
      ) : null}
    </div>
  )
}
