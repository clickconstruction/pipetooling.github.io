import { describe, expect, it } from 'vitest'
import { buildJobCharges } from './jobCharges'
import type { CrewSessionInput } from './crewDays'
import type { RateCard } from './rateCard'
import { chargeAdjustmentFromRow } from './adjustments'

const OWNER: RateCard = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const s = (userId: string, name: string, standing: CrewSessionInput['standing'], workDate: string, hours: number): CrewSessionInput => ({ userId, name, standing, workDate, hours })

describe("a job's charges, whole (punch list #254)", () => {
  const sessions = [s('t', 'Toby', 'master', '2026-04-24', 8), s('z', 'Zed', 'tech', '2026-04-24', 7.66), s('z', 'Zed', 'tech', '2026-04-25', 9.44)]
  const lines = [
    { id: 'inv-1', kind: 'supply_invoice' as const, label: 'A supply house · invoice 1001', dateKey: '2026-04-16', cost: 1896.67 },
    { id: 'inv-2', kind: 'supply_invoice' as const, label: 'A rental yard · invoice 2002', dateKey: '2026-04-01', cost: 1323.08 },
  ]

  it("prices the record under the job's rule and reads the stand against the price", () => {
    const r = buildJobCharges({ sessions, lines, card: OWNER, rule: { kind: 'shape', shape: 'master_helper' }, revenue: 10000 })
    expect(r.totals).toEqual({ labor: 4970.4, materials: 4024.69, charges: 8995.09, crewHours: 17.44, personHours: 25.1, days: 2, unpricedDays: 0, unchargedDays: 0 })
    expect(r.premium).toMatchObject({ kind: 'premium', amount: 1004.91 })
    expect(r.record.totals).toEqual(r.totals)
    expect(r.weeks).toHaveLength(1)
    expect(r.adjustmentsCount).toBe(0)
    expect(r.notes).toEqual([])
  })

  it('carries the days a standing would fix apart from every unpriced day, so the callout and the premium count their own (v2.6484)', () => {
    // One day everyone is Not charged, three days a master alone with no master_alone rate on the card.
    const r = buildJobCharges({
      sessions: [s('o', 'Office', 'none', '2026-02-02', 8), s('t', 'Toby', 'master', '2026-02-03', 8), s('t', 'Toby', 'master', '2026-02-04', 8), s('t', 'Toby', 'master', '2026-02-05', 8)],
      lines: [],
      card: OWNER,
      revenue: 5000,
    })
    expect(r.totals.unpricedDays).toBe(4)
    expect(r.totals.unchargedDays).toBe(1)
    expect(r.record.totals.unchargedDays).toBe(1)
    expect(r.uncharged).toEqual([{ userId: 'o', name: 'Office', days: 1 }])
    expect(r.notes).toEqual(['Nobody out that day is charged to a customer.', 'The rate card has no rate for master alone.'])
  })

  it('lays the adjustments on top and keeps the record beside them', () => {
    const adjustments = [
      chargeAdjustmentFromRow({ id: 'a1', job_id: 'j', kind: 'day_shape', target: '2026-04-25', shape: 'tech_alone', reason: 'Zed was alone', created_at: '2026-11-03T08:00:00Z' })!,
      chargeAdjustmentFromRow({ id: 'a2', job_id: 'j', kind: 'line_pass_through', target: 'inv-2', reason: 'a rental', created_at: '2026-11-03T08:01:00Z' })!,
    ]
    const r = buildJobCharges({ sessions, lines, card: OWNER, rule: { kind: 'shape', shape: 'master_helper' }, adjustments, revenue: 10000 })
    expect(r.days[1]).toMatchObject({ workDate: '2026-04-25', pricedShape: 'tech_alone', charged: 1746.4, adjusted: true })
    expect(r.materials.lines[1]).toMatchObject({ id: 'inv-2', charged: 1323.08, passedThrough: true })
    expect(r.totals.charges).toBe(7720.32)
    expect(r.record.totals.charges).toBe(8995.09)
    expect(r.premium.kind).toBe('premium')
    expect(r.adjustmentsCount).toBe(2)
  })

  it('names what it cannot price, once each: a missing rate-card row and no markup', () => {
    const r = buildJobCharges({ sessions: [s('t', 'Toby', 'master', '2026-04-24', 8), s('t', 'Toby', 'master', '2026-04-27', 8)], lines, card: { ...OWNER, materialsMarkupPct: null }, revenue: 0 })
    expect(r.totals.unpricedDays).toBe(2)
    expect(r.notes).toEqual(['The rate card has no rate for master alone.', 'No markup on materials is set, so every material line is at cost.'])
    expect(r.totals.materials).toBe(3219.75)
    expect(r.premium.kind).toBe('shortfall')
  })

  it("the job's own markup wins over the card's", () => {
    const r = buildJobCharges({ sessions: [], lines: [{ id: 'l', kind: 'typed_charge', label: 'Pipe', dateKey: null, cost: 100 }], card: OWNER, markupPct: 50, revenue: 0 })
    expect(r.totals.materials).toBe(150)
  })
})
