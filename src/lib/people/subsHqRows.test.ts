import { describe, expect, it } from 'vitest'
import { assignedNamesLabel, buildSubsHqRows, groupUnattributedSheets } from './subsHqRows'
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

  it('keeps the newest attributed sheet job date, paid date, or accepted offer as lastWorkedYmd (v2.2836)', () => {
    const result = buildSubsHqRows({
      people: [BEHAR, KYLE],
      users: [],
      sheets: [
        sheet({ id: 's1', jobDateYmd: '2026-06-10', paidAtYmd: '2026-07-02T15:00:00Z' }),
        sheet({ id: 's2', jobDateYmd: '2026-05-01' }),
        sheet({ id: 'ghost', label: 'nobody', assignedToName: 'Nobody', jobDateYmd: '2026-07-30' }),
      ],
      assignees: [
        { labor_job_id: 's1', person_id: 'p-behar' },
        { labor_job_id: 's2', person_id: 'p-behar' },
      ],
      commitments: [{ person_id: 'p-kyle', amount: 500, status: 'accepted', stepName: 'Top-out', projectName: null, acceptedAtYmd: '2026-07-20' }],
      docs: [],
      todayYmd: TODAY,
    })
    expect(result.rows.find((r) => r.personId === 'p-behar')?.lastWorkedYmd).toBe('2026-07-02')
    expect(result.rows.find((r) => r.personId === 'p-kyle')?.lastWorkedYmd).toBe('2026-07-20')
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

  it('counts a sheet paid in full as settled; an empty sheet or one with money open is not, and a sheet work order is not counted twice', () => {
    const fixed = (amount: number) => [{ fixture: 'Rough In', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: amount }]
    const result = buildSubsHqRows({
      people: [BEHAR],
      users: [],
      sheets: [
        sheet({ id: 'paid', items: fixed(1000), payments: [{ id: 'a', amount: 1000, memo: null, created_at: '2026-07-01' }] }),
        sheet({ id: 'paid-with-backcharge', items: fixed(500), payments: [{ id: 'b', amount: 450, memo: null, created_at: '2026-07-01' }, { id: 'c', amount: -50, memo: null, created_at: '2026-07-02' }] }),
        sheet({ id: 'open', items: fixed(800), payments: [{ id: 'd', amount: 300, memo: null, created_at: '2026-07-01' }] }),
        sheet({ id: 'empty' }),
      ],
      assignees: ['paid', 'paid-with-backcharge', 'open', 'empty'].map((labor_job_id) => ({ labor_job_id, person_id: 'p-behar' })),
      commitments: [{ person_id: 'p-behar', amount: 1000, status: 'settled', stepName: null, projectName: null, sheetLabel: 'paid' }],
      docs: [],
      todayYmd: TODAY,
    })
    const behar = result.rows[0]!
    expect(behar.sheetCount).toBe(4)
    expect(behar.settledCount).toBe(2)
    expect(behar.balanceDue).toBe(500)
  })

  it('v2.6486: a settled step work order and the paid sheet its settlement minted count once, not twice', () => {
    const fixed = (amount: number) => [{ fixture: 'Rough In — Dunmere Mallin', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: amount }]
    const result = buildSubsHqRows({
      people: [BEHAR],
      users: [],
      sheets: [sheet({ id: 'minted', items: fixed(3000), payments: [{ id: 'a', amount: 3000, memo: null, created_at: '2026-07-01' }] })],
      assignees: [{ labor_job_id: 'minted', person_id: 'p-behar' }],
      // settle_step_commitment keeps step_id on the order (so the tab passes no sheetLabel) and writes the sheet it minted to labor_job_id.
      commitments: [{ person_id: 'p-behar', amount: 3000, status: 'settled', stepName: 'Rough In', projectName: 'Dunmere Mallin', laborJobId: 'minted' }],
      docs: [],
      todayYmd: TODAY,
    })
    const behar = result.rows[0]!
    expect(behar.sheetCount).toBe(1)
    expect(behar.settledCount).toBe(1)
    expect(behar.balanceDue).toBe(0)
  })

  it('v2.6486: a settled step work order whose minted sheet is still unpaid counts once, on the order, and the sheet still owes', () => {
    const fixed = (amount: number) => [{ fixture: 'Rough In — Dunmere Mallin', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: amount }]
    const result = buildSubsHqRows({
      people: [BEHAR],
      users: [],
      sheets: [sheet({ id: 'minted', items: fixed(3000), payments: [] })],
      assignees: [{ labor_job_id: 'minted', person_id: 'p-behar' }],
      commitments: [{ person_id: 'p-behar', amount: 3000, status: 'settled', stepName: 'Rough In', projectName: 'Dunmere Mallin', laborJobId: 'minted' }],
      docs: [],
      todayYmd: TODAY,
    })
    const behar = result.rows[0]!
    expect(behar.sheetCount).toBe(1)
    expect(behar.settledCount).toBe(1)
    expect(behar.balanceDue).toBe(3000)
  })

  it('splits commitments into open (with total) and settled count; docs resolve id-first then name', () => {
    const result = buildSubsHqRows({
      people: [BEHAR],
      users: [],
      sheets: [],
      assignees: [],
      commitments: [
        { person_id: 'p-behar', amount: 6400, status: 'accepted', stepName: 'Top Out', projectName: 'Dunmere Mallin' },
        { person_id: 'p-behar', amount: 3000, status: 'settled', stepName: 'Rough In', projectName: 'Dunmere Mallin' },
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
      commitments: [{ person_id: 'p-behar', amount: 6400, status: 'offered', stepName: null, projectName: null, sheetLabel: 'J977 · 415 Stonewick Way' }],
      docs: [
        { person_id: 'p-behar', person_name: null, doc_type: 'other', status: 'signed', expires_at: null, applied_contract_template_document_id: 'gc-doc', applied_version_date: '2026-03-02', document_name: 'General Conditions' },
        { person_id: 'p-behar', person_name: null, doc_type: 'other', status: 'signed', expires_at: null, applied_contract_template_document_id: null, applied_version_date: '2026-06-19', document_name: 'general conditions ' },
      ],
      todayYmd: TODAY,
      generalConditions: { documentId: 'gc-doc', documentName: 'General Conditions', bookVersionDate: '2026-06-19' },
    })
    const behar = result.rows.find((r) => r.personId === 'p-behar')!
    expect(behar.openCommitments[0]!.sheetLabel).toBe('J977 · 415 Stonewick Way')
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

describe('assignedNamesLabel', () => {
  it('reads a piped multi-sub name as a list of people', () => {
    expect(assignedNamesLabel('Malachi | Abraham | Kyle | Austin Cutting & Coring LLC')).toBe('Malachi, Abraham, Kyle, Austin Cutting & Coring LLC')
    expect(assignedNamesLabel('Trace')).toBe('Trace')
    expect(assignedNamesLabel(' | Kyle |')).toBe('Kyle')
  })
})

/**
 * v2.7169: who a sheet is for is the Pay view's rule. Made-up people: one company sub with no login, one sub
 * with a subcontractor login, a teammate who carries kind `sub` behind a superintendent login, and a plumber
 * on the payroll who is not on the Subs page at all.
 */
describe('buildSubsHqRows: a sheet with several names counts once', () => {
  const CORE: SubsHqPersonInput = { id: 'p-core', name: 'Ridgeline Coring LLC', archived: false, accountUserId: null }
  const TILE: SubsHqPersonInput = { id: 'p-tile', name: 'Marlow Tile', archived: false, accountUserId: 'u-tile' }
  const HELPER: SubsHqPersonInput = { id: 'p-helper', name: 'Dana Whitlock', archived: false, accountUserId: 'u-helper' }
  const ROSTER = [
    { id: 'p-core', name: 'Ridgeline Coring LLC', kind: 'sub', accountRole: null },
    { id: 'p-tile', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
    { id: 'p-helper', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
    { id: 'p-plumber', name: 'Owen Farris', kind: 'master_technician', accountRole: 'master_technician' },
  ]
  const fixed = (amount: number) => [{ fixture: 'Cutting', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: amount }]
  const build = (sheets: SubsHqSheetInput[], assignees: Array<[string, string]>, opts: { roster?: typeof ROSTER | null; people?: SubsHqPersonInput[] } = {}) =>
    buildSubsHqRows({
      people: opts.people ?? [CORE, TILE, HELPER],
      users: [],
      sheets,
      assignees: assignees.map(([labor_job_id, person_id]) => ({ labor_job_id, person_id })),
      commitments: [],
      docs: [],
      todayYmd: TODAY,
      ...(opts.roster === null ? {} : { roster: opts.roster ?? ROSTER }),
    })
  const due = (result: ReturnType<typeof build>, personId: string) => result.rows.find((r) => r.personId === personId)?.balanceDue
  /** Every open dollar of every sheet, however it was attributed. */
  const everyDollar = (result: ReturnType<typeof build>) => result.rows.reduce((n, r) => n + r.balanceDue, 0) + result.unattributed.reduce((n, u) => n + u.balance, 0)

  it('a sub and two teammates: the whole sheet is the sub’s, once, and the teammates are owed nothing on it', () => {
    const result = build(
      [sheet({ id: 'mixed', assignedToName: 'Owen Farris | Dana Whitlock | Ridgeline Coring LLC', items: fixed(2150) })],
      [['mixed', 'p-plumber'], ['mixed', 'p-helper'], ['mixed', 'p-core']],
    )
    expect(due(result, 'p-core')).toBe(2150)
    expect(result.rows.find((r) => r.personId === 'p-core')?.sheetCount).toBe(1)
    expect(due(result, 'p-helper')).toBe(0)
    expect(result.rows.find((r) => r.personId === 'p-helper')?.sheetCount).toBe(0)
    expect(result.unattributed).toEqual([])
    expect(everyDollar(result)).toBe(2150)
  })

  it('before the roster is known the same sheet reads as shared, and it is still counted once', () => {
    const result = build(
      [sheet({ id: 'mixed', assignedToName: 'Dana Whitlock | Ridgeline Coring LLC', items: fixed(2150) })],
      [['mixed', 'p-helper'], ['mixed', 'p-core']],
      { roster: null },
    )
    expect(result.unattributed.map((u) => [u.reason, u.balance])).toEqual([['shared', 2150]])
    expect(everyDollar(result)).toBe(2150)
  })

  it('two subs on one sheet: it is on neither row, shared, and the dollars are not doubled', () => {
    const result = build(
      [sheet({ id: 'two-subs', assignedToName: 'Ridgeline Coring LLC | Marlow Tile', items: fixed(900) })],
      [['two-subs', 'p-core'], ['two-subs', 'p-tile']],
    )
    expect(due(result, 'p-core')).toBe(0)
    expect(due(result, 'p-tile')).toBe(0)
    expect(result.unattributed.map((u) => [u.sheetId, u.reason, u.balance])).toEqual([['two-subs', 'shared', 900]])
    expect(everyDollar(result)).toBe(900)
  })

  it('a payment on a sheet with a teammate comes off the one sheet once', () => {
    const result = build(
      [sheet({ id: 'mixed', items: fixed(1000), payments: [{ id: 'a', amount: 400, memo: null, created_at: '2026-07-01' }, { id: 'b', amount: -50, memo: 'cleanup', created_at: '2026-07-02' }] })],
      [['mixed', 'p-helper'], ['mixed', 'p-tile']],
    )
    expect(due(result, 'p-tile')).toBe(550)
    expect(result.rows.find((r) => r.personId === 'p-tile')?.backchargeTotal).toBe(50)
    expect(due(result, 'p-helper')).toBe(0)
    expect(everyDollar(result)).toBe(550)
  })

  it('a paid sheet with a teammate on it is the sub’s settled sheet, not a row to fix', () => {
    const result = build(
      [sheet({ id: 'paid', items: fixed(300), payments: [{ id: 'a', amount: 300, memo: null, created_at: '2026-07-01' }] })],
      [['paid', 'p-plumber'], ['paid', 'p-helper'], ['paid', 'p-core']],
    )
    expect(result.rows.find((r) => r.personId === 'p-core')).toMatchObject({ sheetCount: 1, settledCount: 1, balanceDue: 0 })
    expect(result.unattributed).toEqual([])
  })

  it('teammates and no sub: crew pay, in nobody’s balance and not a row to fix', () => {
    const result = build(
      [
        sheet({ id: 'crew', assignedToName: 'Owen Farris', items: fixed(4000) }),
        sheet({ id: 'crew-two', assignedToName: 'Owen Farris | Dana Whitlock', items: fixed(600) }),
      ],
      [['crew', 'p-plumber'], ['crew-two', 'p-plumber'], ['crew-two', 'p-helper']],
    )
    expect(result.rows.every((r) => r.balanceDue === 0 && r.sheetCount === 0)).toBe(true)
    expect(result.unattributed.map((u) => [u.sheetId, u.reason])).toEqual([['crew', 'crew'], ['crew-two', 'crew']])
  })

  it('one person written twice on a sheet is one person', () => {
    const result = build(
      [sheet({ id: 'twice', assignedToName: 'Marlow | Owen Farris | Marlow Tile', items: fixed(700) })],
      [['twice', 'p-tile'], ['twice', 'p-plumber'], ['twice', 'p-tile']],
    )
    expect(due(result, 'p-tile')).toBe(700)
    expect(result.rows.find((r) => r.personId === 'p-tile')?.sheetCount).toBe(1)
    expect(result.unattributed).toEqual([])
  })

  it('an archived sub with a teammate on the sheet reads as archived, not as crew pay', () => {
    const GONE: SubsHqPersonInput = { id: 'p-gone', name: 'Hollis Drain', archived: true, accountUserId: null }
    const result = build(
      [sheet({ id: 'old', assignedToName: 'Owen Farris | Hollis Drain', items: fixed(250) })],
      [['old', 'p-plumber'], ['old', 'p-gone']],
      { people: [CORE, GONE], roster: [...ROSTER, { id: 'p-gone', name: 'Hollis Drain', kind: 'sub', accountRole: null }] },
    )
    expect(result.unattributed.map((u) => [u.reason, u.archivedPersonName, u.balance])).toEqual([['archived', 'Hollis Drain', 250]])
  })

  it('a name the roster does not know stays unmatched, with or without a teammate beside it', () => {
    const result = build(
      [
        sheet({ id: 'ghost', assignedToName: 'Somebody New', items: fixed(500) }),
        sheet({ id: 'ghost-with', assignedToName: 'Somebody New | Owen Farris', items: fixed(100) }),
      ],
      [['ghost-with', 'p-plumber']],
    )
    // The second sheet resolves to a teammate alone, but the unknown name may be a sub: it stays a row to fix.
    expect(result.unattributed.map((u) => [u.sheetId, u.reason])).toEqual([['ghost', 'unmatched'], ['ghost-with', 'unmatched']])
  })

  it('across a mixed book every open dollar is in exactly one place', () => {
    const result = build(
      [
        sheet({ id: 'a', items: fixed(2150) }),
        sheet({ id: 'b', items: fixed(900) }),
        sheet({ id: 'c', items: fixed(4000) }),
        sheet({ id: 'd', items: fixed(1200), payments: [{ id: 'p', amount: 200, memo: null, created_at: '2026-07-01' }] }),
        sheet({ id: 'e', items: fixed(500) }),
      ],
      [['a', 'p-plumber'], ['a', 'p-helper'], ['a', 'p-core'], ['b', 'p-core'], ['b', 'p-tile'], ['c', 'p-plumber'], ['d', 'p-tile']],
    )
    expect(due(result, 'p-core')).toBe(2150)
    expect(due(result, 'p-tile')).toBe(1000)
    expect(everyDollar(result)).toBe(2150 + 900 + 4000 + 1000 + 500)
  })
})
