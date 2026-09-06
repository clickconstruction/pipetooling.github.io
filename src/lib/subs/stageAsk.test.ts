import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import { answerPatch, askLine, askProblem, askState, pickStillFits, type StageAskWindow } from '../../../supabase/functions/_shared/stageAsk'

const base: StageAskWindow = { window_start: '2026-09-08', window_end: '2026-09-19', asked_start: '2026-09-22', asked_end: '2026-10-02', asked_note: 'framing slipped', asked_at: '2026-09-05T12:00:00Z', answered_at: null, answer: null, answer_note: null }

describe('stageAsk', () => {
  it('walks none → open → accepted / proposed', () => {
    expect(askState({ ...base, asked_at: null })).toBe('none')
    expect(askState(base)).toBe('open')
    expect(askState({ ...base, answered_at: 'x', answer: 'accepted' })).toBe('accepted')
    expect(askState({ ...base, answered_at: 'x', answer: 'proposed' })).toBe('proposed')
  })

  it('validates an ask', () => {
    expect(askProblem('2026-09-22', '2026-10-02', '2026-09-05')).toBeNull()
    expect(askProblem('2026-10-02', '2026-09-22', '2026-09-05')).toBe('The end comes before the start.')
    expect(askProblem('2026-08-01', '2026-08-05', '2026-09-05')).toBe('Those days are already behind us.')
    expect(askProblem('2026-09-22', '2027-03-01', '2026-09-05')).toBe('Ask for a span under four months.')
    expect(askProblem('', '2026-10-02', '2026-09-05')).toBe('Pick both days.')
  })

  it('writes the answer onto the window', () => {
    expect(answerPatch(base, { kind: 'accept' }, 'now')).toEqual({ window_start: '2026-09-22', window_end: '2026-10-02', window_by: 'gc', answered_at: 'now', answer: 'accepted', answer_note: null })
    expect(answerPatch(base, { kind: 'propose', start: '2026-09-24', end: '2026-10-02', note: ' crew is on 1009 until the 23rd ' }, 'now')).toEqual({ window_start: '2026-09-24', window_end: '2026-10-02', window_by: 'office', answered_at: 'now', answer: 'proposed', answer_note: 'crew is on 1009 until the 23rd' })
  })

  it('knows when a pick no longer fits', () => {
    expect(pickStillFits({ start: '2026-09-23', end: '2026-09-24' }, { start: '2026-09-22', end: '2026-10-02' })).toBe(true)
    expect(pickStillFits({ start: '2026-09-09', end: '2026-09-10' }, { start: '2026-09-22', end: '2026-10-02' })).toBe(false)
    expect(pickStillFits(null, { start: '2026-09-22', end: '2026-10-02' })).toBe(true)
  })

  it('words the GC line', () => {
    const f = (d: string) => d.slice(5)
    expect(askLine(base, f)).toBe('You asked for 09-22 – 10-02 · waiting on the office')
    expect(askLine({ ...base, answered_at: 'x', answer: 'accepted' }, f)).toBe('You asked for 09-22 – 10-02 · accepted')
    expect(askLine({ ...base, answered_at: 'x', answer: 'proposed', window_start: '2026-09-24', window_end: '2026-10-02', answer_note: 'crew on 1009' }, f)).toBe('You asked for 09-22 – 10-02 · the office answered 09-24 – 10-02 — crew on 1009')
    expect(askLine({ ...base, asked_at: null }, f)).toBeNull()
  })
})
