import { describe, expect, it } from 'vitest'
import { foldSameDayRuns, foldRun, FOLD_RUN_MIN } from './historyFolds'
import type { ChangeLine } from './whatChanged'

const day = (iso: string) => iso.slice(0, 10)
function line(over: Partial<ChangeLine> & { id: string; at: string }): ChangeLine {
  return { kind: 'note', verb: 'Note', about: { kind: 'job', id: 'j629', label: 'JP629 Rough in' }, detail: 'Combined a shell into this job', by: 'Robert', waitingDays: null, ...over }
}

describe('foldSameDayRuns', () => {
  it('folds three or more neighbouring notes on one piece by one person on one day into one line with the count', () => {
    const lines = [
      line({ id: 'n1', at: '2026-11-01T15:00:00Z', detail: 'Combined Job #130 into this job' }),
      line({ id: 'n2', at: '2026-11-01T14:59:00Z', detail: 'Combined Job #178 into this job' }),
      line({ id: 'n3', at: '2026-11-01T14:58:00Z', detail: 'Combined Job #422 into this job' }),
      line({ id: 'other', at: '2026-10-30T10:00:00Z', kind: 'paid', verb: 'Paid', detail: '$1,000' }),
    ]
    const out = foldSameDayRuns(lines, day)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: 'fold:n1', at: '2026-11-01T15:00:00Z', kind: 'note', verb: 'Note', by: 'Robert', foldedCount: 3 })
    expect(out[0]!.detail).toBe('3 notes this day:\nCombined Job #130 into this job\nCombined Job #178 into this job\nCombined Job #422 into this job')
    expect(out[0]!.folded?.map((l) => l.id)).toEqual(['n1', 'n2', 'n3'])
    expect(out[1]!.id).toBe('other')
  })

  it('identical details read once with the count, as the five Ready to Bill moves do', () => {
    const lines = Array.from({ length: 5 }, (_, i) => line({ id: `s${i}`, at: `2026-11-01T14:0${i}:00Z`, kind: 'stage', verb: 'Ready to Bill', detail: 'moved from Paid', by: null }))
    const out = foldSameDayRuns(lines, day)
    expect(out).toHaveLength(1)
    expect(out[0]!.detail).toBe('moved from Paid · 5 stage moves this day')
  })

  it('two lines stay as they are; the minimum is three', () => {
    const lines = [line({ id: 'a', at: '2026-11-01T15:00:00Z' }), line({ id: 'b', at: '2026-11-01T14:00:00Z' })]
    expect(foldSameDayRuns(lines, day).map((l) => l.id)).toEqual(['a', 'b'])
    expect(FOLD_RUN_MIN).toBe(3)
  })

  it('a different day, piece, person or verb breaks the run; a line of another kind between two keeps them apart', () => {
    const lines = [
      line({ id: 'a', at: '2026-11-01T15:00:00Z' }),
      line({ id: 'b', at: '2026-11-01T14:00:00Z' }),
      line({ id: 'c', at: '2026-11-01T13:00:00Z', by: 'Taunya' }),
      line({ id: 'd', at: '2026-11-01T12:00:00Z' }),
      line({ id: 'e', at: '2026-11-01T11:00:00Z' }),
      line({ id: 'f', at: '2026-10-31T23:00:00Z' }),
      line({ id: 'g', at: '2026-10-31T22:00:00Z', about: { kind: 'job', id: 'j1', label: 'JP1' } }),
    ]
    expect(foldSameDayRuns(lines, day).map((l) => l.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    const withBreak = [line({ id: 'a', at: '2026-11-01T15:00:00Z' }), line({ id: 'b', at: '2026-11-01T14:30:00Z' }), line({ id: 'x', at: '2026-11-01T14:10:00Z', kind: 'paid', verb: 'Paid' }), line({ id: 'c', at: '2026-11-01T14:00:00Z' })]
    expect(foldSameDayRuns(withBreak, day).map((l) => l.id)).toEqual(['a', 'b', 'x', 'c'])
  })

  it('questions, answers and kept entries never fold, and an open question with its age never folds', () => {
    const asks = Array.from({ length: 4 }, (_, i) => line({ id: `q${i}`, at: `2026-11-01T14:0${i}:00Z`, kind: 'asked', verb: 'Asked', detail: 'Which fixture?' }))
    expect(foldSameDayRuns(asks, day)).toHaveLength(4)
    const entries = Array.from({ length: 4 }, (_, i) => line({ id: `e${i}`, at: `2026-11-01T14:0${i}:00Z`, kind: 'entry', verb: 'Email', detail: 'A mail' }))
    expect(foldSameDayRuns(entries, day)).toHaveLength(4)
    const waiting = Array.from({ length: 4 }, (_, i) => line({ id: `w${i}`, at: `2026-11-01T14:0${i}:00Z`, waitingDays: 2 }))
    expect(foldSameDayRuns(waiting, day)).toHaveLength(4)
  })

  it('the day comes from the caller, so a stamp near midnight folds by the app day and not the browser day', () => {
    const lines = [line({ id: 'a', at: '2026-11-02T03:00:00Z' }), line({ id: 'b', at: '2026-11-02T02:00:00Z' }), line({ id: 'c', at: '2026-11-01T23:30:00Z' })]
    // In Chicago all three are Nov 1 evening.
    const chicago = () => '2026-11-01'
    expect(foldSameDayRuns(lines, chicago)).toHaveLength(1)
    expect(foldSameDayRuns(lines, day)).toHaveLength(3)
  })

  it('foldRun with no details says only the count', () => {
    const run = [line({ id: 'a', at: '2026-11-01T15:00:00Z', detail: null }), line({ id: 'b', at: '2026-11-01T14:00:00Z', detail: null }), line({ id: 'c', at: '2026-11-01T13:00:00Z', detail: null })]
    expect(foldRun(run).detail).toBe('3 notes this day')
  })
})
