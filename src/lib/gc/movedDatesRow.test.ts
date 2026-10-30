import { describe, expect, it } from 'vitest'
import type { ScheduleWork, WorkDates } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { datesLeftForBlock, movedRow, movedRowsByLine, withSampleMoves } from './movedDatesRow'

const told = (over: Partial<WorkDates> = {}): WorkDates => ({
  moveId: 'move-1',
  toldOn: '2026-10-29',
  subject: 'Your dates moved on Sample Dental Office',
  lines: ['The schedule moved.'],
  reason: 'weather',
  note: 'Two days of rain held the drywall.',
  ...over,
})
const trim = { lineId: 'line-trim', work: 'Trim and fixtures' }

describe('movedRow', () => {
  it('a move later: the ghost of the old days, its label, and the chip with the reason and the note', () => {
    const row = movedRow(told(), { ...trim, from: { start: '2026-11-08', finish: '2026-11-14' }, to: { start: '2026-11-11', finish: '2026-11-17' } }, 'en')
    expect(row.direction).toBe('later')
    expect(row.days).toBe(3)
    expect(row.ghost).toEqual({ start: '2026-11-08', finish: '2026-11-14' })
    expect(row.wasLabel).toBe('was Nov 8 – Nov 14')
    expect(row.chip).toBe('moved 3 days later · weather · Two days of rain held the drywall.')
    expect(row.lineId).toBe('line-trim')
    expect(row.moveId).toBe('move-1')
  })

  it('a move earlier', () => {
    const row = movedRow(told({ reason: 'early', note: 'The drywall finished early.' }), { ...trim, from: { start: '2026-11-11', finish: '2026-11-17' }, to: { start: '2026-11-09', finish: '2026-11-15' } }, 'en')
    expect(row.direction).toBe('earlier')
    expect(row.days).toBe(2)
    expect(row.ghost).toEqual({ start: '2026-11-11', finish: '2026-11-17' })
    expect(row.chip).toBe('moved 2 days earlier · early · The drywall finished early.')
  })

  it('no move: no ghost, no label, the chip says only why', () => {
    const row = movedRow(told(), { ...trim, from: { start: '2026-11-11', finish: '2026-11-17' }, to: { start: '2026-11-11', finish: '2026-11-17' } }, 'en')
    expect(row.direction).toBe('none')
    expect(row.days).toBe(0)
    expect(row.ghost).toBeNull()
    expect(row.wasLabel).toBe('')
    expect(row.chip).toBe('weather · Two days of rain held the drywall.')
  })

  it('reads a finish that moved on its own, one day in words, and no reason or note', () => {
    const row = movedRow(told({ reason: undefined, note: '  ' }), { ...trim, from: { start: '2026-11-11', finish: '2026-11-17' }, to: { start: '2026-11-11', finish: '2026-11-18' } }, 'en')
    expect(row.direction).toBe('later')
    expect(row.days).toBe(1)
    expect(row.chip).toBe('moved 1 day later')
    expect(row.reason).toBeNull()
    expect(row.note).toBeNull()
  })

  it('speaks Spanish on a Spanish portal', () => {
    const row = movedRow(told(), { ...trim, from: { start: '2026-11-08', finish: '2026-11-14' }, to: { start: '2026-11-11', finish: '2026-11-17' } }, 'es')
    expect(row.wasLabel).toBe('era 8 nov – 14 nov')
    expect(row.chip).toBe('movido 3 días después · clima · Two days of rain held the drywall.')
    expect(movedRow(told({ reason: 'a word of our own' }), { ...trim, from: { start: '2026-11-08', finish: '2026-11-14' }, to: { start: '2026-11-09', finish: '2026-11-15' } }, 'es').chip).toBe('movido 1 día después · a word of our own · Two days of rain held the drywall.')
  })
})

describe('movedRowsByLine and datesLeftForBlock', () => {
  const newest = told({ moveId: 'move-2', moves: [{ ...trim, from: { start: '2026-11-11', finish: '2026-11-17' }, to: { start: '2026-11-12', finish: '2026-11-18' } }] })
  const older = told({ moveId: 'move-1', moves: [{ ...trim, from: { start: '2026-11-08', finish: '2026-11-14' }, to: { start: '2026-11-11', finish: '2026-11-17' } }, { lineId: 'line-paint', work: 'Paint', from: { start: '2026-11-18', finish: '2026-11-20' }, to: { start: '2026-11-19', finish: '2026-11-21' } }] })
  const wordsOnly = told({ moveId: 'move-0' })

  it('keeps one row per line, the newest move first', () => {
    const rows = movedRowsByLine([newest, older, wordsOnly], 'en')
    expect([...rows.keys()]).toEqual(['line-trim', 'line-paint'])
    expect(rows.get('line-trim')?.moveId).toBe('move-2')
    expect(rows.get('line-paint')?.moveId).toBe('move-1')
  })

  it('leaves the block the moves no row of the company’s draws', () => {
    const mine = new Set(['line-trim'])
    expect(datesLeftForBlock([newest, older, wordsOnly], mine).map((d) => d.moveId)).toEqual(['move-0'])
    expect(datesLeftForBlock([newest, older, wordsOnly], new Set()).map((d) => d.moveId)).toEqual(['move-2', 'move-1', 'move-0'])
  })
})

describe('withSampleMoves', () => {
  const work = (dates: WorkDates[]): ScheduleWork => ({ dates, late: [], lookAhead: [], crew: [] })
  it('lays the fixture’s moves over a sample answer that has none, by move id, and leaves the rest alone', () => {
    const fromFunction = { job: work([told({ moveId: 'move-1', reason: undefined, note: undefined })]) }
    const fixture = { job: work([told({ moveId: 'move-1', moves: [{ ...trim, from: { start: '2026-11-08', finish: '2026-11-14' }, to: { start: '2026-11-11', finish: '2026-11-17' } }] })]) }
    const out = withSampleMoves(fromFunction, fixture)
    expect(out.job?.dates[0]?.moves?.[0]?.lineId).toBe('line-trim')
    expect(out.job?.dates[0]?.reason).toBe('weather')
    expect(out.job?.dates[0]?.lines).toEqual(['The schedule moved.'])
    // A date that has its own keeps them; a job the fixture lacks is untouched.
    const own = { job: work([told({ moveId: 'move-1', moves: [] })]), other: work([told({ moveId: 'move-9' })]) }
    const kept = withSampleMoves(own, fixture)
    expect(kept.job?.dates[0]?.moves).toEqual([])
    expect(kept.other?.dates[0]?.moves).toBeUndefined()
  })
})
