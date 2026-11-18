import { describe, expect, it } from 'vitest'
import type { ContainerLine } from './onSite'
import { TAKE_FOUND_NOTE, TAKE_OPEN_MS, newTakeRun, takeAddExtra, takeDoneWords, takeIdOf, takeIsOnePart, takeIsStale, takeLeftWords, takeLineCount, takeLineHint, takeMark, takePhotoWords, takeQuicks, takeRemoveExtra, takeRows, takeSaveLabel, takeSaved, takeStartLabel, takeTotal } from './takeRun'

const line = (partKey: string, partName: string, onHand: number, partId: string | null = null): ContainerLine => ({ containerId: 'box', partKey, partId, partName, manufacturer: null, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 })
const toilets = [line('text:kohler toilet', 'Kohler toilet', 24)]
const mixed = [line('text:elbow', 'Elbow', 24), line('text:coupling', 'Coupling', 40), line('text:hanger', 'Hanger', 1)]
const NOW = '2026-11-18T20:14:00.000Z'
const start = (lines: ContainerLine[]) => newTakeRun({ id: 'take-1', jobId: 'job', containerId: 'box', lines, now: NOW })

describe('a new run', () => {
  it('opens a one-part box on 1 and a mixed box on nothing', () => {
    expect(takeIsOnePart(toilets)).toBe(true)
    expect(start(toilets).marks).toEqual({ 'text:kohler toilet': 1 })
    expect(takeIsOnePart(mixed)).toBe(false)
    expect(start(mixed).marks).toEqual({})
    expect(start([]).marks).toEqual({})
  })
})

describe('marking', () => {
  it('sets a line, takes it off at none, and never goes under zero', () => {
    let run = start(mixed)
    run = takeMark(run, 'text:elbow', 2)
    run = takeMark(run, 'text:hanger', 1)
    expect(takeTotal(run)).toBe(3)
    expect(takeLineCount(run)).toBe(2)
    run = takeMark(run, 'text:hanger', 0)
    expect(run.marks).toEqual({ 'text:elbow': 2 })
    expect(takeMark(run, 'text:elbow', -4).marks).toEqual({})
    expect(takeMark(run, 'text:elbow', 2.6).marks['text:elbow']).toBe(3)
  })

  it('adds a part the list does not hold, and drops one with no name or no count', () => {
    let run = takeAddExtra(start(mixed), { partId: null, partName: '  1 in. cap ', manufacturer: null, n: 2 })
    expect(run.extras).toEqual([{ partId: null, partName: '1 in. cap', manufacturer: null, n: 2 }])
    expect(takeTotal(run)).toBe(2)
    expect(takeAddExtra(run, { partId: null, partName: ' ', manufacturer: null, n: 1 }).extras).toHaveLength(1)
    expect(takeAddExtra(run, { partId: null, partName: 'x', manufacturer: null, n: 0 }).extras).toHaveLength(1)
    run = takeRemoveExtra(run, 0)
    expect(run.extras).toEqual([])
  })
})

describe('the words', () => {
  it('names the run and the press with its count', () => {
    expect(takeStartLabel('G12')).toBe('Take from G12')
    expect(takeSaveLabel(start(toilets), 'G76', true)).toBe('Take 1 from G76')
    expect(takeSaveLabel(takeMark(start(toilets), 'text:kohler toilet', 0), 'G76', true)).toBe('Say how many')
    expect(takeSaveLabel(start(mixed), 'G12', false)).toBe('Tap what you take')
    expect(takeSaveLabel(takeMark(takeMark(start(mixed), 'text:elbow', 5), 'text:hanger', 1), 'G12', false)).toBe('Take 6 from G12')
  })

  it('says what the box has, what it will have left, and what is recorded as found', () => {
    expect(takeLineHint('G12', 24, 0)).toBe('G12 has 24')
    expect(takeLineHint('G12', 24, 2)).toBe('Taking 2. G12 will have 22 left.')
    expect(takeLineHint('G12', 1, 1)).toBe('Taking 1. G12 will have none left.')
    expect(takeLineHint('G12', 2, 3)).toBe('Taking 3. The app counted 2. The other 1 is recorded as found.')
    expect(takeLineHint('G12', 0, 2)).toBe('Taking 2. The app counted 0. The other 2 are recorded as found.')
  })

  it('offers only quick numbers under what the box has', () => {
    expect(takeQuicks(24)).toEqual([1, 2, 5, 10])
    expect(takeQuicks(6)).toEqual([1, 2, 5])
    expect(takeQuicks(1)).toEqual([])
    expect(takeQuicks(40, [2, 5, 10])).toEqual([2, 5, 10])
  })

  it('names a take’s photos', () => {
    expect(takePhotoWords('G12', 'before')).toBe('G12 as found')
    expect(takePhotoWords('G12', 'after')).toBe('G12 after a take')
  })

  it('says how a run ended', () => {
    expect(takeDoneWords(3, 'G12', true)).toBe('3 taken from G12. The photo after is kept.')
    expect(takeDoneWords(3, 'G12', false)).toBe('3 taken from G12. No photo after.')
  })
})

