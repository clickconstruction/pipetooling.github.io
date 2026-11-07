import { describe, expect, it } from 'vitest'
import { awayBackDayDue, awayBackDayNeed, type AwayBackDayRow } from './awayBackDay'
import { plainWordsFailures } from '../plainWords'

const corinne: AwayBackDayRow = { userId: 'u-c', displayName: 'Corinne Vela', countdownYmd: '2029-11-05', leftYmd: '2026-11-03', archived: true }
const luis: AwayBackDayRow = { userId: 'u-l', displayName: 'Luis Ortega', countdownYmd: '2029-11-01', leftYmd: null, archived: true }

describe('the day back (punch list #256 PR 9)', () => {
  it('lists nobody before the day, the person on the day and after, and never a returner already restored', () => {
    expect(awayBackDayDue([corinne], '2029-11-04')).toEqual([])
    expect(awayBackDayDue([corinne], '2029-11-05')).toEqual([corinne])
    expect(awayBackDayDue([corinne], '2030-01-01')).toEqual([corinne])
    expect(awayBackDayDue([{ ...corinne, archived: false }], '2030-01-01')).toEqual([])
    expect(awayBackDayDue([corinne, luis], '2029-11-06').map((r) => r.userId)).toEqual(['u-l', 'u-c'])
  })

  it('one person: the Away note’s alert words, the day when it has passed, and the next press', () => {
    expect(awayBackDayNeed([corinne], '2029-11-05')).toEqual({
      count: 1,
      first: { userId: 'u-c', displayName: 'Corinne Vela' },
      title: "Corinne Vela's countdown ended today.",
      detail: 'They left Nov 3, 2026. Bring them back, or leave the note up.',
    })
    expect(awayBackDayNeed([luis], '2029-11-03')?.detail).toBe('Their countdown has ended. The day was Nov 1, 2029. Bring them back, or leave the note up.')
    expect(awayBackDayNeed([corinne], '2029-11-04')).toBeNull()
  })

  it('several: the count and the first names', () => {
    const need = awayBackDayNeed([corinne, luis], '2029-11-06')
    expect(need).toMatchObject({ count: 2, first: { userId: 'u-l' }, title: "2 teammates' countdowns have ended.", detail: 'Luis, Corinne. Each is waiting on Bring back.' })
  })

  it('reads in plain words', () => {
    for (const need of [awayBackDayNeed([corinne], '2029-11-05')!, awayBackDayNeed([luis], '2029-11-03')!, awayBackDayNeed([corinne, luis], '2029-11-06')!]) {
      expect(plainWordsFailures(`${need.title} ${need.detail}`)).toEqual([])
    }
  })
})
