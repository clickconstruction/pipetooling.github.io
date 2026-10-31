import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { VenueBlock } from '../../../lib/legal/legalParties'
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

export type LegalMapOpenOn = {
  county: string | null
  heldId: string | null
  /** A firm to light (punch list #222, PR 1): its legend row pressed, its counties in color, the other firms' faint. */
  firmId?: string | null
  nonce: number
}

export default function LegalDeskMapView({ cases, loading, firms, countiesByFirm, onOpenCase, stacked = false, openOn = null, venueFor }: {
  cases: ReadonlyArray<LegalMapCase>
  loading: boolean
  /** The active firms, as `useLegalMatters.activeFirms`. */
  firms: ReadonlyArray<LegalFirmRow>
  countiesByFirm: ReadonlyMap<string, ReadonlyArray<string>>
  /** A dot or a case pressed: the desk opens on that account under Accounts. */
  onOpenCase: (payerKey: string) => void
  /** A phone (the desk's stacked layout, v2.5984): one column, **Who covers what** under the map. Beside it, the map had 27 px. */
  stacked?: boolean
  /** The venue press (punch list #219, v2.6174): open on this county with this case held; a new `nonce` opens again. */
  openOn?: LegalMapOpenOn | null
  /** The held case's venue block for the county card, when the desk knows it (the selected account's). */
  venueFor?: (c: LegalMapCase) => VenueBlock | null
}) {
  const [county, setCounty] = useState<string | null>(openOn?.county ?? null)
  const [heldId, setHeldId] = useState<string | null>(openOn?.heldId ?? null)
  /** The lit firm (v2.6195): pressed on its legend row, or sent by the firm window's *Show on the desk map*. */
  const [litFirmId, setLitFirmId] = useState<string | null>(openOn?.firmId ?? null)
  useEffect(() => {
    if (!openOn) return
    setCounty(openOn.county)
    setHeldId(openOn.heldId)
    setLitFirmId(openOn.firmId ?? null)
  }, [openOn])
  const heldCase = useMemo(() => (heldId ? cases.find((c) => c.id === heldId) ?? null : null), [cases, heldId])
  const venue = heldCase && venueFor ? venueFor(heldCase) : null
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
            litFirmId={litFirmId}
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
              const lit = row.firmId != null && litFirmId === row.firmId
              const inner = (
                <>
                  <span style={{ minWidth: 0 }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: hue.fill, border: `1px solid ${hue.border}`, display: 'inline-block', verticalAlign: -1, marginRight: 6 }} />
                    {row.name}
                    <span style={{ ...MUTED, fontSize: '0.72rem', display: 'block' }}>{row.firmId ? countiesLine(counties) : counties.join(', ') || 'off the map'}</span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <b>{row.count} {row.count === 1 ? 'case' : 'cases'}</b>
                    <span style={{ ...MUTED, fontSize: '0.72rem', display: 'block' }}>{row.moneyWords}</span>
                  </span>
                </>
              )
              const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 4px', borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', background: lit ? 'var(--bg-subtle)' : 'transparent', borderLeft: 0, borderRight: 0, borderBottom: 0, borderRadius: 0 }
              // A firm's row is a press (v2.6195): lit, its counties keep their color and the other firms' go faint; press again to light every firm.
              return row.firmId ? (
                <button key={row.firmId} type="button" data-legal-map-legend-row={row.firmId} aria-pressed={lit} title={lit ? 'Light every firm again' : `Light ${row.name}’s counties alone`} onClick={() => setLitFirmId((cur) => (cur === row.firmId ? null : row.firmId))} style={{ ...rowStyle, cursor: 'pointer' }}>
                  {inner}
                </button>
              ) : (
                <div key="none" data-legal-map-legend-row="none" style={rowStyle}>
                  {inner}
                </div>
              )
            })}
            {firms.length === 0 ? <div style={{ ...MUTED, fontSize: '0.74rem' }}>No firm yet. Add one and color its counties under Firms.</div> : null}
          </div>
          <LegalCountyContentsCard lens county={county} cases={cases} assignments={assignments} firmNames={firmNames} heldId={heldId} onHold={pressCase} onOpen={(c) => onOpenCase(c.key)} venue={venue} />
        </div>
      </div>
    </div>
  )
}
