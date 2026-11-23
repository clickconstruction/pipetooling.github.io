import { describe, expect, it } from 'vitest'
import type { AvailableHoursAnswer } from '../people/utilization'
import { DEFAULT_WEEK } from '../people/weekAvailability'
import { canWorkFromAnswers, myTimeCanWorkWords, myTimeHours } from './myTimeCanWork'
import type { WeekDays } from '../people/weekAvailability'

const answer = (over: Partial<AvailableHoursAnswer>): AvailableHoursAnswer => ({ user_id: 'u-1', hours_per_week: 38, days: null, effective_from: '2026-11-01', set_by: 'u-1', set_at: '2026-11-01T10:00:00Z', ...over })

describe('canWorkFromAnswers', () => {
  it('is null with no answer, and the line asks', () => {
    expect(canWorkFromAnswers([], '2026-11-25')).toBeNull()
    expect(myTimeCanWorkWords(null)).toEqual({ line: 'How many hours a week can you work?', press: 'Set hours' })
  })

  it('reads a typed number as it was typed', () => {
    const cw = canWorkFromAnswers([answer({})], '2026-11-25')
    expect(cw).toMatchObject({ hours: 38, source: 'answered', days: null, setBy: 'u-1' })
    expect(myTimeCanWorkWords(cw)).toEqual({ line: 'The office has your week as 38 h.', press: 'Change' })
  })

  it('adds a drawn week up, whatever number sits beside it', () => {
    expect(canWorkFromAnswers([answer({ hours_per_week: 12, days: DEFAULT_WEEK })], '2026-11-25')?.hours).toBe(40)
  })

  it('takes the newest answer in force today', () => {
    const cw = canWorkFromAnswers([answer({}), answer({ hours_per_week: 30, effective_from: '2026-11-22', set_at: '2026-11-20T10:00:00Z' }), answer({ hours_per_week: 20, effective_from: '2026-11-29' })], '2026-11-25')
    expect(cw?.hours).toBe(30)
  })
})

describe('myTimeHours, the line at the foot of My Time', () => {
  /** 6:00 AM to 12:00 PM, Monday to Friday. */
  const SIX: WeekDays = [[], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], []]
  /** The same week with a half day on Wednesday. */
  const HALF_WED: WeekDays = SIX.map((d, i) => (i === 3 ? [[360, 540]] : d)) as WeekDays
  const set = (over: Partial<AvailableHoursAnswer>): AvailableHoursAnswer => answer({ kind: 'set', days: SIX, hours_per_week: 30, set_by: 'u-office', ...over })
  const plain = (sentences: string[]) => sentences.map((t) => t.replace(/⟪[^|⟪⟫]+\|([^⟪⟫]*)⟫/g, '$1'))

  it('reads working hours in force, with no press', () => {
    const h = myTimeHours([answer({}), set({})], '2026-11-25', true)
    expect(h.kind).toBe('set')
    if (h.kind !== 'set') return
    expect(plain(h.sentences)).toEqual(['Your hours are 6:00 AM to 12:00 PM, Mon to Fri.'])
    expect(h.coming).toBeNull()
  })

  it('says each line of a week that differs by day', () => {
    const h = myTimeHours([set({ days: HALF_WED })], '2026-11-25', false)
    expect(h.kind === 'set' && plain(h.sentences)).toEqual(['Mon, Tue, Thu, Fri: 6:00 AM to 12:00 PM.', 'Wed: 6:00 AM to 9:00 AM.'])
  })

  it('tells the person a week ahead when the hours are about to change', () => {
    const h = myTimeHours([set({}), set({ days: HALF_WED, effective_from: '2026-11-29', set_at: '2026-11-24T10:00:00Z' })], '2026-11-25', true)
    expect(h.kind).toBe('set')
    expect(h.coming?.chip).toBe('New from Sun Nov 29')
    expect(plain(h.coming!.sentences)).toEqual(['6:00 AM to 12:00 PM, Mon, Tue, Thu, Fri.', '6:00 AM to 9:00 AM, Wed.'])
    // Hours that will be taken off again from next Sunday.
    const off = myTimeHours([set({}), set({ days: null, effective_from: '2026-11-29', set_at: '2026-11-24T10:00:00Z' })], '2026-11-25', true)
    expect(off.coming?.sentences).toEqual(['The office no longer sets your hours.'])
  })

  it('with no working hours it asks a person who is asked, and says nothing to one who is not', () => {
    expect(myTimeHours([answer({})], '2026-11-25', true)).toMatchObject({ kind: 'ask', canWork: { hours: 38 }, coming: null })
    expect(myTimeHours([], '2026-11-25', true)).toEqual({ kind: 'ask', canWork: null, coming: null })
    expect(myTimeHours([answer({})], '2026-11-25', false)).toEqual({ kind: 'none', coming: null })
    // Hours taken off again leave the answer standing.
    expect(myTimeHours([answer({}), set({}), set({ days: null, effective_from: '2026-11-22', set_at: '2026-11-23T10:00:00Z' })], '2026-11-25', true).kind).toBe('ask')
    // First hours that start next week: still asked today, and told what is coming.
    const first = myTimeHours([set({ effective_from: '2026-11-29', set_at: '2026-11-24T10:00:00Z' })], '2026-11-25', false)
    expect(first.kind).toBe('none')
    expect(first.coming?.chip).toBe('New from Sun Nov 29')
  })
})
