import { describe, expect, it } from 'vitest'
import { planQueueRecord, readLastRecordedDay, writeLastRecordedDay, DAY_BOOK_QUEUE_RECORDED_KEY } from './dayBookQueueRecorder'

describe('planQueueRecord', () => {
  it('writes the resolved counts once a day for a Day book role', () => {
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: 1, contracts: 103 }, lastRecordedDay: null })).toEqual({ deposits: 1, contracts: 103 })
    expect(planQueueRecord({ role: 'controller', today: '2026-09-22', counts: { deposits: 0, contracts: 2.7 }, lastRecordedDay: '2026-09-21' })).toEqual({ deposits: 0, contracts: 2 })
  })
  it('nothing for another role, nothing twice a day, nothing unresolved or negative', () => {
    expect(planQueueRecord({ role: 'assistant', today: '2026-09-22', counts: { deposits: 1 }, lastRecordedDay: null })).toBeNull()
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: 1 }, lastRecordedDay: '2026-09-22' })).toBeNull()
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: null, contracts: undefined }, lastRecordedDay: null })).toBeNull()
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: -1, contracts: Number.NaN }, lastRecordedDay: null })).toBeNull()
  })
  it('storage round-trips and survives a throwing store', () => {
    const store = new Map<string, string>()
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readLastRecordedDay(s)).toBeNull()
    writeLastRecordedDay(s, '2026-09-22')
    expect(store.get(DAY_BOOK_QUEUE_RECORDED_KEY)).toBe('2026-09-22')
    expect(readLastRecordedDay(s)).toBe('2026-09-22')
    const bad = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    expect(readLastRecordedDay(bad)).toBeNull()
    expect(() => writeLastRecordedDay(bad, '2026-09-22')).not.toThrow()
    expect(readLastRecordedDay(null)).toBeNull()
  })
})
