import { describe, expect, it } from 'vitest'
import { GC_DIFFICULTY_ASK_WORDS as W, gcDifficultyAskForJob, gcDifficultyAskGroups, type GcDifficultyOpenAsk } from './gcDifficultyAsk'

const ask = (jobId: string, customerId: string, closedAt: string): GcDifficultyOpenAsk => ({ jobId, customerId, customerName: `GC ${customerId}`, jobLabel: `Job ${jobId}`, closedAt })

describe('gcDifficultyAskGroups', () => {
  const asks = [ask('j1', 'a', '2026-11-10T15:00:00Z'), ask('j2', 'b', '2026-11-12T15:00:00Z'), ask('j3', 'a', '2026-11-14T15:00:00Z'), ask('j4', 'a', '2026-11-11T15:00:00Z')]
  it('folds the asks by GC, the GC whose job closed last first, and names the newest job', () => {
    const groups = gcDifficultyAskGroups(asks)
    expect(groups.map((g) => g.customerId)).toEqual(['a', 'b'])
    expect(groups[0]!.newest.jobId).toBe('j3')
    expect(groups[0]!.asks.map((a) => a.jobId)).toEqual(['j3', 'j4', 'j1'])
    expect(W.groupLine(groups[0]!)).toBe('Job j3 and 2 more jobs')
    expect(W.groupLine(groups[1]!)).toBe('Job j2')
  })
  it('is empty with nothing open', () => {
    expect(gcDifficultyAskGroups([])).toEqual([])
  })
})

describe('gcDifficultyAskForJob', () => {
  it('finds this job’s own ask, or nothing', () => {
    const asks = [ask('j1', 'a', '2026-11-10T15:00:00Z')]
    expect(gcDifficultyAskForJob(asks, 'j1')?.customerId).toBe('a')
    expect(gcDifficultyAskForJob(asks, 'j2')).toBeNull()
    expect(gcDifficultyAskForJob(asks, null)).toBeNull()
  })
})

describe('the words', () => {
  it('counts GCs on the board’s press and names the GC on the job’s line', () => {
    expect(W.boardPress(1)).toBe('Rate a GC after a job · 1')
    expect(W.boardPress(3)).toBe('Rate GCs after a job · 3')
    expect(W.jobLine('Seguin Ridge Builders')).toBe('This job is done. How was Seguin Ridge Builders to work with?')
    expect(W.jobLine(' ')).toBe('This job is done. How was this GC to work with?')
  })
})
