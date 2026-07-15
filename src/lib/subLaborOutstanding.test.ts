import { describe, expect, it } from 'vitest'
import {
  buildSubLaborOutstandingByPerson,
  subLaborJobBalance,
  subLaborJobMatchesSearch,
} from './subLaborOutstanding'
import type { LaborJob } from '../types/laborJob'

function job(partial: Partial<LaborJob>): LaborJob {
  return {
    id: 'j1',
    assigned_to_name: 'Mike',
    address: '123 Main St',
    job_number: 'J100',
    labor_rate: 50,
    job_date: null,
    created_at: '2026-07-01',
    ...partial,
  }
}

describe('subLaborJobBalance', () => {
  it('standard job: items × rate minus paid minus backcharges', () => {
    const b = subLaborJobBalance(
      job({
        labor_rate: 50,
        items: [{ fixture: 'A', count: 2, hrs_per_unit: 3 }], // 2 × 3 × 50 = 300
        payments: [
          { id: 'p1', amount: 100, memo: null, created_at: '' },
          { id: 'p2', amount: -20, memo: null, created_at: '' }, // backcharge
        ],
      }),
    )
    expect(b.totalCost).toBe(300)
    expect(b.paid).toBe(100)
    expect(b.backcharges).toBe(20)
    expect(b.balance).toBe(180) // 300 - 100 - 20
  })

  it('reconstructs cost when no priced items but money moved (nets to 0)', () => {
    const b = subLaborJobBalance(
      job({
        items: [],
        payments: [
          { id: 'p1', amount: 200, memo: null, created_at: '' },
          { id: 'p2', amount: -50, memo: null, created_at: '' },
        ],
      }),
    )
    expect(b.totalCost).toBe(250) // reconstructed = paid + backcharges
    expect(b.balance).toBe(0)
  })

  it('over-paid job yields a negative balance', () => {
    const b = subLaborJobBalance(
      job({
        labor_rate: 50,
        items: [{ fixture: 'A', count: 1, hrs_per_unit: 2 }], // 100
        payments: [{ id: 'p1', amount: 130, memo: null, created_at: '' }],
      }),
    )
    expect(b.totalCost).toBe(100)
    expect(b.balance).toBe(-30)
  })

  it('no items and no payments is all zero', () => {
    const b = subLaborJobBalance(job({ items: [], payments: [] }))
    expect(b).toEqual({ totalCost: 0, paid: 0, backcharges: 0, balance: 0 })
  })
})

describe('subLaborJobMatchesSearch', () => {
  const names = { j100: 'Reliant Health' }
  const j = job({ assigned_to_name: 'Mike Z', job_number: 'J100', address: '55 Oak Ave' })

  it('empty query matches everything', () => {
    expect(subLaborJobMatchesSearch(j, '   ', names)).toBe(true)
  })
  it('matches contractor, hcp, address, and resolved job name (case-insensitive)', () => {
    expect(subLaborJobMatchesSearch(j, 'mike', names)).toBe(true)
    expect(subLaborJobMatchesSearch(j, 'j100', names)).toBe(true)
    expect(subLaborJobMatchesSearch(j, 'oak', names)).toBe(true)
    expect(subLaborJobMatchesSearch(j, 'reliant', names)).toBe(true)
  })
  it('non-match returns false', () => {
    expect(subLaborJobMatchesSearch(j, 'zzz', names)).toBe(false)
  })
})

