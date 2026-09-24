import { describe, expect, it } from 'vitest'
import { planQueueRecord, readRecordedToday, writeRecordedToday, DAY_BOOK_QUEUE_RECORDED_KEY } from './dayBookQueueRecorder'

const mem = () => {
  const store = new Map<string, string>()
  return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), store }
}

describe('planQueueRecord', () => {
  it('writes each kind the day it resolves — a later count still lands (v2.3737)', () => {
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: null, contracts: 110 }, recorded: null })).toEqual({ contracts: 110 })
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: 1, contracts: 110 }, recorded: { day: '2026-09-22', kinds: ['contracts'] } })).toEqual({ deposits: 1 })
    expect(planQueueRecord({ role: 'controller', today: '2026-09-22', counts: { deposits: 1, contracts: 110 }, recorded: { day: '2026-09-22', kinds: ['contracts', 'deposits'] } })).toBeNull()
    expect(planQueueRecord({ role: 'dev', today: '2026-09-23', counts: { deposits: 0, contracts: 2.7 }, recorded: { day: '2026-09-22', kinds: ['contracts', 'deposits'] } })).toEqual({ deposits: 0, contracts: 2 })
    // v2.3801: Ready to Bill's count lands as `billing` once the engine has loaded (null before).
    expect(planQueueRecord({ role: 'controller', today: '2026-09-24', counts: { deposits: 1, contracts: 2, billing: null }, recorded: null })).toEqual({ deposits: 1, contracts: 2 })
    expect(planQueueRecord({ role: 'controller', today: '2026-09-24', counts: { billing: 13 }, recorded: { day: '2026-09-24', kinds: ['deposits', 'contracts'] } })).toEqual({ billing: 13 })
  })
  it('nothing for another role, nothing unresolved or negative', () => {
    expect(planQueueRecord({ role: 'assistant', today: '2026-09-22', counts: { deposits: 1 }, recorded: null })).toBeNull()
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: null, contracts: undefined }, recorded: null })).toBeNull()
    expect(planQueueRecord({ role: 'dev', today: '2026-09-22', counts: { deposits: -1, contracts: Number.NaN }, recorded: null })).toBeNull()
  })
  it('storage merges the kinds of a day, starts over on a new day, survives a throwing store', () => {
    const s = mem()
    expect(readRecordedToday(s, '2026-09-22')).toBeNull()
    writeRecordedToday(s, '2026-09-22', ['contracts'])
    writeRecordedToday(s, '2026-09-22', ['deposits', 'contracts'])
    expect(readRecordedToday(s, '2026-09-22')).toEqual({ day: '2026-09-22', kinds: ['contracts', 'deposits'] })
    expect(readRecordedToday(s, '2026-09-23')).toBeNull()
    writeRecordedToday(s, '2026-09-23', ['deposits'])
    expect(JSON.parse(s.store.get(DAY_BOOK_QUEUE_RECORDED_KEY)!)).toEqual({ day: '2026-09-23', kinds: ['deposits'] })
    const bad = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    expect(readRecordedToday(bad, '2026-09-22')).toBeNull()
    expect(() => writeRecordedToday(bad, '2026-09-22', ['deposits'])).not.toThrow()
    s.setItem(DAY_BOOK_QUEUE_RECORDED_KEY, 'not json')
    expect(readRecordedToday(s, '2026-09-22')).toBeNull()
  })
})