describe('the rows a take writes', () => {
  it('writes one Used row a line, in the box’s own order', () => {
    const run = takeMark(takeMark(start(mixed), 'text:hanger', 1), 'text:elbow', 2)
    expect(takeRows(run, mixed)).toEqual([
      { reason: 'used', partId: null, partName: 'Elbow', manufacturer: null, quantity: 2, fromContainerId: 'box', toContainerId: null, note: '' },
      { reason: 'used', partId: null, partName: 'Hanger', manufacturer: null, quantity: 1, fromContainerId: 'box', toContainerId: null, note: '' },
    ])
  })

  it('records what the app did not count as found, before it is taken, so the box never goes under zero', () => {
    const run = takeMark(start(mixed), 'text:hanger', 3)
    expect(takeRows(run, mixed)).toEqual([
      { reason: 'delivered', partId: null, partName: 'Hanger', manufacturer: null, quantity: 2, fromContainerId: null, toContainerId: 'box', note: TAKE_FOUND_NOTE },
      { reason: 'used', partId: null, partName: 'Hanger', manufacturer: null, quantity: 3, fromContainerId: 'box', toContainerId: null, note: '' },
    ])
  })

  it('records a part off the list as found and used', () => {
    const run = takeAddExtra(start(toilets), { partId: 'p9', partName: 'Wax ring', manufacturer: 'Oatey', n: 2 })
    const rows = takeRows(takeMark(run, 'text:kohler toilet', 0), toilets)
    expect(rows.map((r) => [r.reason, r.partName, r.quantity, r.note])).toEqual([
      ['delivered', 'Wax ring', 2, TAKE_FOUND_NOTE],
      ['used', 'Wax ring', 2, ''],
    ])
    expect(rows[0]!.partId).toBe('p9')
  })

  it('writes nothing for a run with nothing marked', () => {
    expect(takeRows(start(mixed), mixed)).toEqual([])
  })
})

describe('a run left half done', () => {
  it('closes by itself after twelve hours', () => {
    const run = start(mixed)
    const t0 = new Date(NOW).getTime()
    expect(takeIsStale(run, t0 + TAKE_OPEN_MS - 1)).toBe(false)
    expect(takeIsStale(run, t0 + TAKE_OPEN_MS + 1)).toBe(true)
    expect(takeIsStale({ startedAt: 'not a time' }, t0)).toBe(true)
  })

  it('says what was left and what each press does', () => {
    const open = takeLeftWords(start(mixed), 'G12')
    expect(open.main.startsWith('You started a take from G12 at ')).toBe(true)
    expect([open.sub, open.go, open.drop]).toEqual(['Nothing is taken yet.', 'Finish it', 'Nothing taken'])
    const saved = takeLeftWords(takeSaved(takeMark(start(mixed), 'text:elbow', 3), NOW), 'G12')
    expect(saved.main.startsWith('You took 3 from G12 at ')).toBe(true)
    expect([saved.sub, saved.go, saved.drop]).toEqual(['No photo of G12 after yet. The take is saved.', 'Take the photo', 'Finish without it'])
  })
})

describe('a ledger row’s take', () => {
  it('reads the take a row belongs to, or none', () => {
    const base = { id: 'm1', jobId: 'job', partId: null, partName: 'Elbow', manufacturer: null, quantity: 1, reason: 'used' as const, fromContainerId: 'box', toContainerId: null, note: '', byUserId: null, byName: '', at: NOW, source: null, itemId: null }
    expect(takeIdOf(base)).toBeNull()
    expect(takeIdOf({ ...base, takeId: 'take-1' } as never)).toBe('take-1')
  })
})
