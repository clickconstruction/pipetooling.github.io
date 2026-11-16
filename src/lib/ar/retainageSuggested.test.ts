import { describe, expect, it } from 'vitest'
import type { RetainageHeldInput } from './retainageHeld'
import type { RetainageJobFacts } from './retainageHeldRows'
import { noteSaysRetainage, retainageShareHeld, retainageSuggestion, retainageSuggestionWords, retainageUnrecordedRows, retainageUnrecordedWords } from './retainageSuggested'

const input = (partial: Partial<RetainageHeldInput> & { jobId: string }): RetainageHeldInput => ({
  applications: [],
  typedHeld: null,
  finishedOn: null,
  bills: [],
  releaseBillId: null,
  ...partial,
})

const facts = (rows: Array<[string, Partial<RetainageJobFacts>]>): Map<string, RetainageJobFacts> =>
  new Map(rows.map(([id, f]) => [id, { jobId: id, label: id.toUpperCase(), name: 'Cedar Hollow Clinic', address: '', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', billCount: 0, ...f }]))

const fmt = { money: (n: number) => `$${n.toLocaleString('en-US')}`, day: (d: string) => d }

describe('retainageShareHeld', () => {
  it('reads a bill paid at exactly 90% or 95% as 10% or 5% held', () => {
    expect(retainageShareHeld(9840, 8856)).toBe(10)
    expect(retainageShareHeld(3000, 2850)).toBe(5)
  })

  it('allows the cent a GC rounds its own check by', () => {
    // 95% of 1,234.50 is 1,172.775: the check reads 1,172.77 or 1,172.78.
    expect(retainageShareHeld(1234.5, 1172.77)).toBe(5)
    expect(retainageShareHeld(1234.5, 1172.78)).toBe(5)
    expect(retainageShareHeld(1234.5, 1172.7)).toBeNull()
  })

  it('reads nothing into a bill unpaid, paid in full, overpaid or paid at another share', () => {
    expect(retainageShareHeld(1000, 0)).toBeNull()
    expect(retainageShareHeld(1000, 1000)).toBeNull()
    expect(retainageShareHeld(1000, 1200)).toBeNull()
    expect(retainageShareHeld(4000, 3420)).toBeNull()
    expect(retainageShareHeld(0, 0)).toBeNull()
  })
})

describe('retainageSuggestion', () => {
  it('adds what each round-share bill left behind and names the one percent', () => {
    const s = retainageSuggestion([
      { id: 'b1', amount: 9840, paid: 8856 },
      { id: 'b2', amount: 9840, paid: 8856 },
      { id: 'b3', amount: 4920, paid: 4428 },
      { id: 'b4', amount: 310, paid: 310 },
    ])
    expect(s).toEqual({ held: 2460, percent: 10, billCount: 3, billIds: ['b1', 'b2', 'b3'] })
    expect(retainageSuggestionWords(s!)).toBe('3 bills paid at 90%')
  })

  it('leaves out a bill paid short by another share, and says one bill in the singular', () => {
    const s = retainageSuggestion([
      { id: 'b1', amount: 1234.5, paid: 1172.77 },
      { id: 'b2', amount: 640, paid: 548 },
    ])
    expect(s).toEqual({ held: 61.73, percent: 5, billCount: 1, billIds: ['b1'] })
    expect(retainageSuggestionWords(s!)).toBe('1 bill paid at 95%')
  })

  it('names no percent when the bills disagree', () => {
    const s = retainageSuggestion([
      { id: 'b1', amount: 1000, paid: 900 },
      { id: 'b2', amount: 1000, paid: 950 },
    ])
    expect(s?.percent).toBeNull()
    expect(s?.held).toBe(150)
    expect(retainageSuggestionWords(s!)).toBe('2 bills paid 5% or 10% short')
  })

  it('is null when no bill was paid at a round share', () => {
    expect(retainageSuggestion([{ id: 'b1', amount: 1000, paid: 1000 }, { id: 'b2', amount: 500 }])).toBeNull()
    expect(retainageSuggestion([])).toBeNull()
  })
})

describe('noteSaysRetainage', () => {
  it('hears retainage, retention and retained, in any case', () => {
    expect(noteSaysRetainage('complete and owed Retainage')).toBe(true)
    expect(noteSaysRetainage('they keep 5% retention')).toBe(true)
    expect(noteSaysRetainage('10% retained until final')).toBe(true)
  })

  it('does not hear a retainer, a retaining wall or an empty note', () => {
    expect(noteSaysRetainage('retainer paid to the attorney')).toBe(false)
    expect(noteSaysRetainage('leak behind the retaining wall')).toBe(false)
    expect(noteSaysRetainage(null)).toBe(false)
  })
})

describe('retainageUnrecordedRows', () => {
  const bills90 = [{ id: 'b1', amount: 1000, status: 'billed', paid: 900 }]

  it('lists a job with no answer whose bills or notes say retainage, largest figure first, notes alone after', () => {
    const rows = retainageUnrecordedRows(
      [
        input({ jobId: 'small', bills: [{ id: 'b', amount: 200, status: 'billed', paid: 190 }] }),
        input({ jobId: 'note-old' }),
        input({ jobId: 'big', bills: bills90 }),
        input({ jobId: 'note-new' }),
        input({ jobId: 'quiet', bills: [{ id: 'q', amount: 500, status: 'paid', paid: 500 }] }),
      ],
      facts([['small', {}], ['big', {}], ['note-old', {}], ['note-new', {}], ['quiet', {}]]),
      [
        { jobId: 'note-old', day: '2026-08-14' },
        { jobId: 'note-new', day: '2026-09-02' },
        { jobId: 'note-new', day: '2026-09-21' },
        { jobId: 'big', day: '2026-09-08' },
      ],
    )
    expect(rows.map((r) => r.jobId)).toEqual(['big', 'small', 'note-new', 'note-old'])
    expect(rows[0]).toMatchObject({ label: 'BIG', heldBy: 'Bluebonnet Commercial Builders', noteDay: '2026-09-08' })
    expect(rows[0]!.suggestion?.held).toBe(100)
    expect(rows[2]).toMatchObject({ suggestion: null, noteDay: '2026-09-21' })
  })

  it('skips a job that already has an answer: a typed figure, a typed zero or a pay application', () => {
    const rows = retainageUnrecordedRows(
      [
        input({ jobId: 'typed', typedHeld: 100, bills: bills90 }),
        input({ jobId: 'none', typedHeld: 0, bills: bills90 }),
        input({ jobId: 'app', bills: bills90, applications: [{ applicationNumber: 1, retainageHeld: 100, updatedAt: null }] }),
      ],
      facts([]),
      [{ jobId: 'typed', day: '2026-09-01' }],
    )
    expect(rows).toEqual([])
  })

  it('says why in one line', () => {
    const [both, noteOnly] = retainageUnrecordedRows(
      [input({ jobId: 'a', bills: bills90 }), input({ jobId: 'b' })],
      facts([['a', {}], ['b', {}]]),
      [
        { jobId: 'a', day: '2026-09-08' },
        { jobId: 'b', day: '2026-09-21' },
      ],
    )
    expect(retainageUnrecordedWords(both!, fmt)).toBe('$100 looks held · 1 bill paid at 90% · a note of 2026-09-08 says retainage')
    expect(retainageUnrecordedWords(noteOnly!, fmt)).toBe('a note of 2026-09-21 says retainage · no figure yet')
  })
})
