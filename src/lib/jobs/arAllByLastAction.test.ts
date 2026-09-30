import { describe, expect, it } from 'vitest'
import { AR_ALL_OLDER_HEADING, arAllDayHeading, orderArAllByLastAction } from './arAllByLastAction'

const TZ = 'America/Chicago'
const NOW = new Date('2026-09-30T21:30:00Z') // 4:30 PM Chicago, Wed Sep 30

const row = (id: string, posted: string | null) => ({ mercury_transaction_id: id, posted_at: posted })

describe('arAllDayHeading', () => {
  it('today, yesterday, then the weekday and date in the app zone', () => {
    expect(arAllDayHeading('2026-09-30T21:02:53Z', NOW, TZ)).toBe('Today')
    expect(arAllDayHeading('2026-09-30T04:00:00Z', NOW, TZ)).toBe('Yesterday') // 11 PM Chicago on 9/29
    expect(arAllDayHeading('2026-09-28T16:56:00Z', NOW, TZ)).toBe('Mon 9/28')
    expect(arAllDayHeading('2026-09-17T15:50:00Z', NOW, TZ)).toBe('Thu 9/17')
  })
})

describe('orderArAllByLastAction', () => {
  // The 2026-09-30 rows: Lober's (banked 9/28, moved today), Loberg (banked 9/28, taken off today),
  // Southern Post (banked 9/18, returned 9/24), KCG (banked 9/17, applied 9/17), an August deposit nothing touched.
  const lobers = row('lobers', '2026-09-28T22:01:16Z')
  const loberg = row('loberg', '2026-09-28T22:01:16Z')
  const southern = row('southern', '2026-09-18T22:00:58Z')
  const kcg = row('kcg', '2026-09-17T15:00:00Z')
  const august = row('august', '2026-08-20T15:00:00Z')
  const marcos = row('marcos', '2026-09-30T14:00:00Z') // banked today, nothing happened to it
  const touched = new Map<string, string>([
    ['lobers', '2026-09-30T21:02:53Z'],
    ['loberg', '2026-09-30T20:22:26Z'],
    ['southern', '2026-09-24T13:43:04Z'],
    ['kcg', '2026-09-17T15:53:00Z'],
  ])
  const lastTouchedOf = (id: string) => touched.get(id) ?? null

  it('reads down the days by last action, a deposit nothing happened to on its bank date', () => {
    const groups = orderArAllByLastAction({ rows: [august, kcg, southern, loberg, lobers, marcos], lastTouchedOf, now: NOW, timeZone: TZ })
    expect(groups.map((g) => [g.heading, g.rows.map((r) => r.mercury_transaction_id)])).toEqual([
      ['Today', ['lobers', 'loberg', 'marcos']],
      ['Thu 9/24', ['southern']],
      ['Thu 9/17', ['kcg']],
      [AR_ALL_OLDER_HEADING, ['august']],
    ])
  })
  it('the window is 30 days; older rows keep bank-date order, newest first', () => {
    const old1 = row('old1', '2026-08-01T12:00:00Z')
    const old2 = row('old2', '2026-08-15T12:00:00Z')
    const edge = row('edge', '2026-09-01T12:00:00Z') // 29 days ago: inside
    const groups = orderArAllByLastAction({ rows: [old1, edge, old2], lastTouchedOf: () => null, now: NOW, timeZone: TZ })
    expect(groups.map((g) => [g.heading, g.rows.map((r) => r.mercury_transaction_id)])).toEqual([
      ['Tue 9/1', ['edge']],
      [AR_ALL_OLDER_HEADING, ['old2', 'old1']],
    ])
    expect(orderArAllByLastAction({ rows: [old1], lastTouchedOf: () => null, now: NOW, timeZone: TZ, windowDays: 90 })[0]!.heading).toBe('Sat 8/1')
  })
  it('a row with no dates at all goes last; an empty list is no groups', () => {
    const none = row('none', null)
    const groups = orderArAllByLastAction({ rows: [none, kcg], lastTouchedOf, now: NOW, timeZone: TZ })
    expect(groups.map((g) => g.heading)).toEqual(['Thu 9/17', AR_ALL_OLDER_HEADING])
    expect(groups[1]!.rows[0]!.mercury_transaction_id).toBe('none')
    expect(orderArAllByLastAction({ rows: [], lastTouchedOf, now: NOW, timeZone: TZ })).toEqual([])
  })
})
