import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import { buildGcStageEntries, gcStageLine } from '../../../supabase/functions/_shared/gcStages'

const FIX = [
  { id: 'f-rough', name: 'Rough-in', sequence_order: 1 },
  { id: 'f-top', name: 'Top-out', sequence_order: 2 },
  { id: 'f-trim', name: 'Trim & final', sequence_order: 3 },
]
const W = (id: string, fixture: string, offered: boolean, bundle: string | null = null) => ({ id, job_id: 'j', fixture_id: fixture, window_start: '2026-09-22', window_end: '2026-10-02', offered_to_gc: offered, bundle_id: bundle })

describe('gcStages', () => {
  it('shows only offered windows, with who / when / percent and no money', () => {
    const entries = buildGcStageEntries({
      windows: [W('w-rough', 'f-rough', true), W('w-top', 'f-top', false)],
      fixtures: FIX,
      orders: [{ id: 'c1', stage_window_id: 'w-rough', status: 'accepted', display_name: 'Behar Kraja', picked_start: '2026-09-23', picked_end: '2026-09-24', labor_job_id: 's1' }],
      sheets: [{ id: 's1', stage: 'working', progress_pct: 50 }],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: 'w-rough', bundle: false, name: 'Rough-in', who: 'Behar', when: { start: '2026-09-23', end: '2026-09-24' }, pct: 50, state: 'working' })
    expect(JSON.stringify(entries)).not.toMatch(/amount|phone|\$/)
    expect(gcStageLine(entries[0]!)).toBe('Behar · 2026-09-23 – 2026-09-24 · 50% along')
  })

  it('folds a bundle into one entry with one window', () => {
    const entries = buildGcStageEntries({ windows: [W('w-top', 'f-top', true, 'b1'), W('w-trim', 'f-trim', true, 'b1')], fixtures: FIX, orders: [], sheets: [] })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: 'b1', bundle: true, name: 'Top-out + Trim & final', state: 'window', who: null })
    expect(gcStageLine(entries[0]!)).toBe('planned between 2026-09-22 – 2026-10-02')
  })

  it('reads an open offer as offered and hides the sub until signed', () => {
    const entries = buildGcStageEntries({ windows: [W('w-rough', 'f-rough', true)], fixtures: FIX, orders: [{ id: 'c1', stage_window_id: 'w-rough', status: 'offered', display_name: 'Behar Kraja', picked_start: null, picked_end: null, labor_job_id: null }], sheets: [] })
    expect(entries[0]).toMatchObject({ state: 'offered', who: null, when: null })
  })

  it('walks the states after signing', () => {
    const order = { id: 'c1', stage_window_id: 'w-rough', status: 'accepted', display_name: 'Behar Kraja', picked_start: '2026-09-23', picked_end: '2026-09-24', labor_job_id: 's1' }
    const at = (stage: string, pct: number | null) => buildGcStageEntries({ windows: [W('w-rough', 'f-rough', true)], fixtures: FIX, orders: [order], sheets: [{ id: 's1', stage, progress_pct: pct }] })[0]!.state
    expect(at('working', null)).toBe('scheduled')
    expect(at('working', 25)).toBe('working')
    expect(at('walkthrough', 100)).toBe('inspection')
    expect(at('customer_pay', 100)).toBe('passed')
  })
})
