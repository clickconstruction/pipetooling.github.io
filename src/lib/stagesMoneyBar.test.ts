import { describe, expect, it } from 'vitest'
import { buildStagesMoneyBarModel } from './stagesMoneyBar'

describe('buildStagesMoneyBarModel', () => {
  it('mid-job: paid + unbilled segments and owed remainder', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 41550, paymentsMade: 16620, pctComplete: 70 })
    expect(m.hasBar).toBe(true)
    expect(m.total).toBe(41550)
    expect(m.paid).toBe(16620)
    expect(m.valueCreated).toBeCloseTo(29085)
    expect(m.unbilled).toBeCloseTo(12465)
    expect(m.owed).toBeCloseTo(24930)
    expect(m.overpaid).toBe(false)
    expect(m.paidFrac).toBeCloseTo(0.4, 2)
    expect(m.unbilledFrac).toBeCloseTo(0.3, 2)
  })

  it('no pct reported: bar is paid vs track, unbilled unknown', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 250, pctComplete: null })
    expect(m.hasBar).toBe(true)
    expect(m.valueCreated).toBeNull()
    expect(m.unbilled).toBeNull()
    expect(m.paidFrac).toBeCloseTo(0.25)
    expect(m.unbilledFrac).toBe(0)
    expect(m.owed).toBe(750)
  })

  it('no total bill: no bar, zeroed fractions', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 0, paymentsMade: 0, pctComplete: 50 })
    expect(m.hasBar).toBe(false)
    expect(m.paidFrac).toBe(0)
    expect(m.unbilledFrac).toBe(0)
    expect(m.valueCreated).toBe(0)
    expect(m.owed).toBe(0)
  })

  it('null inputs behave as zero / unknown', () => {
    const m = buildStagesMoneyBarModel({ totalBill: null, paymentsMade: null, pctComplete: null })
    expect(m.hasBar).toBe(false)
    expect(m.paid).toBe(0)
    expect(m.valueCreated).toBeNull()
  })

  it('overpaid: green clamps to full bar, owed goes negative, flag set', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 1200, pctComplete: 100 })
    expect(m.overpaid).toBe(true)
    expect(m.paidFrac).toBe(1)
    expect(m.unbilledFrac).toBe(0)
    expect(m.owed).toBe(-200)
    expect(m.unbilled).toBe(0)
  })

  it('paid ahead of reported progress: unbilled floors at 0', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 600, pctComplete: 50 })
    expect(m.unbilled).toBe(0)
    expect(m.paidFrac).toBeCloseTo(0.6)
    expect(m.unbilledFrac).toBe(0)
  })

  it('pct fully done, nothing paid: whole bar amber', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 2000, paymentsMade: 0, pctComplete: 100 })
    expect(m.paidFrac).toBe(0)
    expect(m.unbilledFrac).toBe(1)
    expect(m.unbilled).toBe(2000)
  })

  it('pct outside 0–100 clamps', () => {
    expect(buildStagesMoneyBarModel({ totalBill: 100, paymentsMade: 0, pctComplete: 150 }).valueCreated).toBe(100)
    expect(buildStagesMoneyBarModel({ totalBill: 100, paymentsMade: 0, pctComplete: -5 }).valueCreated).toBe(0)
  })

  it('billed but unpaid, no pct: blue segment shows even without payments (job 879 case)', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 40135, paymentsMade: 0, pctComplete: null, billedUnpaid: 16054 })
    expect(m.paidFrac).toBe(0)
    expect(m.billedFrac).toBeCloseTo(0.4, 2)
    expect(m.billedUnpaid).toBeCloseTo(16054)
    expect(m.unbilledFrac).toBe(0) // pct unknown → no amber
    expect(m.owed).toBe(40135)
  })

  it('billed sits after paid and amber counts only work beyond paid+billed', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 200, pctComplete: 90, billedUnpaid: 300 })
    expect(m.paidFrac).toBeCloseTo(0.2)
    expect(m.billedFrac).toBeCloseTo(0.3)
    // done = 0.9; amber = 0.9 − 0.2 − 0.3 = 0.4
    expect(m.unbilledFrac).toBeCloseTo(0.4)
  })

  it('billed clamps so paid + billed never exceed the track', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 800, pctComplete: null, billedUnpaid: 500 })
    expect(m.paidFrac).toBeCloseTo(0.8)
    expect(m.billedFrac).toBeCloseTo(0.2) // capped at 1 − paidFrac
    expect(m.billedUnpaid).toBeCloseTo(200)
  })

  it('billedUnpaid omitted behaves exactly like the old paid/pct-only bar', () => {
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 250, pctComplete: 70 })
    expect(m.billedFrac).toBe(0)
    expect(m.billedUnpaid).toBe(0)
    expect(m.paidFrac).toBeCloseTo(0.25)
    expect(m.unbilledFrac).toBeCloseTo(0.45)
  })

  it('non-finite inputs are treated as empty', () => {
    const m = buildStagesMoneyBarModel({ totalBill: Number.NaN, paymentsMade: Number.NaN, pctComplete: Number.NaN })
    expect(m.hasBar).toBe(false)
    expect(m.paid).toBe(0)
    expect(m.valueCreated).toBeNull()
  })

  it('v2.3416 — the legend figures sum to the bid: paid + billed + done-not-billed + not-done', () => {
    // The row from the owner's 2026-09-14 screenshot (J977): 80% of $40,000 done,
    // $13,412 paid, $11,770 billed. The old legend printed "17% Unbilled $18,588" —
    // the percent of the amber slice beside done − paid, which still held the billed money.
    const m = buildStagesMoneyBarModel({ totalBill: 40_000, paymentsMade: 13_412, pctComplete: 80, billedUnpaid: 11_770 })
    expect(m.unbilled).toBeCloseTo(18_588)
    expect(m.doneNotBilled).toBeCloseTo(6_818)
    expect(m.notDone).toBeCloseTo(8_000)
    expect(m.paid + m.billedUnpaid + (m.doneNotBilled ?? 0) + (m.notDone ?? 0)).toBeCloseTo(40_000)
    expect(Math.round(m.unbilledFrac * 100)).toBe(17)
    expect(Math.round(((m.doneNotBilled ?? 0) / m.total) * 100)).toBe(17)
  })

  it('v2.3416 — done-not-billed floors at 0 when billing runs ahead of the work; not-done is null without a pct', () => {
    expect(buildStagesMoneyBarModel({ totalBill: 40_135, paymentsMade: 0, pctComplete: 60, billedUnpaid: 32_108 }).doneNotBilled).toBe(0)
    const m = buildStagesMoneyBarModel({ totalBill: 1000, paymentsMade: 250, pctComplete: null })
    expect(m.doneNotBilled).toBeNull()
    expect(m.notDone).toBeNull()
  })
})
