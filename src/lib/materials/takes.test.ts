import { describe, expect, it } from 'vitest'
import type { PhotoNote } from './photo'
import { TAKE_FOUND_NOTE, type TakeMovement } from './takeRun'
import { takeAsLeft, takeChip, takeFilterChips, takeLinesWords, takePasses, takeTitle, takesBefore, takesBeforeLabel, takesOf } from './takes'

let seq = 0
const row = (over: Partial<TakeMovement>): TakeMovement => ({ id: `m${++seq}`, jobId: 'job', partId: null, partName: 'Elbow', manufacturer: null, quantity: 1, reason: 'used', fromContainerId: 'g12', toContainerId: null, note: '', byUserId: 'u1', byName: 'Mateo', at: '2026-11-18T20:16:00Z', source: null, itemId: null, takeId: null, ...over })
const photo = (over: Partial<PhotoNote>): PhotoNote => ({ id: `p${++seq}`, jobId: 'job', containerId: 'g12', fileName: 'x.jpg', byUserId: 'u1', byName: 'Mateo', at: '2026-11-18T20:14:00Z', bytes: 1, width: 1, height: 1, status: 'filed', driveFileId: 'd', storagePath: null, kind: null, takeId: null, ...over })

describe('the takes of a job', () => {
  it('folds a take’s rows and photos into one line, and leaves out what belongs to no take', () => {
    const before = photo({ takeId: 't1', kind: 'before' })
    const after = photo({ takeId: 't1', kind: 'after', at: '2026-11-18T20:17:00Z' })
    const takes = takesOf(
      [row({ takeId: 't1', quantity: 2 }), row({ takeId: 't1', partName: 'Coupling', quantity: 4 }), row({ takeId: 't1', quantity: 1 }), row({ quantity: 9 }), row({ reason: 'counted', quantity: 30 })],
      [before, after, photo({})],
    )
    expect(takes).toHaveLength(1)
    expect(takes[0]).toMatchObject({ id: 't1', containerId: 'g12', byName: 'Mateo', at: '2026-11-18T20:16:00Z', count: 7, found: 0, state: 'whole' })
    expect(takes[0]!.lines).toEqual([{ partName: 'Elbow', quantity: 3 }, { partName: 'Coupling', quantity: 4 }])
    expect(takes[0]!.before).toBe(before)
    expect(takes[0]!.after).toBe(after)
  })

  it('says which photo is missing, and a take with photos and nothing marked', () => {
    const takes = takesOf(
      [row({ takeId: 'a' }), row({ takeId: 'b' }), row({ takeId: 'c' })],
      [photo({ takeId: 'a', kind: 'before' }), photo({ takeId: 'b', kind: 'after' }), photo({ takeId: 'd', kind: 'before', at: '2026-11-18T19:00:00Z' })],
    )
    const state = Object.fromEntries(takes.map((t) => [t.id, t.state]))
    expect(state).toEqual({ a: 'no-after', b: 'no-before', c: 'no-photos', d: 'nothing-marked' })
    // A take with nothing marked reads at its photo's time and names who took the photo.
    expect(takes.find((t) => t.id === 'd')).toMatchObject({ at: '2026-11-18T19:00:00Z', byName: 'Mateo', count: 0, containerId: 'g12' })
  })

  it('counts what the run recorded as found apart from what was taken', () => {
    const [t] = takesOf([row({ takeId: 't', reason: 'delivered', quantity: 2, fromContainerId: null, toContainerId: 'g12', note: TAKE_FOUND_NOTE }), row({ takeId: 't', quantity: 3 })], [])
    expect(t).toMatchObject({ count: 3, found: 2, containerId: 'g12' })
    expect(takeLinesWords(t!)).toBe('3 × Elbow · 2 recorded as found')
  })

  it('reads newest first and keeps the newest photo of a kind', () => {
    const older = photo({ takeId: 't2', kind: 'before', at: '2026-11-18T10:00:00Z' })
    const newer = photo({ takeId: 't2', kind: 'before', at: '2026-11-18T10:05:00Z' })
    const takes = takesOf([row({ takeId: 't1', at: '2026-11-17T09:00:00Z' }), row({ takeId: 't2', at: '2026-11-18T10:06:00Z' })], [older, newer])
    expect(takes.map((t) => t.id)).toEqual(['t2', 't1'])
    expect(takes[0]!.before).toBe(newer)
  })
})

