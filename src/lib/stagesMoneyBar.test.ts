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

  it('non-finite inputs are treated as empty', () => {
    const m = buildStagesMoneyBarModel({ totalBill: Number.NaN, paymentsMade: Number.NaN, pctComplete: Number.NaN })
    expect(m.hasBar).toBe(false)
    expect(m.paid).toBe(0)
    expect(m.valueCreated).toBeNull()
  })
})
