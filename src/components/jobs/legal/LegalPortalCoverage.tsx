import { useMemo, useState, type CSSProperties } from 'react'
import { assignmentsFromCountiesByFirm, countiesLine, countyWords, firmHues, firmLegend, NO_FIRM_HUE } from '../../../lib/legal/firmCounties'
import { coverageCountWords, coverageMatterWords, type FirmCoverage } from '../../../lib/legal/legalFirmCoverage'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED } from '../../../lib/portal/portalTheme'
import { portalSmall } from '../../../lib/legal/legalPortalCards'
import LegalFirmCountyMap from '../../settings/LegalFirmCountyMap'

/**
 * **Who covers what** on the firm's portal (punch list #144, PR 4): the Texas county map
 * colored by the firm that covers each county — the Settings picker's component in `lens`
 * mode, the same drawing the office's desk reads — with each firm's counties and open-matter
 * count beside it, and a tapped county's case count on the card. Counts only, the to-do's
 * blocker: counsel has not yet answered what one firm may see of another's cases, so no case
 * names, no dollars and no detail of another firm's matters reach this page. The reading
 * firm's own matters stay under Matters, as today.
 */
const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }
const cap: CSSProperties = { fontSize: portalSmall(11), color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }

export default function LegalPortalCoverage({ coverage, firmId }: {
  coverage: FirmCoverage
  /** The reading firm (`payload.firm.id`), marked "your firm" on its row. */
  firmId: string
}) {
  const [county, setCounty] = useState<string | null>(null)
  const firmLikes = useMemo(() => coverage.firms.map((f) => ({ id: f.id, name: f.name, active: true, created_at: f.createdAt })), [coverage.firms])
  const assignments = useMemo(() => assignmentsFromCountiesByFirm(new Map(coverage.firms.map((f) => [f.id, f.counties]))), [coverage.firms])
  const hues = useMemo(() => firmHues(firmLikes), [firmLikes])
  const legend = useMemo(() => firmLegend(firmLikes, assignments), [firmLikes, assignments])
  const firmNames = useMemo(() => new Map(coverage.firms.map((f) => [f.id, f.name] as const)), [coverage.firms])

  const holder = county ? assignments.get(county) ?? null : null
  const countyCount = county ? coverage.countyCounts[county] ?? 0 : 0

  return (
    <div data-legal-coverage style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ ...card, flex: '1 1 340px', minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>
          Each county is colored for the firm that covers it. New matters there go to that firm.
        </div>
        <LegalFirmCountyMap
          lens
          assignments={assignments}
          hues={hues}
          firmNames={firmNames}
          legend={legend}
          pickedFirmId={null}
          cases={[]}
          heldCaseId={null}
          selectedCounty={county}
          onPress={setCounty}
          onHoverCounty={() => {}}
          onPressCase={() => {}}
          idleWords="Tap a county for its case count."
        />
      </div>
      <div style={{ display: 'grid', gap: 10, flex: '1 1 260px', maxWidth: 360 }}>
        <div data-legal-coverage-firms style={card}>
          <div style={cap}>Who covers what</div>
          {coverage.firms.map((f) => {
            const hue = hues.get(f.id) ?? NO_FIRM_HUE
            return (
              <div key={f.id} data-legal-coverage-firm={f.id} style={{ padding: '7px 0', borderBottom: `1px solid ${HAIR}` }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: hue.fill, border: `1px solid ${hue.border}`, display: 'inline-block', verticalAlign: -1, marginRight: 6 }} />
                  {f.name}
                  {f.id === firmId ? <span style={{ color: COPPER, fontWeight: 700 }}> · your firm</span> : null}
                </div>
                <div style={{ fontSize: portalSmall(11.5), color: MUTED }}>{countiesLine(f.counties)}</div>
                <div style={{ fontSize: portalSmall(11.5), color: MUTED }}>{coverageMatterWords(f.matterCount)}</div>
              </div>
            )
          })}
          {coverage.firms.length === 0 ? <div style={{ fontSize: 12.5, color: MUTED }}>No firms yet.</div> : null}
          <div style={{ fontSize: portalSmall(11), color: FAINT, marginTop: 8 }}>Counts only. Another firm’s case names and amounts stay with that firm.</div>
        </div>
        <div data-legal-coverage-county style={card}>
          <div style={cap}>County</div>
          {county ? (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, marginTop: 4 }}>{countyWords(county)}</div>
              <div style={{ fontSize: 12.5, color: MUTED }}>{holder ? `Covered by ${firmNames.get(holder) ?? 'a firm'}` : 'No firm covers it yet'}</div>
              <div data-legal-coverage-count style={{ fontSize: 12.5, color: INK, marginTop: 2 }}>{coverageCountWords(countyCount)}</div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>Tap a county on the map for its case count.</div>
          )}
        </div>
      </div>
    </div>
  )
}
