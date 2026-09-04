import { describe, expect, it } from 'vitest'
import { buildSubsHqRows, groupUnattributedSheets } from './subsHqRows'
import type { SubsHqPersonInput, SubsHqSheetInput, UnattributedSheet } from './subsHqRows'

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
        sheet({ id: 'ghost', label: 'MIke Rodriguez sheet', assignedToName: ' MIke Rodriguez ', jobNumber: '892', items: [{ fixture: 'x', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 500 }] }),
        sheet({ id: 'both', label: 'shared', assignedToName: 'Behar Kraja | Kyle', items: [{ fixture: 'x', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 900 }] }),
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
      { sheetId: 'ghost', label: 'MIke Rodriguez sheet', jobNumber: '892', balance: 500, reason: 'unmatched', rawAssignedTo: 'MIke Rodriguez', archivedPersonName: null },
      { sheetId: 'both', label: 'shared', jobNumber: null, balance: 900, reason: 'shared', rawAssignedTo: 'Behar Kraja | Kyle', archivedPersonName: null },
    ])
  })

  it('classifies sheets matching an archived person as reason archived (name match and junction match)', () => {
    const EDGAR: SubsHqPersonInput = { id: 'p-edgar', name: 'Edgar', archived: true, accountUserId: null }
    const result = buildSubsHqRows({
      people: [BEHAR, EDGAR],
      users: [],
      sheets: [
        sheet({ id: 'by-name', label: '251 · 180 Go Away Rd', assignedToName: ' edgar ', jobNumber: '251' }),
        sheet({ id: 'by-junction', label: '273 · 9703 Lenox Hl', assignedToName: 'someone else', jobNumber: '273' }),
      ],
      assignees: [{ labor_job_id: 'by-junction', person_id: 'p-edgar' }],
      commitments: [],
      docs: [],
      todayYmd: TODAY,
    })
    expect(result.unattributed.map((u) => [u.sheetId, u.reason, u.archivedPersonName])).toEqual([
      ['by-name', 'archived', 'Edgar'],
      ['by-junction', 'archived', 'Edgar'],
    ])
  })

  it('does not classify archived when the archived name is ambiguous or shared with multiple owners', () => {
    const E1: SubsHqPersonInput = { id: 'p-e1', name: 'Edgar', archived: true, accountUserId: null }
    const E2: SubsHqPersonInput = { id: 'p-e2', name: 'edgar', archived: true, accountUserId: null }
    const result = buildSubsHqRows({
      people: [BEHAR, KYLE, E1, E2],
      users: [],
      sheets: [
        sheet({ id: 'ambig', label: 'ambiguous edgar', assignedToName: 'Edgar' }),
        sheet({ id: 'multi', label: 'two owners', assignedToName: 'Behar Kraja | Kyle' }),
      ],
      assignees: [
        { labor_job_id: 'multi', person_id: 'p-behar' },
        { labor_job_id: 'multi', person_id: 'p-kyle' },
      ],
      commitments: [],
      docs: [],
      todayYmd: TODAY,
    })
    const byId = new Map(result.unattributed.map((u) => [u.sheetId, u]))
    expect(byId.get('ambig')).toMatchObject({ reason: 'unmatched', archivedPersonName: null })
    expect(byId.get('multi')).toMatchObject({ reason: 'shared', archivedPersonName: null })
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
    expect(behar.generalConditions).toBe('none')
  })

  it('v2.2790: sheet work orders carry their sheet label; General Conditions standing reads the best signed copy', () => {
    const result = buildSubsHqRows({
      people: [BEHAR, KYLE],
      users: [],
      sheets: [],
      assignees: [],
      commitments: [{ person_id: 'p-behar', amount: 6400, status: 'offered', stepName: null, projectName: null, sheetLabel: 'J977 · 415 Springtown Way' }],
      docs: [
        { person_id: 'p-behar', person_name: null, doc_type: 'other', status: 'signed', expires_at: null, applied_contract_template_document_id: 'gc-doc', applied_version_date: '2026-03-02', document_name: 'General Conditions' },
        { person_id: 'p-behar', person_name: null, doc_type: 'other', status: 'signed', expires_at: null, applied_contract_template_document_id: null, applied_version_date: '2026-06-19', document_name: 'general conditions ' },
      ],
      todayYmd: TODAY,
      generalConditions: { documentId: 'gc-doc', documentName: 'General Conditions', bookVersionDate: '2026-06-19' },
    })
    const behar = result.rows.find((r) => r.personId === 'p-behar')!
    expect(behar.openCommitments[0]!.sheetLabel).toBe('J977 · 415 Springtown Way')
    expect(behar.generalConditions).toBe('current')
    expect(result.rows.find((r) => r.personId === 'p-kyle')!.generalConditions).toBe('unsigned')
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

describe('groupUnattributedSheets', () => {
  const entry = (overrides: Partial<UnattributedSheet> & { sheetId: string }): UnattributedSheet => ({
    label: 'x',
    jobNumber: null,
    balance: 0,
    reason: 'unmatched',
    rawAssignedTo: '',
    archivedPersonName: null,
    ...overrides,
  })

  it('groups by (label, raw name, reason) with dedupe count and summed balance', () => {
    const groups = groupUnattributedSheets([
      entry({ sheetId: 's1', label: '892 · 582 Curvatura', jobNumber: '892', rawAssignedTo: 'MIke Rodriguez', balance: 200 }),
      entry({ sheetId: 's2', label: '892 · 582 Curvatura', jobNumber: '892', rawAssignedTo: 'mike rodriguez', balance: 700 }),
      entry({ sheetId: 's3', label: '901 · 12 Oak', jobNumber: '901', rawAssignedTo: 'Behar | Kyle', reason: 'shared', balance: 500 }),
    ])
    expect(groups).toHaveLength(2)
    // Sorted by total open balance desc.
    expect(groups[0]).toMatchObject({
      label: '892 · 582 Curvatura',
      jobNumber: '892',
      reason: 'unmatched',
      sheetCount: 2,
      totalBalance: 900,
    })
    // Sheet ids ordered highest balance first (Open → targets the big one).
    expect(groups[0]?.sheetIds).toEqual(['s2', 's1'])
    expect(groups[1]).toMatchObject({ label: '901 · 12 Oak', reason: 'shared', sheetCount: 1, totalBalance: 500 })
  })

  it('same label with different raw names or reasons stays separate; ties sort by label', () => {
    const groups = groupUnattributedSheets([
      entry({ sheetId: 'a', label: 'same', rawAssignedTo: 'Ann', balance: 100 }),
      entry({ sheetId: 'b', label: 'same', rawAssignedTo: 'Bob', balance: 100 }),
      entry({ sheetId: 'c', label: 'same', rawAssignedTo: 'Ann', reason: 'shared', balance: 100 }),
    ])
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.totalBalance)).toEqual([100, 100, 100])
  })

  it('returns [] for no entries and keeps $0 groups', () => {
    expect(groupUnattributedSheets([])).toEqual([])
    const groups = groupUnattributedSheets([entry({ sheetId: 'z', label: 'zero', balance: 0 })])
    expect(groups[0]?.totalBalance).toBe(0)
  })
})
