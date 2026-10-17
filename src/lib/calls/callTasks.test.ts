import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { callFirst, callRows, callTitle, callWhat, CALL_WORDS, dayAfter, type CallTaskRecord } from './callTasks'

const task = (over: Partial<CallTaskRecord> = {}): CallTaskRecord => ({
  id: 'c1',
  contactId: 'c-dana',
  stepKey: 'estimate',
  jobKey: 'pipeline:job-1312',
  dueYmd: '2026-10-18',
  what: 'about the estimate',
  script: 'Hi Dana, this is Rosa with Click Plumbing. I just sent your estimate.',
  madeBy: 'Rosa',
  madeAt: '2026-10-17T19:41:00.000Z',
  doneAt: null,
  ...over,
})

describe('callRows: the calls to make in We owe them', () => {
  it('draws the open calls soonest first, late and today marked, and leaves out the done ones', () => {
    const rows = callRows(
      [
        task({ id: 'later', dueYmd: '2026-10-20' }),
        task({ id: 'late', contactId: 'c-sam', dueYmd: '2026-10-16' }),
        task({ id: 'today', contactId: 'c-lee', dueYmd: '2026-10-17' }),
        task({ id: 'done', dueYmd: '2026-10-16', doneAt: '2026-10-16T20:00:00Z' }),
        task({ id: 'later-first', dueYmd: '2026-10-20', madeAt: '2026-10-17T18:00:00.000Z' }),
      ],
      '2026-10-17',
    )
    expect(rows.map((r) => [r.id, r.pill, r.late, r.today])).toEqual([
      ['late', 'call · Fri Oct 16, late', true, false],
      ['today', 'call · today', false, true],
      ['later-first', 'call · Tue Oct 20', false, false],
      ['later', 'call · Tue Oct 20', false, false],
    ])
    expect(rows[0]).toMatchObject({ contactId: 'c-sam', what: 'about the estimate', madeBy: 'Rosa', jobKey: 'pipeline:job-1312', stepKey: 'estimate' })
  })
})

describe('the words', () => {
  it('says what the call is about by the step, and the day after a day', () => {
    expect(callWhat('booked')).toBe('about the visit')
    expect(callWhat('estimate')).toBe('about the estimate')
    expect(callWhat('approved')).toBe('about the estimate')
    expect(callWhat(null, 'the water heater')).toBe('about the water heater')
    expect(callWhat(null)).toBe('to follow up')
    expect(callTitle('Dana', 'about the estimate')).toBe('Call Dana about the estimate')
    expect(callFirst({ name: 'Dr. Priya Raman' })).toBe('Priya')
    expect(callFirst({ name: 'Dana Whitfield', goesBy: ' Dee ' })).toBe('Dee')
    expect(callFirst({ name: 'Mrs. Ortiz' })).toBe('Ortiz')
    expect(callFirst({ name: '' })).toBeNull()
    expect(callTitle(null, 'to follow up')).toBe('Call them to follow up')
    expect(dayAfter('2026-10-31')).toBe('2026-11-01')
    expect(dayAfter('2026-12-31')).toBe('2027-01-01')
  })

  it('keep to plain words', () => {
    const words = [
      ...(Object.values(CALL_WORDS).filter((w) => typeof w === 'string') as string[]),
      CALL_WORDS.added('Dana', '2026-10-18'),
      CALL_WORDS.added(null, '2026-10-18'),
      CALL_WORDS.movedToast('2026-10-19'),
      CALL_WORDS.quietAsk('Dana'),
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