describe('buildSubLaborOutstandingByPerson', () => {
  it('collapses case-differing names to one row, sums outstanding, keeps first-seen name', () => {
    const { rows } = buildSubLaborOutstandingByPerson([
      job({ id: 'a', assigned_to_name: 'Mike', labor_rate: 50, items: [{ fixture: 'x', count: 1, hrs_per_unit: 2 }], payments: [] }), // bal 100
      job({ id: 'b', assigned_to_name: 'mike', labor_rate: 50, items: [{ fixture: 'y', count: 1, hrs_per_unit: 1 }], payments: [] }), // bal 50
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Mike')
    expect(rows[0]!.outstanding).toBe(150)
    expect(rows[0]!.jobCount).toBe(2)
  })

  it('floors an over-paid job per job — it does not reduce a sibling job’s debt', () => {
    const { rows, totalOutstanding } = buildSubLaborOutstandingByPerson([
      job({ id: 'a', assigned_to_name: 'Mike', labor_rate: 50, items: [{ fixture: 'x', count: 1, hrs_per_unit: 2 }], payments: [] }), // bal +100
      job({ id: 'b', assigned_to_name: 'Mike', labor_rate: 50, items: [{ fixture: 'y', count: 1, hrs_per_unit: 1 }], payments: [{ id: 'p', amount: 200, memo: null, created_at: '' }] }), // bal -150 (skipped)
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.outstanding).toBe(100)
    expect(rows[0]!.jobCount).toBe(1)
    expect(totalOutstanding).toBe(100)
  })

  it('excludes a fully paid-off contractor', () => {
    const { rows } = buildSubLaborOutstandingByPerson([
      job({ assigned_to_name: 'Paid Pete', labor_rate: 50, items: [{ fixture: 'x', count: 1, hrs_per_unit: 2 }], payments: [{ id: 'p', amount: 100, memo: null, created_at: '' }] }), // bal 0
    ])
    expect(rows).toHaveLength(0)
  })

  it('groups blank names under one key', () => {
    const { rows } = buildSubLaborOutstandingByPerson([
      job({ id: 'a', assigned_to_name: '', labor_rate: 50, items: [{ fixture: 'x', count: 1, hrs_per_unit: 2 }], payments: [] }),
      job({ id: 'b', assigned_to_name: '', labor_rate: 50, items: [{ fixture: 'y', count: 1, hrs_per_unit: 1 }], payments: [] }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.key).toBe('')
    expect(rows[0]!.name).toBe('')
    expect(rows[0]!.outstanding).toBe(150)
  })

  it('sorts by outstanding desc with name tie-break, and row math holds', () => {
    const { rows, totalOutstanding } = buildSubLaborOutstandingByPerson([
      job({ id: 'a', assigned_to_name: 'Small', labor_rate: 50, items: [{ fixture: 'x', count: 1, hrs_per_unit: 1 }], payments: [] }), // 50
      job({ id: 'b', assigned_to_name: 'Big', labor_rate: 50, items: [{ fixture: 'y', count: 2, hrs_per_unit: 3 }], payments: [] }), // 300
    ])
    expect(rows.map((r) => r.name)).toEqual(['Big', 'Small'])
    // each row: outstanding === totalCost - paid
    for (const r of rows) expect(r.outstanding).toBe(r.totalCost - r.paid)
    expect(totalOutstanding).toBe(350)
  })

  it('parity: totalOutstanding equals the floored-per-job grand total over the same set', () => {
    const jobs = [
      job({ id: 'a', assigned_to_name: 'Mike', labor_rate: 50, items: [{ fixture: 'x', count: 1, hrs_per_unit: 2 }], payments: [{ id: 'p', amount: 30, memo: null, created_at: '' }] }), // 100-30 = 70
      job({ id: 'b', assigned_to_name: 'Jane', labor_rate: 40, items: [{ fixture: 'y', count: 2, hrs_per_unit: 2 }], payments: [] }), // 160
      job({ id: 'c', assigned_to_name: 'Over', labor_rate: 50, items: [{ fixture: 'z', count: 1, hrs_per_unit: 1 }], payments: [{ id: 'p', amount: 200, memo: null, created_at: '' }] }), // -150 floored
    ]
    const oldTotal = jobs.reduce((s, j) => {
      const b = subLaborJobBalance(j)
      return s + (b.balance > 0 ? b.balance : 0)
    }, 0)
    expect(buildSubLaborOutstandingByPerson(jobs).totalOutstanding).toBe(oldTotal)
    expect(oldTotal).toBe(230)
  })
})
