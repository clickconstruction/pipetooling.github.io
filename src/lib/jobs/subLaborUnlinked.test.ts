import { describe, expect, it } from 'vitest'
import { buildUnlinkedSubLaborRows, sumUnlinkedSubLabor, unlinkedSheetAge } from './subLaborUnlinked'

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
        // v2.3065: linked by id — the number text is irrelevant
        { id: 'e', assigned_to_name: 'Sub', address: '', job_number: 'NOPE', job_ledger_id: 'j1', job_date: null, labor_rate: null, items: [{ direct_labor_amount: 5 }], payments: [] },
      ],
      jobs,
    )
    // Oldest labor date first (punch list #184 sweep B): b's Jul 30 before a's Aug 6.
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
    expect(rows[1]).toMatchObject({ contractor: 'Airfordable', typedNumber: null, total: 4200, due: 4200 })
    expect(rows[0]).toMatchObject({ contractor: 'Behar Kraja, Kyle', typedNumber: 'H-2291', total: 250, paid: 250, due: 0 })
  })
  it('sorts oldest labor date first, undated last, then by dollars; sums (punch list #184 sweep B)', () => {
    const rows = buildUnlinkedSubLaborRows(
      [
        { id: 'x', assigned_to_name: 'X', address: '', job_number: null, job_date: null, labor_rate: null, items: [{ direct_labor_amount: 10 }], payments: [] },
        { id: 'y', assigned_to_name: 'Y', address: '', job_number: null, job_date: '2026-01-01', labor_rate: null, items: [{ direct_labor_amount: 20 }], payments: [] },
        { id: 'z', assigned_to_name: 'Z', address: '', job_number: null, job_date: '2026-03-01', labor_rate: null, items: [{ direct_labor_amount: 30 }], payments: [{ amount: 5 }] },
        { id: 'z-big', assigned_to_name: 'Z2', address: '', job_number: null, job_date: '2026-03-01', labor_rate: null, items: [{ direct_labor_amount: 900 }], payments: [] },
        { id: 'x-big', assigned_to_name: 'X2', address: '', job_number: null, job_date: null, labor_rate: null, items: [{ direct_labor_amount: 500 }], payments: [] },
      ],
      jobs,
    )
    expect(rows.map((r) => r.id)).toEqual(['y', 'z-big', 'z', 'x-big', 'x'])
    expect(sumUnlinkedSubLabor(rows)).toEqual({ total: 1460, due: 1455 })
  })
  it('the age chip reads whole days from the labor date on the UNLINKED_SHEET_AGE scale; an undated sheet has none', () => {
    expect(unlinkedSheetAge({ dateYmd: '2026-10-26' }, '2026-10-26')).toEqual({ days: 0, state: 'fresh', label: 'today' })
    expect(unlinkedSheetAge({ dateYmd: '2026-10-20' }, '2026-10-26')).toEqual({ days: 6, state: 'fresh', label: '6 days waiting' })
    expect(unlinkedSheetAge({ dateYmd: '2026-10-19' }, '2026-10-26')).toEqual({ days: 7, state: 'amber', label: '7 days waiting' })
    expect(unlinkedSheetAge({ dateYmd: '2026-10-12' }, '2026-10-26')).toEqual({ days: 14, state: 'red', label: '14 days waiting' })
    expect(unlinkedSheetAge({ dateYmd: null }, '2026-10-26')).toBeNull()
  })
  it('a paid-but-empty sheet still counts its payments as the total', () => {
    const [r] = buildUnlinkedSubLaborRows(
      [{ id: 'p', assigned_to_name: 'P', address: '', job_number: null, job_date: null, labor_rate: null, items: [], payments: [{ amount: 100 }, { amount: -20 }] }],
      jobs,
    )
    expect(r).toMatchObject({ total: 120, paid: 100, backcharges: 20, due: 0 })
  })
})
