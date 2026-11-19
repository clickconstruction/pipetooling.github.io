/**
 * What a watch tells the people on its list: the first act of the day once, acts outside the process
 * once each and as one push when a run finds several, the day's count once after the evening hour,
 * and nothing a second time.
 */
import { describe, expect, it } from 'vitest'
import { watchActWords, watchNoticeKeys, watchNotices, watchOutside, type WatchAct, type WatchActKind } from './watchNotice'

let seq = 0
function act(kind: WatchActKind, at: string, over: Partial<WatchAct> = {}): WatchAct {
  seq += 1
  return { id: `a${seq}`, kind, at, day: at.slice(0, 10), part: '2 PVC 90', quantity: 4, box: 'G22', note: '', ...over }
}
const base = { watchId: 'w1', name: 'Sam', site: 'Cedar Ridge', today: '2026-11-18', hour: 10 }

describe('watchOutside', () => {
  it('names what is the office’s to do, and a take or a use with no note', () => {
    expect(watchOutside({ kind: 'counted', note: '' })).toBe('counted a box')
    expect(watchOutside({ kind: 'delivered', note: '' })).toBe('added a part')
    expect(watchOutside({ kind: 'box_retired', note: '' })).toBe('retired a box')
    expect(watchOutside({ kind: 'taken', note: '' })).toBe('took material with no note')
    expect(watchOutside({ kind: 'used', note: ' ' })).toBe('used material with no note')
    expect(watchOutside({ kind: 'taken', note: 'lodge' })).toBeNull()
    expect(watchOutside({ kind: 'moved', note: '' })).toBeNull()
    expect(watchOutside({ kind: 'box_moved', note: '' })).toBeNull()
    expect(watchOutside({ kind: 'returned', note: '' })).toBeNull()
  })
})

describe('watchActWords', () => {
  it('reads an act as one line', () => {
    expect(watchActWords(act('taken', '2026-11-18T15:00:00Z', { quantity: 16, part: '1/2 PEX', box: 'G40' }))).toBe('Took 16 of 1/2 PEX from G40')
    expect(watchActWords(act('counted', '2026-11-18T15:00:00Z', { quantity: 12 }))).toBe('Counted 2 PVC 90 at 12 in G22')
    expect(watchActWords(act('delivered', '2026-11-18T15:00:00Z', { quantity: 1200 }))).toBe('Added 1,200 of 2 PVC 90 into G22')
    expect(watchActWords(act('box_retired', '2026-11-18T15:00:00Z', { box: 'B7' }))).toBe('Retired box B7')
    expect(watchActWords(act('answer_removed', '2026-11-18T15:00:00Z', { part: '2 PVC 90, $4.50', box: '' }))).toBe('Took an answer off: 2 PVC 90, $4.50')
  })
})

describe('watchNotices', () => {
  it('says nothing with no act', () => {
    expect(watchNotices({ ...base, acts: [], sent: new Set() })).toEqual([])
  })

  it('tells the first act of the day once', () => {
    const acts = [act('taken', '2026-11-18T16:00:00Z', { note: 'lodge' }), act('box_moved', '2026-11-18T15:00:00Z', { box: 'G31' })]
    const first = watchNotices({ ...base, acts, sent: new Set() })
    expect(first.map((n) => [n.key, n.title, n.body])).toEqual([['started:2026-11-18', 'Sam started at Cedar Ridge', 'Moved box G31.']])
    expect(watchNotices({ ...base, acts, sent: new Set(['started:2026-11-18']) })).toEqual([])
    // A job with no site says so in other words.
    expect(watchNotices({ ...base, site: '', acts, sent: new Set() })[0]?.title).toBe('Sam started on site')
  })

  it('tells each act outside the process once, in its own push when there are few', () => {
    const count = act('counted', '2026-11-18T19:52:00Z', { quantity: 12 })
    const take = act('taken', '2026-11-18T17:02:00Z', { quantity: 16, part: '1/2 PEX', box: 'G40' })
    const notices = watchNotices({ ...base, acts: [count, take], sent: new Set(['started:2026-11-18']) })
    expect(notices.map((n) => [n.kind, n.title, n.body])).toEqual([
      ['outside', 'Outside the process: Sam took material with no note', 'Took 16 of 1/2 PEX from G40.'],
      ['outside', 'Outside the process: Sam counted a box', 'Counted 2 PVC 90 at 12 in G22.'],
    ])
    const sent = new Set(['started:2026-11-18', ...notices.flatMap(watchNoticeKeys)])
    expect(watchNotices({ ...base, acts: [count, take], sent })).toEqual([])
  })

  it('tells several as one push, and settles every act it named', () => {
    const acts = [1, 2, 3, 4, 5].map((i) => act('counted', `2026-11-18T1${i}:00:00Z`, { quantity: i, box: `G${i}` }))
    const notices = watchNotices({ ...base, acts, sent: new Set(['started:2026-11-18']) })
    expect(notices).toHaveLength(1)
    expect(notices[0]?.title).toBe('Outside the process: Sam, 5 presses')
    expect(notices[0]?.body).toBe('Counted 2 PVC 90 at 1 in G1. Counted 2 PVC 90 at 2 in G2. Counted 2 PVC 90 at 3 in G3. And 2 more.')
    expect(watchNoticeKeys(notices[0] as (typeof notices)[number])).toHaveLength(5)
  })

  it('tells an act outside the process that landed late, whatever its day', () => {
    const late = act('counted', '2026-11-16T15:00:00Z')
    const notices = watchNotices({ ...base, acts: [late], sent: new Set() })
    expect(notices.map((n) => [n.kind, n.day])).toEqual([['outside', '2026-11-16']])
  })

  it('sends the day’s count once, after the evening hour, when there was an act', () => {
    const acts = [
      act('taken', '2026-11-18T15:00:00Z', { quantity: 30, note: 'bunker' }),
      act('used', '2026-11-18T16:00:00Z', { quantity: 7, note: 'lodge', box: 'G40' }),
      act('counted', '2026-11-18T17:00:00Z'),
      act('taken', '2026-11-17T15:00:00Z', { quantity: 99, note: 'yesterday' }),
    ]
    const sent = new Set(['started:2026-11-18', `outside:${acts[2]?.id}`])
    expect(watchNotices({ ...base, acts, sent, hour: 17 })).toEqual([])
    const evening = watchNotices({ ...base, acts, sent, hour: 18 })
    expect(evening.map((n) => [n.key, n.title, n.body])).toEqual([['evening:2026-11-18', 'Sam today: 3 presses, 1 outside the process', '37 pieces taken or used across 2 boxes.']])
    expect(watchNotices({ ...base, acts, sent: new Set([...sent, 'evening:2026-11-18']), hour: 20 })).toEqual([])
    // A day with no act has no evening line.
    expect(watchNotices({ ...base, acts: [acts[3] as WatchAct], sent: new Set(), hour: 20 })).toEqual([])
  })
})
