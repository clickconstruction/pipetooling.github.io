import { describe, expect, it } from 'vitest'
import { ledgerChargesFor, standingLookup } from './ledgerCharges'
import { chargeAdjustmentFromRow } from './adjustments'
import type { RateCard } from './rateCard'

const OWNER: RateCard = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const key = (n: string) => n.trim().toLowerCase()
const standingOf = standingLookup([{ id: 'u-t', name: 'Trace W', charge_standing: 'master' }, { id: 'u-z', name: 'Zack P', charge_standing: 'tech' }, { id: 'u-o', name: 'Office O', charge_standing: null }], key, new Map([['p-t', 'u-t']]))

describe("a Job Summary row's charges (punch list #254)", () => {
  const breakdown = [
    { personName: 'Trace W', personId: 'p-t', byWorkDate: [{ workDate: '2026-04-24', hours: 8 }, { workDate: '2026-04-27', hours: 8 }] },
    { personName: 'Zack P', personId: null, byWorkDate: [{ workDate: '2026-04-24', hours: 7.66 }, { workDate: '2026-04-25', hours: 9.44 }] },
    { personName: 'Office O', personId: null, byWorkDate: [{ workDate: '2026-04-24', hours: 8 }] },
  ]

  it("prices the row's crew-days from the breakdown and its materials from the sums, under the job's rule", () => {
    const r = ledgerChargesFor({ breakdown, standingOf, invoicesFromSupplyHouses: 9806.98, partsFromTally: 0, billedMaterialsSum: 100, card: OWNER, job: { charge_rule: 'shape', charge_shape: 'master_helper' }, contractUsd: 241431 })
    expect(r.days).toBe(3)
    expect(r.crewHours).toBe(25.44)
    expect(r.laborUsd).toBe(7250.4)
    expect(r.materialsUsd).toBe(12383.73)
    expect(r.chargesUsd).toBe(19634.13)
    expect(r.premium.kind).toBe('premium')
    expect(r.note).toBeNull()
    expect(r.rule).toEqual({ kind: 'shape', shape: 'master_helper' })
    expect(r.priced).toBe(true)
  })

  it('reads as not priced when nothing on the row could be: no labor or materials at all, or every day unpriced and no materials', () => {
    expect(ledgerChargesFor({ breakdown: [], standingOf, invoicesFromSupplyHouses: 0, partsFromTally: 0, billedMaterialsSum: 0, card: OWNER, job: {}, contractUsd: 220 }).priced).toBe(false)
    const empty = { rates: {}, extraPerson: null, materialsMarkupPct: null }
    expect(ledgerChargesFor({ breakdown, standingOf, invoicesFromSupplyHouses: 0, partsFromTally: 0, billedMaterialsSum: 0, card: empty, job: {}, contractUsd: 220 }).priced).toBe(false)
    expect(ledgerChargesFor({ breakdown, standingOf, invoicesFromSupplyHouses: 10, partsFromTally: 0, billedMaterialsSum: 0, card: empty, job: {}, contractUsd: 220 }).priced).toBe(true)
  })

  it('by the card alone, a day with only a master names the missing row, and a person not charged never counts', () => {
    const r = ledgerChargesFor({ breakdown, standingOf, invoicesFromSupplyHouses: 0, partsFromTally: 0, billedMaterialsSum: 0, card: OWNER, job: {}, contractUsd: 0 })
    expect(r.unpricedDays).toBe(1)
    expect(r.note).toBe('The rate card has no rate for master alone.')
    expect(r.laborUsd).toBe(2280 + 1746.4)
  })

  it('honors the adjustments: a day set to a shape, a day left off, a line left off and a line passed through by the cost each kept', () => {
    const adjustments = [
      chargeAdjustmentFromRow({ id: 'a1', job_id: 'j', kind: 'day_shape', target: '2026-04-25', shape: 'tech_alone', created_at: '2026-11-03T08:00:00Z' })!,
      chargeAdjustmentFromRow({ id: 'a2', job_id: 'j', kind: 'day_off', target: '2026-04-27', created_at: '2026-11-03T08:01:00Z' })!,
      chargeAdjustmentFromRow({ id: 'a3', job_id: 'j', kind: 'line_off', target: 'inv:1', amount: 100, created_at: '2026-11-03T08:02:00Z' })!,
      chargeAdjustmentFromRow({ id: 'a4', job_id: 'j', kind: 'line_pass_through', target: 'inv:2', amount: '1000', created_at: '2026-11-03T08:03:00Z' })!,
    ]
    const r = ledgerChargesFor({ breakdown, standingOf, invoicesFromSupplyHouses: 1100, partsFromTally: 0, billedMaterialsSum: 0, card: OWNER, job: { charge_rule: 'shape', charge_shape: 'master_helper' }, adjustments, contractUsd: 5000 })
    expect(r.days).toBe(2)
    expect(r.laborUsd).toBe(4026.4)
    expect(r.materialsUsd).toBe(1000)
    expect(r.chargesUsd).toBe(5026.4)
    expect(r.premium).toMatchObject({ kind: 'shortfall', amount: 26.4 })
  })

  it("the job's own markup wins, and with none set materials are at cost and the note says so", () => {
    const own = ledgerChargesFor({ breakdown: [], standingOf, invoicesFromSupplyHouses: 100, partsFromTally: 0, billedMaterialsSum: 0, card: OWNER, job: { materials_markup_pct: '50' }, contractUsd: 0 })
    expect(own.materialsUsd).toBe(150)
    const none = ledgerChargesFor({ breakdown: [], standingOf, invoicesFromSupplyHouses: 100, partsFromTally: 0, billedMaterialsSum: 0, card: { ...OWNER, materialsMarkupPct: null }, job: {}, contractUsd: 0 })
    expect(none.materialsUsd).toBe(100)
    expect(none.note).toBe('No markup on materials is set, so materials are at cost.')
  })
})