describe('the box as the person before left it', () => {
  it('is the photo after of the newest earlier take of the same box', () => {
    const left = photo({ takeId: 't1', kind: 'after', at: '2026-11-12T15:00:00Z' })
    const takes = takesOf(
      [row({ takeId: 't0', at: '2026-11-10T09:00:00Z' }), row({ takeId: 't1', at: '2026-11-12T14:59:00Z' }), row({ takeId: 't2' }), row({ takeId: 'other', fromContainerId: 'g31', at: '2026-11-13T09:00:00Z' })],
      [photo({ takeId: 't0', kind: 'after', at: '2026-11-10T09:01:00Z' }), left, photo({ takeId: 'other', containerId: 'g31', kind: 'after', at: '2026-11-13T09:01:00Z' })],
    )
    const t2 = takes.find((t) => t.id === 't2')!
    expect(takeAsLeft(takes, t2)).toBe(left)
    expect(takeAsLeft(takes, takes.find((t) => t.id === 't0')!)).toBeNull()
  })
})

describe('the words and the filters', () => {
  const takes = takesOf([row({ takeId: 'a' }), row({ takeId: 'b' })], [photo({ takeId: 'a', kind: 'before' }), photo({ takeId: 'a', kind: 'after' }), photo({ takeId: 'c', kind: 'before' })])

  it('titles a take and chips its state', () => {
    expect(takeTitle(takes.find((t) => t.id === 'a')!, 'G12')).toBe('G12 · Mateo took 1')
    expect(takeTitle(takes.find((t) => t.id === 'c')!, 'G12')).toBe('G12 · Mateo started a take')
    expect(takeChip('whole')).toEqual({ words: 'Both photos', tone: 'green' })
    expect(takeChip('no-after')).toEqual({ words: 'No photo after', tone: 'amber' })
    expect(takeChip('no-before').words).toBe('No photo as found')
    expect(takeChip('no-photos').words).toBe('No photos')
    expect(takeChip('nothing-marked').words).toBe('Nothing marked')
  })

  it('counts each filter and passes the right takes', () => {
    expect(takeFilterChips(takes)).toEqual([{ key: 'all', words: 'All takes', n: 3 }, { key: 'photo-missing', words: 'A photo missing', n: 1 }, { key: 'nothing-marked', words: 'Nothing marked', n: 1 }])
    expect(takes.filter((t) => takePasses(t, 'photo-missing')).map((t) => t.id)).toEqual(['b'])
    expect(takes.filter((t) => takePasses(t, 'nothing-marked')).map((t) => t.id)).toEqual(['c'])
  })

  it('finds the takes behind a count: this box, up to the count, after the count before it', () => {
    const all = takesOf([row({ takeId: 'x', at: '2026-11-10T09:00:00Z' }), row({ takeId: 'y', at: '2026-11-15T09:00:00Z' }), row({ takeId: 'z', at: '2026-11-19T09:00:00Z' }), row({ takeId: 'q', fromContainerId: 'g31', at: '2026-11-15T09:00:00Z' })], [])
    expect(takesBefore(all, 'g12', '2026-11-18T00:00:00Z').map((t) => t.id)).toEqual(['y', 'x'])
    expect(takesBefore(all, 'g12', '2026-11-18T00:00:00Z', '2026-11-12T00:00:00Z').map((t) => t.id)).toEqual(['y'])
    expect(takesBeforeLabel(1)).toBe('1 take before this count')
    expect(takesBeforeLabel(3)).toBe('3 takes before this count')
  })
})
