import { describe, expect, it } from 'vitest'
import { BENCH_SAVE, BENCH_SAVE_AND_ASK, benchAskFor, benchAskWords, benchAskedToast } from './benchAsk'

describe('benchAsk', () => {
  it('words the tick, the button and the toast', () => {
    expect(benchAskWords({ projectName: 'Oak Run Clinic', trade: 'Fire sprinkler', packageId: 'k1' })).toBe('Ask them to quote Oak Run Clinic · Fire sprinkler now')
    expect(BENCH_SAVE).toBe('Save to the bench')
    expect(BENCH_SAVE_AND_ASK).toBe('Save to the bench and ask')
    expect(benchAskedToast('Alamo Sprinkler Co', 'Oak Run Clinic', false)).toBe('Alamo Sprinkler Co is on the bench and asked on Oak Run Clinic')
    expect(benchAskedToast(' ', 'Oak Run Clinic', true)).toBe('The company is on the bench and asked on Oak Run Clinic, the invitation emailed')
  })

  it('offers the ask only when the run names a trade, a package and a project', () => {
    expect(benchAskFor({ trade: 'Fire sprinkler', packageId: 'k1' }, 'Oak Run Clinic')).toEqual({ projectName: 'Oak Run Clinic', trade: 'Fire sprinkler', packageId: 'k1' })
    expect(benchAskFor({ trade: 'Fire sprinkler', packageId: null }, 'Oak Run Clinic')).toBeNull()
    expect(benchAskFor({ trade: null, packageId: 'k1' }, 'Oak Run Clinic')).toBeNull()
    expect(benchAskFor({ trade: 'Fire sprinkler', packageId: 'k1' }, null)).toBeNull()
    expect(benchAskFor(null, 'Oak Run Clinic')).toBeNull()
  })
})
