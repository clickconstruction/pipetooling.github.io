import { describe, expect, it } from 'vitest'
import { shadowGateProgress, shadowStorySteps, type ShadowRunRow } from './shadowStory'

const run = (over: Partial<ShadowRunRow>): ShadowRunRow => ({
  id: 'r1',
  status: 'open',
  axis: 'bank-branch',
  created_at: '2026-08-31T00:00:00Z',
  locked_at: null,
  scored_at: null,
  shadow_bid_number: '420',
  reference_bid_number: '391',
  project_name: 'RBFCU',
  requested_by_name: null,
  reference_sent_at: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  ...over,
})

describe('shadowStorySteps', () => {
  it('open run: robot working, envelope not yet sealed', () => {
    const s = shadowStorySteps(run({}))
    expect(s.map((x) => x.state)).toEqual(['done', 'now', 'todo', 'todo', 'todo'])
    expect(s[0]!.label).toBe('Robot picked it up')
  })

  it('locked + requested: sealed step done with seal styling, waiting on our bid', () => {
    const s = shadowStorySteps(run({ status: 'locked', requested_by_name: 'Robert' }))
    expect(s[0]!.label).toBe('Requested by Robert')
    expect(s[2]).toMatchObject({ state: 'done', seal: true })
    expect(s[3]!.state).toBe('now')
    expect(s[4]!.state).toBe('todo')
  })

  it('scored: all done, delta chip labeled, close within 8%', () => {
    const s = shadowStorySteps(run({ status: 'scored', delta_pct: -4.2, reference_sent_at: '2026-08-30' }))
    expect(s.every((x) => x.state === 'done')).toBe(true)
    expect(s[4]!.label).toBe('-4.2% · close ✓')
    expect(s[2]!.seal).toBeFalsy()
  })

  it('scored miss beyond 8% gets no close mark', () => {
    const s = shadowStorySteps(run({ status: 'scored', delta_pct: 12.3 }))
    expect(s[4]!.label).toBe('+12.3%')
  })
})

describe('shadowGateProgress', () => {
  const scored = (id: string, at: string, delta: number, axis = 'bank-branch') =>
    run({ id, status: 'scored', scored_at: at, delta_pct: delta, axis })

  it('counts the streak from the most recent backward, per axis', () => {
    const runs = [
      scored('a', '2026-08-01', -3),
      scored('b', '2026-08-02', 12),
      scored('c', '2026-08-03', 4),
      scored('d', '2026-08-04', -7.9),
      scored('x', '2026-08-05', 1, 'warehouse'),
      run({ id: 'open1' }),
    ]
    const g = shadowGateProgress(runs, 'bank-branch')
    expect(g.pips).toEqual([true, false, true, true])
    expect(g.streak).toBe(2)
    expect(g.gateMet).toBe(false)
  })

  it('five consecutive hits meets the gate', () => {
    const runs = ['1', '2', '3', '4', '5'].map((d) => scored(d, `2026-08-0${d}`, 5))
    expect(shadowGateProgress(runs, 'bank-branch')).toMatchObject({ streak: 5, gateMet: true })
  })
})
