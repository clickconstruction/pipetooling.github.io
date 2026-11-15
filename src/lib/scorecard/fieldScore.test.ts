import { describe, expect, it } from 'vitest'
import { buildFieldScore, fieldByOwner, fieldRowNote, type FieldScoreJobInput } from './fieldScore'
import { buildHurdle } from './hurdle'

const hurdle = buildHurdle({ overheadUsd: 50_000, paidFieldHours: 1_000, windowDays: 56, setting: { targetProfitPerHourUsd: 25 } }) // $50 break-even, $75 hurdle

const job = (over: Partial<FieldScoreJobInput> & { jobId: string }): FieldScoreJobInput => ({
  label: over.jobId,
  status: 'working',
  paidHours: 0,
  laborUsdRaw: 0,
  earnedUsd: 0,
  materialsUsd: 0,
  subUsd: 0,
  totalBillUsd: 10_000,
  ...over,
})

describe('field score', () => {
  it('gross profit per paid hour: earned less burdened labor, materials and subs, over every paid hour', () => {
    const s = buildFieldScore({
      burden: 1.2,
      hurdle,
      jobs: [
        job({ jobId: 'a', paidHours: 400, laborUsdRaw: 12_000, earnedUsd: 60_000, materialsUsd: 8_000, subUsd: 2_000 }), // labor 14,400 → gp 35,600 → $89/h
        job({ jobId: 'b', paidHours: 600, laborUsdRaw: 18_000, earnedUsd: 50_000, materialsUsd: 6_000 }), // labor 21,600 → gp 22,400 → $37.33/h
      ],
    })
    expect(s.paidHours).toBe(1_000)
    expect(s.laborUsd).toBeCloseTo(36_000)
    expect(s.grossProfitUsd).toBeCloseTo(58_000)
    expect(s.perHourUsd).toBeCloseTo(58)
    expect(s.clears).toBe(false)
    expect(s.verdict).toBe('The field made $58,000 on 1,000 paid hours, $58/h. That is $17/h under the $75/h hurdle.')
    expect(s.rows.map((r) => r.jobId)).toEqual(['b', 'a']) // most hours first
    expect(s.rows[1]!.clears).toBe(true)
    expect(s.rows[0]!.clears).toBe(false)
  })

  it('an overrun hurts twice: more labor and more hours, with nothing more earned', () => {
    const base = job({ jobId: 'a', paidHours: 100, laborUsdRaw: 3_000, earnedUsd: 15_000 })
    const tidy = buildFieldScore({ burden: 1.2, hurdle, jobs: [base] })
    const over = buildFieldScore({ burden: 1.2, hurdle, jobs: [{ ...base, paidHours: 150, laborUsdRaw: 4_500 }] })
    expect(tidy.perHourUsd).toBeCloseTo((15_000 - 3_600) / 100)
    expect(over.perHourUsd).toBeCloseTo((15_000 - 5_400) / 150)
    expect(over.perHourUsd!).toBeLessThan(tidy.perHourUsd! - 40)
  })

  it('hours with no bill earn nothing and are flagged, so someone can bill them', () => {
    const s = buildFieldScore({ burden: 1.2, hurdle, jobs: [job({ jobId: 'a', paidHours: 40, laborUsdRaw: 1_200, earnedUsd: null, totalBillUsd: null })] })
    expect(s.noBillCount).toBe(1)
    expect(s.rows[0]!.grossProfitUsd).toBeCloseTo(-1_440)
    expect(fieldRowNote(s.rows[0]!)).toBe('Hours and no bill: nothing earned until someone bills it.')
  })

  it('by superintendent: a shared job splits evenly, the unowned jobs fold into one last line, and the lines sum to the whole', () => {
    const s = buildFieldScore({
      burden: 1.2,
      hurdle,
      jobs: [
        job({ jobId: 'a', paidHours: 400, laborUsdRaw: 12_000, earnedUsd: 60_000, materialsUsd: 8_000, subUsd: 2_000 }), // gp 35,600
        job({ jobId: 'b', paidHours: 600, laborUsdRaw: 18_000, earnedUsd: 50_000, materialsUsd: 6_000 }), // gp 22,400
        job({ jobId: 'c', paidHours: 40, laborUsdRaw: 1_200, earnedUsd: null, totalBillUsd: null }), // gp −1,440, no bill
      ],
    })
    const pat = { id: 'pat', name: 'Pat' }
    const lee = { id: 'lee', name: 'Lee' }
    const lines = fieldByOwner(s.rows, new Map([['a', [pat]], ['b', [pat, lee]]]), hurdle)
    expect(lines.map((l) => [l.owner?.name ?? null, l.jobs, l.paidHours, Math.round(l.grossProfitUsd)])).toEqual([
      ['Pat', 2, 700, 46_800],
      ['Lee', 1, 300, 11_200],
      [null, 1, 40, -1_440],
    ])
    expect(lines[0]!.clears).toBe(false) // $66.9/h under $75
    expect(lines[2]!.noBill).toBe(1)
    expect(lines.reduce((t, l) => t + l.grossProfitUsd, 0)).toBeCloseTo(s.grossProfitUsd)
    expect(lines.reduce((t, l) => t + l.paidHours, 0)).toBeCloseTo(s.paidHours)
  })

  it('no hours: no figure, and the words say so', () => {
    const s = buildFieldScore({ burden: 1.2, hurdle, jobs: [] })
    expect(s.perHourUsd).toBeNull()
    expect(s.verdict).toBe('No paid field hours in the last 56 days.')
  })
})
