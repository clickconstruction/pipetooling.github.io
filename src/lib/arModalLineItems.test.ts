import { describe, expect, it } from 'vitest'
import { buildArLineItemsByJob, type ArFixtureRow } from './arModalLineItems'

const row = (over: Partial<ArFixtureRow>): ArFixtureRow => ({
  job_id: 'j1',
  name: 'Fixture',
  count: 1,
  line_unit_price: 100,
  sequence_order: null,
  ...over,
})

describe('buildArLineItemsByJob', () => {
  it('groups billable lines by job with extended amounts', () => {
    const map = buildArLineItemsByJob([
      row({ job_id: 'j1', name: 'Water heater 50 gal', count: 2, line_unit_price: 1200, sequence_order: 1 }),
      row({ job_id: 'j1', name: 'Trim set', count: 1, line_unit_price: 800, sequence_order: 2 }),
      row({ job_id: 'j2', name: 'Gas line', count: 1, line_unit_price: 950, sequence_order: 1 }),
    ])
    expect(map.get('j1')).toEqual([
      { label: 'Water heater 50 gal ×2', amount: 2400 },
      { label: 'Trim set', amount: 800 },
    ])
    expect(map.get('j2')).toEqual([{ label: 'Gas line', amount: 950 }])
  })

  it('drops non-billable lines: empty name, zero/negative extended amount', () => {
    const map = buildArLineItemsByJob([
      row({ name: '   ' }),
      row({ name: 'Free line', line_unit_price: 0 }),
      row({ name: 'No count', count: 0 }),
      row({ name: 'Credit', count: 1, line_unit_price: -50 }),
      row({ name: 'Real', count: 1, line_unit_price: 10 }),
    ])
    expect(map.get('j1')).toEqual([{ label: 'Real', amount: 10 }])
  })

  it('orders by sequence_order with unsequenced last (then by name)', () => {
    const map = buildArLineItemsByJob([
      row({ name: 'Zeta unsequenced', sequence_order: null }),
      row({ name: 'Second', sequence_order: 2 }),
      row({ name: 'First', sequence_order: 1 }),
      row({ name: 'Alpha unsequenced', sequence_order: null }),
    ])
    expect((map.get('j1') ?? []).map((l) => l.label)).toEqual([
      'First',
      'Second',
      'Alpha unsequenced',
      'Zeta unsequenced',
    ])
  })

  it('null count treated as zero → dropped; jobs with no billable lines are absent', () => {
    const map = buildArLineItemsByJob([row({ job_id: 'j9', count: null })])
    expect(map.has('j9')).toBe(false)
  })
})
