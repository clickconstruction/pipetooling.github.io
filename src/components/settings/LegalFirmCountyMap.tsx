import { useEffect, useState } from 'react'
import { NO_FIRM_HUE, countyWords, type CountyAssignments, type FirmHue, type FirmLegendRow } from '../../lib/legal/firmCounties'
import { loadTxCountyMap } from '../../lib/legal/txCountyMapIo'
import type { CountyMap } from '../../lib/legal/txCountyMap'

/**
 * The Texas county map on Settings → Collections law firms (punch list #144, PR 1,
 * v2.5756): every county as a path, filled with the hue of the firm that holds it in the
 * draft, gray when none. A click goes to the block (`onPress`), which owns the draft and
 * the rules (`firmCounties.ts`). Under the map, the county under the pointer and the
 * legend. Real county lines from `public/geo/tx-counties.json` (docs/TX_COUNTY_MAP.md).
 */
export default function LegalFirmCountyMap({ assignments, hues, firmNames, legend, pickedFirmId, onPress }: {
  assignments: CountyAssignments
  hues: ReadonlyMap<string, FirmHue>
  firmNames: ReadonlyMap<string, string>
  legend: ReadonlyArray<FirmLegendRow>
  pickedFirmId: string | null
  onPress: (county: string) => void
}) {
  const [map, setMap] = useState<CountyMap | null>(null)
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadTxCountyMap(600).then(
      (m) => {
        if (live) setMap(m)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])

  const holderOf = (county: string) => assignments.get(county) ?? null
  const hueOf = (county: string): FirmHue => {
    const holder = holderOf(county)
    return (holder && hues.get(holder)) || NO_FIRM_HUE
  }
  const readout = hovered ? `${countyWords(hovered)} · ${firmNames.get(holderOf(hovered) ?? '') ?? 'no firm yet'}` : pickedFirmId ? 'Click a county to color it for the picked firm. Click it again to clear it.' : 'Pick a firm on the left, then click counties.'

  return (
    <div data-legal-county-map>
      {failed ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>The county map did not load. Reload the page to try again.</p>
      ) : !map ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>Drawing the counties…</p>
      ) : (
        <svg
          viewBox={`0 0 ${map.width} ${map.height}`}
          role="img"
          aria-label="Texas counties by law firm"
          style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
          onMouseLeave={() => setHovered(null)}
        >
          {map.shapes.map((s) => {
            const hue = hueOf(s.name)
            const isHovered = hovered === s.name
            return (
              <path
                key={s.fips}
                d={s.d}
                data-county={s.name}
                data-firm={holderOf(s.name) ?? ''}
                fill={hue.fill}
                stroke={isHovered ? 'var(--text)' : 'var(--border-strong)'}
                strokeWidth={isHovered ? 1.6 : 0.6}
                strokeLinejoin="round"
                style={{ cursor: pickedFirmId ? 'pointer' : 'default', transition: 'fill 120ms' }}
                onMouseEnter={() => setHovered(s.name)}
                onFocus={() => setHovered(s.name)}
                onClick={() => onPress(s.name)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onPress(s.name)
                  }
                }}
              >
                <title>{`${countyWords(s.name)} · ${firmNames.get(holderOf(s.name) ?? '') ?? 'no firm yet'}`}</title>
              </path>
            )
          })}
        </svg>
      )}
      <div data-legal-county-readout style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6, minHeight: '1.2em' }}>{readout}</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontSize: '0.78rem' }}>
        {legend.map((row) => (
          <span key={row.firmId ?? 'none'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: row.hue.fill, border: `1px solid ${row.hue.border}`, display: 'inline-block' }} />
            {row.name}
          </span>
        ))}
      </div>
    </div>
  )
}
