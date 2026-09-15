/**
 * The picked quote lines as the row kernel's picks (Submittals stage 2b):
 * across the latest quote of every house, one PickInput per fixture — a kit
 * reads its `kit` line for the label and any line of the cell for the
 * estimator's reason, lead time and status override (they are written to
 * every line of the cell together). The first house to have picked a fixture
 * wins; the compare never leaves two houses picked on one row.
 */
import type { PickInput } from './buildSubmittalRows'
import { asReason } from './submittalRevision'
import type { StatusOverride } from './productStatus'

export type RawPickLine = {
  id: string
  fixture: string
  label: string | null
  picked: boolean
  cant_supply: boolean
  component_role?: string | null
  alternate_reason_kind?: string | null
  alternate_reason_note?: string | null
  lead_time_days?: number | null
  product_status_override?: string | null
}
export type RawQuote = { id: string; supply_house_id: string | null; received_at: string; supply_house: { name: string } | Array<{ name: string }> | null; bid_quote_lines: RawPickLine[] | null }

export const PICK_COLS_ANNOTATED = 'id, fixture, label, picked, cant_supply, component_role, alternate_reason_kind, alternate_reason_note, lead_time_days, product_status_override'
export const PICK_COLS_BASE = 'id, fixture, label, picked, cant_supply, component_role'

export const fixtureKey = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

export function picksFromQuotes(quotes: ReadonlyArray<RawQuote>): { picks: PickInput[]; overridesByFixture: Map<string, StatusOverride> } {
  const latest = new Map<string, RawQuote>()
  for (const q of [...quotes].filter((q) => q.supply_house_id).sort((a, b) => a.received_at.localeCompare(b.received_at))) latest.set(q.supply_house_id as string, q)
  const picks: PickInput[] = []
  const seen = new Set<string>()
  const overridesByFixture = new Map<string, StatusOverride>()
  for (const q of latest.values()) {
    const house = Array.isArray(q.supply_house) ? q.supply_house[0] : q.supply_house
    const byFixture = new Map<string, RawPickLine[]>()
    for (const l of q.bid_quote_lines ?? []) {
      if (!l.picked || l.cant_supply) continue
      const k = fixtureKey(l.fixture)
      byFixture.set(k, [...(byFixture.get(k) ?? []), l])
    }
    for (const [k, lines] of byFixture) {
      if (seen.has(k)) continue
      seen.add(k)
      const line = lines.find((l) => l.component_role === 'kit') ?? lines.find((l) => l.label) ?? lines[0]
      if (!line) continue
      const withAnnotation = lines.find((l) => l.alternate_reason_kind || l.lead_time_days != null || l.product_status_override) ?? line
      picks.push({
        fixture: line.fixture,
        supplyHouseId: q.supply_house_id,
        houseName: house?.name ?? null,
        quoteLineId: line.id,
        label: line.label ?? null,
        alternateReasonKind: asReason(withAnnotation.alternate_reason_kind),
        alternateReasonNote: withAnnotation.alternate_reason_note ?? null,
        leadTimeDays: withAnnotation.lead_time_days ?? null,
      })
      const ov = withAnnotation.product_status_override
      overridesByFixture.set(k, ov === 'superseded' || ov === 'equal' || ov === 'design_change' ? ov : null)
    }
  }
  return { picks, overridesByFixture }
}
