/**
 * The tests of `gcVettingPromises.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-i). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { wordRecord } from './followUp'
import { insuranceRenewals, tradePromiseRecord, tradePromiseState } from './promises'
import { initialGcState } from './schedule/testState'
import type { GcState, Partner, TradePromise } from './types'
import { canAward, vettingWords } from './vetting'

const state = initialGcState()

const known = state.partners[0] as Partner

describe('vetting (question 3)', () => {
  it('a company we know has no record and can be awarded anything', () => {
    expect(canAward(known, 5_000_000)).toEqual({ ok: true, why: null })
    expect(vettingWords(known)).toBe('')
  })

  it('a new company quotes but is not awarded until approved, and then only up to its limit', () => {
    const fresh: Partner = { ...known, vetting: { status: 'new' } }
    expect(canAward(fresh, 1).ok).toBe(false)
    expect(vettingWords(fresh)).toBe('not vetted yet')
    const limited: Partner = { ...known, vetting: { status: 'approved', limit: 150_000 } }
    expect(canAward(limited, 150_000).ok).toBe(true)
    expect(canAward(limited, 150_001).why).toBe(`${known.company} is approved up to $150,000. This award is $150,001.`)
    expect(canAward({ ...known, vetting: { status: 'declined', note: 'no license' } }, 1).why).toBe(`We declined ${known.company}: no license.`)
  })
})

describe('promises other than a quote date (question 8)', () => {
  const base: TradePromise = { id: 'tp-1', partnerId: known.id, kind: 'insurance', what: 'the renewed insurance certificate', by: '2026-10-05', madeOn: '2026-10-01', from: 'office' }

  it('reads kept, late, pending, today and passed the way a quote date does', () => {
    expect(tradePromiseState({ ...base, keptOn: '2026-10-05' }, '2026-10-09').state).toBe('kept')
    expect(tradePromiseState({ ...base, keptOn: '2026-10-07' }, '2026-10-09')).toEqual({ state: 'late', days: 2 })
    expect(tradePromiseState(base, '2026-10-02')).toEqual({ state: 'pending', days: 3 })
    expect(tradePromiseState(base, '2026-10-05').state).toBe('today')
    expect(tradePromiseState(base, '2026-10-08')).toEqual({ state: 'passed', days: 3 })
  })

  it('counts in the word record: a day moved after it passed counts against them, one moved in time does not', () => {
    const today = '2026-10-10'
    const promises: TradePromise[] = [
      { ...base, keptOn: '2026-10-04' },
      { ...base, id: 'tp-2', kind: 'w9', by: '2026-10-09', moved: [{ by: '2026-10-03', on: '2026-10-06' }, { by: '2026-10-08', on: '2026-10-02' }] },
    ]
    const s: GcState = { ...state, today, tradePromises: promises }
    // tp-1 kept; tp-2 passed (Oct 9), its Oct 3 day passed before it moved, its Oct 8 day moved in time.
    expect(tradePromiseRecord(s, known)).toEqual({ made: 3, kept: 1 })
    const before = wordRecord(state, known)
    const after = wordRecord(s, known)
    expect({ made: after.made - before.made, kept: after.kept - before.kept }).toEqual({ made: 3, kept: 1 })
  })

  it('chases insurance from 30 days out, and a lapsed policy first', () => {
    const ids = insuranceRenewals(state).map((r) => [r.partner.id, r.days])
    expect(ids.every(([, d]) => (d as number) <= 30)).toBe(true)
    const days = ids.map(([, d]) => d as number)
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })
})
