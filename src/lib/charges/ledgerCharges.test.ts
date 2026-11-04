import { describe, expect, it } from 'vitest'
import { ledgerChargesFor, ledgerSummaryCell, loginLookup, standingLookup } from './ledgerCharges'
import { chargeAdjustmentFromRow } from './adjustments'
import type { RateCard } from './rateCard'

const OWNER: RateCard = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const key = (n: string) => n.trim().toLowerCase()
const standingOf = standingLookup([{ id: 'u-t', name: 'Toby W', charge_standing: 'master' }, { id: 'u-z', name: 'Zed P', charge_standing: 'tech' }, { id: 'u-o', name: 'Office O', charge_standing: null }], key, new Map([['p-t', 'u-t']]))

describe("a Job Summary row's charges (punch list #254)", () => {
  const breakdown = [
    { personName: 'Toby W', personId: 'p-t', byWorkDate: [{ workDate: '2026-04-24', hours: 8 }, { workDate: '2026-04-27', hours: 8 }] },
    { personName: 'Zed P', personId: null, byWorkDate: [{ workDate: '2026-04-24', hours: 7.66 }, { workDate: '2026-04-25', hours: 9.44 }] },
    { personName: 'Office O', personId: null, byWorkDate: [{ workDate: '2026-04-24', hours: 8 }] },
  ]

  it("prices the row's crew-days from the breakdown and its materials from the sums, under the job's rule", () => {
    const r = ledgerChargesFor({ breakdown, standingOf, invoicesFromSupplyHouses: 4806.98, partsFromTally: 0, billedMaterialsSum: 100, card: OWNER, job: { charge_rule: 'shape', charge_shape: 'master_helper' }, contractUsd: 250000 })
    expect(r.days).toBe(3)
    expect(r.crewHours).toBe(25.44)
    expect(r.laborUsd).toBe(7250.4)
    expect(r.materialsUsd).toBe(6133.73)
    expect(r.chargesUsd).toBe(13384.13)
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

describe('a row whose crew counts as nobody (punch list #254, the live pass)', () => {
  it("names who counts as nobody and where to set it, in place of the paper's neutral line", () => {
    const nobody = standingLookup([{ id: 'u-t', name: 'Toby W', charge_standing: null }], (n: string) => n.trim().toLowerCase(), new Map())
    const r = ledgerChargesFor({
      breakdown: [{ personName: 'Toby W', personId: null, byWorkDate: [{ workDate: '2026-03-02', hours: 8 }, { workDate: '2026-03-03', hours: 8 }] }],
      standingOf: nobody,
      invoicesFromSupplyHouses: 0,
      partsFromTally: 0,
      billedMaterialsSum: 0,
      card: { rates: { master_helper: 285 }, extraPerson: null, materialsMarkupPct: null },
      job: { charge_rule: 'shape', charge_shape: 'master_helper' },
      contractUsd: 250000,
    })
    expect(r.priced).toBe(false)
    expect(r.uncharged).toEqual(['Toby'])
    expect(r.note).toBe('Toby counts as nobody on the rate card yet. Set Charged as in Settings → Rates charged by crew → Who counts as what, or on each person’s desk.')
    // Nothing priced: both cells are a dash.
    expect(ledgerSummaryCell(r)).toEqual({ chargesUsd: null, premiumUsd: null, note: r.note })
  })

  it('a standings read that fails leaves the cells unpriced with its reason, never the nobody note (v2.6484)', () => {
    // The page's list is empty after a failed read, so every lookup answers none; the reason says the read failed.
    const unread = standingLookup([], key, new Map())
    const r = ledgerChargesFor({
      breakdown: [{ personName: 'Toby W', personId: null, byWorkDate: [{ workDate: '2026-03-02', hours: 8 }, { workDate: '2026-03-03', hours: 8 }] }],
      standingOf: unread,
      invoicesFromSupplyHouses: 0,
      partsFromTally: 0,
      billedMaterialsSum: 0,
      card: OWNER,
      job: { charge_rule: 'shape', charge_shape: 'master_helper' },
      contractUsd: 250000,
      standingsUnread: 'permission denied for table users',
    })
    expect(r.priced).toBe(false)
    expect(r.uncharged).toEqual([])
    expect(r.unchargedDays).toBe(0)
    expect(r.unpricedDays).toBe(2)
    expect(r.note).toBe('Who counts as what could not be read, so nothing is priced yet: permission denied for table users')
    expect(r.note).not.toContain('counts as nobody')
    expect(ledgerSummaryCell(r)).toEqual({ chargesUsd: null, premiumUsd: null, note: r.note })
    // The same row with the read answered names who counts as nobody, as before.
    expect(ledgerChargesFor({ breakdown: [{ personName: 'Toby W', personId: null, byWorkDate: [{ workDate: '2026-03-02', hours: 8 }] }], standingOf: unread, invoicesFromSupplyHouses: 0, partsFromTally: 0, billedMaterialsSum: 0, card: OWNER, job: {}, contractUsd: 0, standingsUnread: null }).note).toContain('counts as nobody')
  })

  it('reaches a standing through the People record’s link when the two names differ, names people as their login, and someone with no login apart', () => {
    // The crew rows name people by their People record: "Zed W" is linked to the login "Zedd", "Bo R" to the login
    // "Bobby" (who left, with no standing yet), and "Ana Q" has no login.
    const users = [{ id: 'u-z', name: 'Zedd', charge_standing: 'tech' }, { id: 'u-b', name: 'Bobby', charge_standing: null }]
    const links = new Map([['p-z', 'u-z'], ['p-b', 'u-b']])
    const r = ledgerChargesFor({
      breakdown: [
        { personName: 'Zed W', personId: 'p-z', byWorkDate: [{ workDate: '2026-03-02', hours: 8 }] },
        { personName: 'Ana Q', personId: 'p-a', byWorkDate: [{ workDate: '2026-03-03', hours: 6 }] },
        { personName: 'Bo R', personId: 'p-b', byWorkDate: [{ workDate: '2026-03-04', hours: 5 }] },
      ],
      standingOf: standingLookup(users, key, links),
      loginOf: loginLookup(users, key, links),
      invoicesFromSupplyHouses: 1000,
      partsFromTally: 0,
      billedMaterialsSum: 0,
      card: OWNER,
      job: {},
      contractUsd: 5000,
    })
    // Zed W prices as a tech alone through the link; Bo R and Ana Q's days price at nothing and the premium waits for them.
    expect(r.laborUsd).toBe(1480)
    expect(r.unpricedDays).toBe(2)
    expect(r.note).toBe('Bobby counts as nobody on the rate card yet. Set Charged as in Settings → Rates charged by crew → Who counts as what, or on each person’s desk. Ana has no login for a Charged as. Link the People record to a login on People.')
    expect(ledgerSummaryCell(r)).toEqual({ chargesUsd: r.chargesUsd, premiumUsd: null, note: r.note })
    expect(loginLookup(users, key, links)('Zed W', 'p-z')).toEqual({ id: 'u-z', name: 'Zedd' })
    expect(loginLookup(users, key, links)('zedd', null)).toEqual({ id: 'u-z', name: 'Zedd' })
    expect(loginLookup(users, key, links)('Ana Q', 'p-a')).toBeNull()
  })

  it('shows the premium once every day prices', () => {
    const r = ledgerChargesFor({
      breakdown: [{ personName: 'Toby W', personId: 'p-t', byWorkDate: [{ workDate: '2026-03-02', hours: 8 }] }],
      standingOf,
      invoicesFromSupplyHouses: 0,
      partsFromTally: 0,
      billedMaterialsSum: 0,
      card: OWNER,
      job: { charge_rule: 'shape', charge_shape: 'master_helper' },
      contractUsd: 5000,
    })
    expect(r.unpricedDays).toBe(0)
    expect(ledgerSummaryCell(r)).toEqual({ chargesUsd: 2280, premiumUsd: 2720, note: null })
  })
})
