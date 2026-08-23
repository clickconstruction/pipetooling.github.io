import { describe, expect, it } from 'vitest'
import { buildUnlinkedSubLaborRows, sumUnlinkedSubLabor } from './subLaborUnlinked'

const jobs = [
  { id: 'j1', hcp_number: '977', click_number: null, job_name: 'Springtown', customer_name: null, job_address: '415 Springtown Way' },
  { id: 'j2', hcp_number: null, click_number: 'C-12', job_name: 'Click job', customer_name: null, job_address: null },
]

describe('buildUnlinkedSubLaborRows', () => {
  it('keeps sheets with no number or an unmatched number; drops linked ones', () => {
    const rows = buildUnlinkedSubLaborRows(
      [
        { id: 'a', assigned_to_name: 'Airfordable', address: '150 E Sonterra', job_number: null, job_date: '2026-08-06', labor_rate: null, items: [{ direct_labor_amount: 4200 }], payments: [] },
        { id: 'b', assigned_to_name: 'Behar Kraja | Kyle', address: '7722 Citadel Peak', job_number: 'H-2291', job_date: '2026-07-30', labor_rate: 20, items: [{ count: 5, hrs_per_unit: 2.5 }], payments: [{ amount: 250 }] },
        { id: 'c', assigned_to_name: 'Texas R & A', address: '415 Springtown Way', job_number: '977', job_date: '2026-08-20', labor_rate: null, items: [{ direct_labor_amount: 40000 }], payments: [] },
        { id: 'd', assigned_to_name: 'Sub', address: '', job_number: ' c-12 ', job_date: null, labor_rate: null, items: [], payments: [] },
      ],
      jobs,
    )
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows[0]).toMatchObject({ contractor: 'Airfordable', typedNumber: null, total: 4200, due: 4200 })
    expect(rows[1]).toMatchObject({ contractor: 'Behar Kraja, Kyle', typedNumber: 'H-2291', total: 250, paid: 250, due: 0 })
  })
  it('sorts newest labor date first, undated last, then by dollars; sums', () => {
    const rows = buildUnlinkedSubLaborRows(
      [
        { id: 'x', assigned_to_name: 'X', address: '', job_number: null, job_date: null, labor_rate: null, items: [{ direct_labor_amount: 10 }], payments: [] },
        { id: 'y', assigned_to_name: 'Y', address: '', job_number: null, job_date: '2026-01-01', labor_rate: null, items: [{ direct_labor_amount: 20 }], payments: [] },
        { id: 'z', assigned_to_name: 'Z', address: '', job_number: null, job_date: '2026-03-01', labor_rate: null, items: [{ direct_labor_amount: 30 }], payments: [{ amount: 5 }] },
      ],
      jobs,
    )
    expect(rows.map((r) => r.id)).toEqual(['z', 'y', 'x'])
    expect(sumUnlinkedSubLabor(rows)).toEqual({ total: 60, due: 55 })
  })
  it('a paid-but-empty sheet still counts its payments as the total', () => {
    const [r] = buildUnlinkedSubLaborRows(
      [{ id: 'p', assigned_to_name: 'P', address: '', job_number: null, job_date: null, labor_rate: null, items: [], payments: [{ amount: 100 }, { amount: -20 }] }],
      jobs,
    )
    expect(r).toMatchObject({ total: 120, paid: 100, backcharges: 20, due: 0 })
  })
})
