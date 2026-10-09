import { describe, expect, it } from 'vitest'
import { bidStageOfLine, stageEarnedPaceWords, stageEarnedValue } from './stageEarnedValue'

describe('bidStageOfLine (v2.5046)', () => {
  it('reads the stage a billing line names, the way the linked jobs write them', () => {
    expect(bidStageOfLine('Rough in')).toBe('rough')
    expect(bidStageOfLine('ROUGH-IN')).toBe('rough')
    expect(bidStageOfLine('Top out')).toBe('top')
    expect(bidStageOfLine('Top-Out')).toBe('top')
    expect(bidStageOfLine('topout')).toBe('top')
    expect(bidStageOfLine('Top out, sewer line, water line and extra sewer line.')).toBe('top')
    expect(bidStageOfLine('Trim set')).toBe('trim')
    expect(bidStageOfLine('Trim out')).toBe('trim')
    expect(bidStageOfLine('Finish')).toBe('trim')
  })
  it('a line that names no stage, or two, maps to none', () => {
    for (const n of ['Plumbing per plans', 'Job total (migrated)', 'Lift', 'Repair broken main, post test', 'Rough and top out', 'Laptop', '', null]) expect(bidStageOfLine(n)).toBeNull()
  })
})

describe('stageEarnedValue (v2.5046)', () => {
  const hours = { rough: 120, top: 60, trim: 20 }
  it('earns each stage’s hours at its progress and holds them against the recorded hours', () => {
    const ev = stageEarnedValue({
      bidHoursByStage: hours,
      lines: [
        { name: 'Rough in', weightPct: 50, progressPct: 100 },
        { name: 'Top out', weightPct: 30, progressPct: 50 },
        { name: 'Trim set', weightPct: 20, progressPct: null },
      ],
      recordedHours: 200,
    })
    expect(ev.stages.map((s) => [s.stage, s.progressPct, s.earnedHours])).toEqual([['rough', 100, 120], ['top', 50, 30], ['trim', null, null]])
    expect(ev).toMatchObject({ bidHours: 200, earnedHours: 150, recordedHours: 200, read: 'partial', words: '150 h earned of 200 h bid · 200 h recorded', unmapped: [] })
    expect(stageEarnedPaceWords(ev)).toBe('1.33× the hours earned')
  })
  it('a stage of several lines takes their value-weighted progress; an unreported line of it counts as not started', () => {
    const ev = stageEarnedValue({
      bidHoursByStage: hours,
      lines: [
        { name: 'Rough in, building A', weightPct: 30, progressPct: 100 },
        { name: 'Rough in, building B', weightPct: 10, progressPct: null },
        { name: 'Top out', weightPct: 40, progressPct: 25 },
        { name: 'Trim', weightPct: 20, progressPct: 0 },
      ],
      recordedHours: 90,
    })
    expect(ev.stages[0]).toMatchObject({ progressPct: 75, earnedHours: 90, lines: ['Rough in, building A', 'Rough in, building B'] })
    expect(ev.earnedHours).toBe(105)
    expect(ev.read).toBe('complete')
  })
  it('names the lines that mean no stage, never guessing them into one', () => {
    const ev = stageEarnedValue({ bidHoursByStage: hours, lines: [{ name: 'Rough in', weightPct: 60, progressPct: 40 }, { name: 'Plumbing per plans', weightPct: 40, progressPct: 80 }], recordedHours: 10 })
    expect(ev.unmapped).toEqual(['Plumbing per plans'])
    expect(ev.earnedHours).toBe(48)
  })
  it('says why there is nothing to earn, never 0%', () => {
    expect(stageEarnedValue({ bidHoursByStage: null, lines: [{ name: 'Rough in', weightPct: 100, progressPct: 50 }], recordedHours: 5 })).toMatchObject({ read: 'no-stage-hours', words: 'the bid carries no hours by stage', earnedHours: null })
    expect(stageEarnedValue({ bidHoursByStage: hours, lines: [], recordedHours: 5 })).toMatchObject({ read: 'no-stage-lines', words: 'the job has no staged billing lines' })
    expect(stageEarnedValue({ bidHoursByStage: hours, lines: [{ name: 'Job total (migrated)', weightPct: 100, progressPct: null }], recordedHours: 5 })).toMatchObject({ read: 'no-stage-lines', words: 'no billing line names a stage' })
    // Today's data: every linked job has staged lines and none carries a report.
    expect(stageEarnedValue({ bidHoursByStage: hours, lines: [{ name: 'Rough in', weightPct: 50, progressPct: null }, { name: 'Trim set', weightPct: 50, progressPct: null }], recordedHours: 5 })).toMatchObject({ read: 'no-progress', words: 'no stage progress reported', earnedHours: null })
    expect(stageEarnedPaceWords({ earnedHours: null, recordedHours: 5 })).toBeNull()
  })
  it('progress is held to 0–100, and string hours from the server read as numbers', () => {
    const ev = stageEarnedValue({ bidHoursByStage: { rough: '40', top: null, trim: '-3' }, lines: [{ name: 'Rough in', weightPct: 100, progressPct: 140 }], recordedHours: -1 })
    expect(ev).toMatchObject({ bidHours: 40, earnedHours: 40, recordedHours: 0 })
    expect(ev.stages.map((s) => s.bidHours)).toEqual([40, 0, 0])
  })
})
