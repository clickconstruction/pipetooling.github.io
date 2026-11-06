import { describe, expect, it } from 'vitest'
import { jobTargetWords, parseHours, targetDraftProblem } from './jobTarget'

const target = { id: 't', jobId: 'j', hours: 96, from: 110, by: 'Robert', at: '2026-11-01T15:00:00Z', why: 'framed in a week' }

describe('jobTargetWords', () => {
  it('reads an open target with who set it and why, and offers the change and the clear', () => {
    const w = jobTargetWords(target, 110, 'bid')
    expect(w.head).toBe('Target 96 h')
    expect(w.detail).toBe('Expected 96 h, set by Robert on Nov 1 (was 110 h): framed in a week')
    expect(w).toMatchObject({ counts: 96, press: 'Change the target' })
    expect(w.clearable).toBe(true)
  })

  it('falls back to the labor budget and names where it came from', () => {
    expect(jobTargetWords(null, 110, 'bid')).toMatchObject({ head: 'Target 110 h from the labor budget', detail: 'The labor budget is 110 h from the bid. Set a target to read a different number here.', counts: 110, press: 'Set a target', clearable: false })
    expect(jobTargetWords(null, 40.4, 'typed').detail).toContain('40 h typed by the office')
    expect(jobTargetWords(null, 12, null).detail).toContain('12 h on the Costs tab')
  })

  it('says no target yet when the job carries none', () => {
    expect(jobTargetWords(null, 0, null)).toEqual({ head: 'No target yet', detail: 'The crew’s hours against the target are counted once this is set.', counts: null, press: 'Set a target', clearable: false })
    expect(jobTargetWords(null, null, null).counts).toBeNull()
  })
})

describe('targetDraftProblem and parseHours', () => {
  it('asks for hours above zero and a reason of three to 240 characters', () => {
    expect(targetDraftProblem('', 'why not')).toBe('Type the hours the job should take.')
    expect(targetDraftProblem('0', 'why not')).toBe('Type the hours the job should take.')
    expect(targetDraftProblem('abc', 'why not')).toBe('Type the hours the job should take.')
    expect(targetDraftProblem('200000', 'why not')).toBe('That is more hours than a job takes.')
    expect(targetDraftProblem('96', 'ok')).toBe('Say why, in a few words. The crew reads it.')
    expect(targetDraftProblem('96', 'x'.repeat(241))).toBe('Keep the reason under 240 characters.')
    expect(targetDraftProblem('96 h', 'framed in a week')).toBeNull()
    expect(parseHours('96 h')).toBe(96)
    expect(parseHours('36.55')).toBe(36.6)
  })
})
