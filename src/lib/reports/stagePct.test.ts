import { describe, expect, it } from 'vitest'
import { STAGE_PCT_STEP, STAGE_QUICK_PICKS, clampPct, quickPickLabel, saveWords, stepPct, typedPct } from './stagePct'

describe('stagePct', () => {
  it('steps by five and clamps at the ends', () => {
    expect(STAGE_PCT_STEP).toBe(5)
    expect(stepPct(35, STAGE_PCT_STEP)).toBe(40)
    expect(stepPct(35, -STAGE_PCT_STEP)).toBe(30)
    expect(stepPct(98, 5)).toBe(100)
    expect(stepPct(3, -5)).toBe(0)
    expect(stepPct(100, 5)).toBe(100)
    expect(stepPct(0, -5)).toBe(0)
    // A number that came in off the grid steps from where it is, whole.
    expect(stepPct(42.6, 5)).toBe(48)
  })

  it('clamps and rounds a number, and reads nothing as 0', () => {
    expect(clampPct(150)).toBe(100)
    expect(clampPct(-4)).toBe(0)
    expect(clampPct(49.5)).toBe(50)
    expect(clampPct(Number.NaN)).toBe(0)
  })

  it('reads a typed number: digits only, clamped, null when nothing was typed', () => {
    expect(typedPct('45')).toBe(45)
    expect(typedPct(' 45 ')).toBe(45)
    expect(typedPct('45%')).toBe(45)
    expect(typedPct('250')).toBe(100)
    expect(typedPct('0')).toBe(0)
    expect(typedPct('')).toBeNull()
    expect(typedPct('abc')).toBeNull()
  })

  it('names the quick picks, Done ✓ at 100', () => {
    expect(STAGE_QUICK_PICKS).toEqual([25, 50, 75, 100])
    expect(STAGE_QUICK_PICKS.map(quickPickLabel)).toEqual(['25', '50', '75', 'Done ✓'])
  })

  it('names what Save writes, with the photos once there are any', () => {
    expect(saveWords({ jobPct: 36 })).toBe('Save · job 36%')
    expect(saveWords({ jobPct: 36, photos: 0 })).toBe('Save · job 36%')
    expect(saveWords({ jobPct: 36, photos: 1 })).toBe('Save · job 36% · 1 photo')
    expect(saveWords({ jobPct: 36, photos: 2 })).toBe('Save · job 36% · 2 photos')
    // A report type that files no percent names none (v2.6126).
    expect(saveWords({ jobPct: null })).toBe('Save report')
    expect(saveWords({ jobPct: null, photos: 1 })).toBe('Save report · 1 photo')
    expect(saveWords({ jobPct: null, photos: 2 })).toBe('Save report · 2 photos')
  })
})
