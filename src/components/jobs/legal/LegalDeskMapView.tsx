import { useMemo, useState, type CSSProperties } from 'react'
import { assignmentsFromCountiesByFirm, countiesLine, firmHues, firmLegend, NO_FIRM_HUE } from '../../../lib/legal/firmCounties'
import { legendCounts, lensSummaryWords, STAND_COLOR, STAND_WORDS, uncoveredCounties, uncoveredWords, type LegalMapCase, type LegalMapStandOrNone } from '../../../lib/legal/firmMap'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'
import LegalFirmCountyMap from '../../settings/LegalFirmCountyMap'
import LegalCountyContentsCard from '../../settings/LegalCountyContentsCard'

/**
 * The Legal desk's **Map** (punch list #144, PR 3, v2.5784): the settled mock-up's frame 2. The
 * Texas counties colored by the firm that covers each, a dot per Collections account at its job's
 * geocode sized by its balance and colored by where it stands, the legend **Who covers what** with
 * each firm's counties, cases and dollars, and a flag over the map for cases in a county no firm
 * covers. Tap a county to list its cases on the card; tap a dot or a case to open the desk on it.
 * The drawing is the Settings picker's component in `lens` mode, the cases the desk's own
 * (`useLegalMapCases` in `LegalDesk`, which the venue rule reads too since v2.5792) — one
 * placement rule for the picker, the lens, the firm segment and the portal.
 */
const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const STANDS: LegalMapStandOrNone[] = ['eyes', 'firm', 'gave', 'none']

export default function LegalDeskMapView({ cases, loading, firms, countiesByFirm, onOpenCase, stacked = false }: {
  cases: ReadonlyArray<LegalMapCase>
  loading: boolean
  /** The active firms, as `useLegalMatters.activeFirms`. */
  firms: ReadonlyArray<LegalFirmRow>
  countiesByFirm: ReadonlyMap<string, ReadonlyArray<string>>
  /** A dot or a case pressed: the desk opens on that account under Accounts. */
  onOpenCase: (payerKey: string) => void
  /** A phone (the desk's stacked layout, v2.5984): one column, **Who covers what** under the map. Beside it, the map had 27 px. */
  stacked?: boolean
}) {
  const [county, setCounty] = useState<string | null>(null)
  const [heldId, setHeldId] = useState<string | null>(null)
  const firmNames = useMemo(() => new Map(firms.map((f) => [f.id, f.name] as const)), [firms])
  const assignments = useMemo(() => assignmentsFromCountiesByFirm(countiesByFirm), [countiesByFirm])
  const hues = useMemo(() => firmHues(firms), [firms])
  const legend = useMemo(() => firmLegend(firms, assignments), [firms, assignments])
  const counts = useMemo(() => legendCounts(cases, assignments, firms), [cases, assignments, firms])
  const offCounties = useMemo(() => uncoveredCounties(cases, assignments), [cases, assignments])
  const flag = uncoveredWords(cases, assignments)

  const pressCase = (c: LegalMapCase) => {
    setHeldId(c.id)
    setCounty(c.county)
  }
  const side: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)', fontSize: '0.8rem' }

  return (
    <div data-legal-map-view style={{ padding: stacked ? '12px 12px 24px' : '14px 18px 24px', overflowY: 'auto', minWidth: 0 }}>
      {flag ? <div data-legal-map-flag style={{ background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', marginBottom: 10 }}>{flag}</div> : null}
      <div data-legal-map-grid style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 280px', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div data-legal-map-summary style={{ ...MUTED, fontSize: '0.78rem', marginBottom: 4 }}>{loading && cases.length === 0 ? 'Placing the cases…' : lensSummaryWords(cases)}</div>
          <LegalFirmCountyMap
            lens
            assignments={assignments}
            hues={hues}
            firmNames={firmNames}
            legend={legend}
            pickedFirmId={null}
            cases={cases}
            heldCaseId={heldId}
            selectedCounty={county}
            onPress={(c) => { setHeldId(null); setCounty(c) }}
            onHoverCounty={() => {}}
            onPressCase={pressCase}
          />
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {STANDS.map((s) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: STAND_COLOR[s], display: 'inline-block' }} />
                {STAND_WORDS[s]}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div data-legal-map-legend style={side}>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.84rem' }}>Who covers what</h4>
            {counts.map((row) => {
              const hue = row.firmId ? hues.get(row.firmId) ?? NO_FIRM_HUE : NO_FIRM_HUE
              const counties = row.firmId ? countiesByFirm.get(row.firmId) ?? [] : offCounties
              if (!row.firmId && row.count === 0) return null
              return (
                <div key={row.firmId ?? 'none'} data-legal-map-legend-row={row.firmId ?? 'none'} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ minWidth: 0 }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: hue.fill, border: `1px solid ${hue.border}`, display: 'inline-block', verticalAlign: -1, marginRight: 6 }} />
                    {row.name}
                    <div style={{ ...MUTED, fontSize: '0.72rem' }}>{row.firmId ? countiesLine(counties) : counties.join(', ') || 'off the map'}</div>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <b>{row.count} {row.count === 1 ? 'case' : 'cases'}</b>
                    <div style={{ ...MUTED, fontSize: '0.72rem' }}>{row.moneyWords}</div>
                  </span>
                </div>
              )
            })}
            {firms.length === 0 ? <div style={{ ...MUTED, fontSize: '0.74rem' }}>No firm yet. Add one and color its counties under Firms.</div> : null}
          </div>
          <LegalCountyContentsCard lens county={county} cases={cases} assignments={assignments} firmNames={firmNames} heldId={heldId} onHold={pressCase} onOpen={(c) => onOpenCase(c.key)} />
        </div>
      </div>
    </div>
  )
}
