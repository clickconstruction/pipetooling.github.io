import { describe, expect, it } from 'vitest'
import { buildSubsHqRows } from './subsHqRows'
import type { SubsHqPersonInput, SubsHqSheetInput } from './subsHqRows'

const TODAY = '2026-08-01'

const BEHAR: SubsHqPersonInput = { id: 'p-behar', name: 'Behar Kraja', archived: false, accountUserId: 'u-behar' }
const KYLE: SubsHqPersonInput = { id: 'p-kyle', name: 'Kyle', archived: false, accountUserId: null }

function sheet(overrides: Partial<SubsHqSheetInput> & { id: string }): SubsHqSheetInput {
  return { label: overrides.id, labor_rate: 0, items: [], payments: [], ...overrides }
}

describe('buildSubsHqRows', () => {
  it('attributes single-owner sheets via the junction and sums balances/backcharges', () => {
    const result = buildSubsHqRows({
      people: [BEHAR, KYLE],
      users: [{ id: 'u-behar', name: 'Behar', email: 'behar@x.com' }],
      sheets: [
        sheet({
          id: 's1',
          items: [{ fixture: 'Top Out — X', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 6400 }],
          payments: [
            { id: 'pay1', amount: 2000, memo: 'draw', created_at: '2026-07-28' },
            { id: 'pay2', amount: -150, memo: 'backcharge', created_at: '2026-07-29' },
          ],
        }),
      ],
      assignees: [{ labor_job_id: 's1', person_id: 'p-behar' }],
      commitments: [],
      docs: [],
      todayYmd: TODAY,
    })
    const behar = result.rows.find((r) => r.personId === 'p-behar')
    expect(behar?.sheetCount).toBe(1)
    expect(behar?.balanceDue).toBe(6400 - 2000 - 150)
    expect(behar?.backchargeTotal).toBe(150)
    expect(behar?.email).toBe('behar@x.com')
    expect(behar?.hasAccount).toBe(true)
    expect(result.unattributed).toEqual([])
  })

  it('routes unmatched and shared sheets to the unattributed bucket, never a row', () => {
    const result = buildSubsHqRows({
      people: [BEHAR, KYLE],
      users: [],
      sheets: [
        sheet({ id: 'ghost', label: 'MIke Rodriguez sheet', items: [{ fixture: 'x', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 500 }] }),
        sheet({ id: 'both', label: 'shared', items: [{ fixture: 'x', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 900 }] }),
      ],
      assignees: [
        { labor_job_id: 'both', person_id: 'p-behar' },
        { labor_job_id: 'both', person_id: 'p-kyle' },
      ],
      commitments: [],
      docs: [],
      todayYmd: TODAY,
    })
    expect(result.rows.every((r) => r.sheetCount === 0)).toBe(true)
    expect(result.unattributed).toEqual([
      { sheetId: 'ghost', label: 'MIke Rodriguez sheet', balance: 500, reason: 'unmatched' },
      { sheetId: 'both', label: 'shared', balance: 900, reason: 'shared' },
    ])
  })

  it('splits commitments into open (with total) and settled count; docs resolve id-first then name', () => {
    const result = buildSubsHqRows({
      people: [BEHAR],
      users: [],
      sheets: [],
      assignees: [],
      commitments: [
        { person_id: 'p-behar', amount: 6400, status: 'accepted', stepName: 'Top Out', projectName: 'Dudley Mason' },
        { person_id: 'p-behar', amount: 3000, status: 'settled', stepName: 'Rough In', projectName: 'Dudley Mason' },
        { person_id: 'p-behar', amount: 100, status: 'cancelled', stepName: null, projectName: null },
      ],
      docs: [
        { person_id: null, person_name: 'Behar Kraja', doc_type: 'agreement', status: 'signed', expires_at: null },
        { person_id: 'p-behar', person_name: null, doc_type: 'coi', status: 'signed', expires_at: '2026-08-10' },
      ],
      todayYmd: TODAY,
    })
    const behar = result.rows[0]!
    expect(behar.openCommitments).toHaveLength(1)
    expect(behar.committedTotal).toBe(6400)
    expect(behar.settledCount).toBe(1)
    expect(behar.badges.find((b) => b.key === 'agreement')?.state).toBe('ok')
    expect(behar.badges.find((b) => b.key === 'coi')?.state).toBe('expiring')
  })

  it('every active sub gets a row (compliance gaps visible), archived people are ignored', () => {
    const result = buildSubsHqRows({
      people: [KYLE, { id: 'p-edgar', name: 'Edgar', archived: true, accountUserId: null }],
      users: [],
      sheets: [],
      assignees: [],
      commitments: [],
      docs: [],
      todayYmd: TODAY,
    })
    expect(result.rows.map((r) => r.name)).toEqual(['Kyle'])
    expect(result.rows[0]?.badges.map((b) => b.state)).toEqual(['missing', 'missing', 'missing'])
  })
})
