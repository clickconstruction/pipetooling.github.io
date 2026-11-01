import type { CSSProperties } from 'react'
import { countyWords } from '../../../lib/legal/firmCounties'
import type { FirmForAccount } from '../../../lib/legal/firmForAccount'
import { feeModelOf, type LegalFirmRow } from '../../../lib/legal/legalMatters'
import { formatLegalMoney, quickNet } from '../../../lib/legal/legalPacket'

/**
 * Which firm takes the release, in the Mark attorney-ready sheet (punch list #222, PR 3, v2.6227). When more than one
 * firm could take the account — the first call of a shared county and the firms that also cover it, or the firms of
 * two venue counties — each is a choice with its role, its fee model and what Click keeps on it. The pick is the
 * header's switch (`firmOverride`), so the chip, the venue line and the release always name the same firm. Nothing
 * draws when one firm could take it.
 */
export default function LegalReleaseFirmChooser({ account, pickedId, balance, alsoByCounty, onPick }: {
  account: FirmForAccount<LegalFirmRow> | null
  /** The firm the release goes to now. */
  pickedId: string
  balance: number
  /** county → the firms that also cover it: a first call of a shared county reads `first call for`. */
  alsoByCounty: ReadonlyMap<string, ReadonlyArray<string>>
  onPick: (firmId: string) => void
}) {
  if (!account || account.kind !== 'covered' || account.others.length === 0) return null
  const options = [{ firm: account.firm, county: account.county, shared: false }, ...account.others]
  return (
    <div role="radiogroup" aria-label="Which firm takes it" data-legal-release-firms style={{ display: 'grid', gap: 6, margin: '0 0 10px' }}>
      {options.map((o) => {
        const on = o.firm.id === pickedId
        const sharedCounty = (alsoByCounty.get(o.county.county) ?? []).length > 0
        const role = o.shared ? `also covers ${countyWords(o.county.county)}` : sharedCounty ? `first call for ${countyWords(o.county.county)}` : `covers ${countyWords(o.county.county)}`
        const keeps = Math.max(0, quickNet(balance, feeModelOf(o.firm)))
        return (
          <label key={o.firm.id} data-legal-release-firm={o.firm.id} style={{ ...row, borderColor: on ? 'var(--border-strong)' : 'var(--border)', background: on ? 'var(--bg-subtle)' : 'transparent' }}>
            <input type="radio" name="legal-release-firm" checked={on} onChange={() => onPick(o.firm.id)} />
            <span style={{ minWidth: 0 }}>
              <b>{o.firm.name}</b>
              <span data-legal-release-firm-words style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {role} · {o.firm.contingency_pct}% · ${o.firm.filing_cost} filing · Click keeps ~{formatLegalMoney(keeps)}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 10px', borderWidth: 1, borderStyle: 'solid', borderRadius: 8, fontSize: '0.84rem', cursor: 'pointer' }
