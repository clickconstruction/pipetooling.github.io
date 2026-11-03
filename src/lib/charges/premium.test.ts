import { describe, expect, it } from 'vitest'
import { premiumOf } from './premium'
import { adjustMaterialLines, chargeAdjustmentFromRow, chargeAdjustmentWords, indexAdjustments, saveAdjustmentsLabel } from './adjustments'
import type { MaterialLineInput } from './materialsCharged'

describe('premium and shortfall (punch list #254)', () => {
  it('reads the price against the charges: above is a premium, below a shortfall, the same even', () => {
    expect(premiumOf(250000, 249593.73)).toMatchObject({ kind: 'premium', amount: 406.27, signed: 406.27, words: 'a $406.27 premium', sentence: 'The price stands $406.27 above the charges.' })
    expect(premiumOf(250000, 250537.73)).toMatchObject({ kind: 'shortfall', amount: 537.73, signed: -537.73, words: 'a $537.73 shortfall', sentence: 'The price stands $537.73 below the charges.' })
    expect(premiumOf(100, 100)).toMatchObject({ kind: 'even', amount: 0, words: 'even' })
    expect(premiumOf(Number.NaN, 5)).toMatchObject({ kind: 'shortfall', amount: 5 })
  })
})

describe('adjustments on a job’s charges', () => {
  const rows = [
    { id: 'a1', job_id: 'j', kind: 'day_shape', target: '2026-04-25', shape: 'tech_alone', reason: 'Zed was alone on the Saturday', made_by_user: { name: 'Dana' }, created_at: '2026-11-03T08:00:00Z' },
    { id: 'a2', job_id: 'j', kind: 'day_shape', target: '2026-04-25', shape: 'helper_alone', reason: 'second thoughts', made_by_user: { name: 'Taunya' }, created_at: '2026-11-03T09:00:00Z' },
    { id: 'a3', job_id: 'j', kind: 'line_pass_through', target: 'inv-1', shape: null, reason: 'a rental', made_by_name: 'Dana', created_at: '2026-11-03T08:30:00Z' },
    { id: 'a4', job_id: 'j', kind: 'line_off', target: 'inv-2', reason: '', created_at: '2026-11-03T08:40:00Z' },
    { id: 'a5', job_id: 'j', kind: 'day_off', target: '2026-04-26', reason: 'not this job', created_at: '2026-11-03T08:50:00Z' },
    { id: 'bad', job_id: 'j', kind: 'day_shape', target: '2026-04-27', shape: 'nope', created_at: '' },
    { id: 'bad2', job_id: 'j', kind: 'other', target: 'x' },
  ]

  it('reads rows, drops the unreadable, and lets the newest shape for a day win', () => {
    const read = rows.map(chargeAdjustmentFromRow).filter((a): a is NonNullable<typeof a> => a != null)
    expect(read.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
    const applied = indexAdjustments(read)
    expect(applied.dayShape.get('2026-04-25')).toEqual({ shape: 'helper_alone', reason: 'second thoughts', madeByName: 'Taunya' })
    expect([...applied.dayOff]).toEqual(['2026-04-26'])
    expect([...applied.linePassThrough]).toEqual(['inv-1'])
    expect([...applied.lineOff]).toEqual(['inv-2'])
  })

  it('applies the line adjustments to material lines and words every kind for the log', () => {
    const read = rows.map(chargeAdjustmentFromRow).filter((a): a is NonNullable<typeof a> => a != null)
    const applied = indexAdjustments(read)
    const inputs: MaterialLineInput[] = [{ id: 'inv-1', kind: 'supply_invoice', label: 'Sunbelt', dateKey: null, cost: 10 }, { id: 'inv-2', kind: 'supply_invoice', label: 'NAPA', dateKey: null, cost: 5 }, { id: 'inv-3', kind: 'supply_invoice', label: 'Reece', dateKey: null, cost: 7 }]
    const lines = adjustMaterialLines(inputs, applied)
    expect(lines.map((l) => [l.id, Boolean(l.passThrough), Boolean(l.leftOff)])).toEqual([['inv-1', true, false], ['inv-2', false, true], ['inv-3', false, false]])
    const day = (d: string) => `Sat ${d.slice(5)}`
    const label = (id: string) => ({ 'inv-1': 'A rental yard · 2002', 'inv-2': 'NAPA' })[id] ?? id
    expect(chargeAdjustmentWords(read[0]!, day, label)).toBe('Sat 04-25 · set to a tech alone · Zed was alone on the Saturday · Dana')
    expect(chargeAdjustmentWords(read[2]!, day, label)).toBe('A rental yard · 2002 · passed through at cost · a rental · Dana')
    expect(chargeAdjustmentWords(read[3]!, day, label)).toBe('NAPA · left off')
    expect(chargeAdjustmentWords(read[4]!, day, label)).toBe('Sat 04-26 · left off · not this job')
    expect(saveAdjustmentsLabel(1)).toBe('Save 1 adjustment')
    expect(saveAdjustmentsLabel(3)).toBe('Save 3 adjustments')
  })
})
