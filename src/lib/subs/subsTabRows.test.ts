import { describe, expect, it } from 'vitest'
import { buildSubsTabGroups, fixtureAmount, subsGroupMatches, type SubsFixtureLike } from './subsTabRows'
import type { WorkOrderBoardRow } from '../subWorkOrders/workOrderBoardRows'
import type { StageWindowLike } from './stageWindow'

const JOBS = [
  { id: 'j-1004', hcp_number: '1004', customer_name: 'Summit General', job_address: '2210 Goforth Rd' },
  { id: 'j-1009', hcp_number: '1009', customer_name: 'Mission Hills LLC', job_address: '88 Mission Hills Dr' },
  { id: 'j-1017', hcp_number: '1017', customer_name: 'Kyle Homes', job_address: '415 Bunton Creek Rd' },
]
const FIX: SubsFixtureLike[] = [
  { id: 'f-rough', job_id: 'j-1004', name: 'Rough-in', count: 1, line_unit_price: 12465, sequence_order: 1 },
  { id: 'f-top', job_id: 'j-1004', name: 'Top-out', count: 1, line_unit_price: 12465, sequence_order: 2 },
  { id: 'f-trim', job_id: 'j-1004', name: 'Trim & final', count: 2, line_unit_price: 8310, sequence_order: 3 },
  { id: 'f-1009', job_id: 'j-1009', name: 'Trim', count: 1, line_unit_price: 4200, sequence_order: 1 },
]
const WIN: StageWindowLike[] = [
  { id: 'w-rough', job_id: 'j-1004', fixture_id: 'f-rough', window_start: '2026-09-08', window_end: '2026-09-19', window_by: 'office' },
  { id: 'w-top', job_id: 'j-1004', fixture_id: 'f-top', window_start: '2026-09-22', window_end: '2026-09-27', window_by: 'office' },
  { id: 'w-1017', job_id: 'j-1017', fixture_id: 'f-missing', window_start: null, window_end: null, window_by: null },
]
const row = (over: Partial<WorkOrderBoardRow> & { key: string }): WorkOrderBoardRow =>
  ({
    sheetId: null,
    commitmentId: null,
    recordId: null,
    jobId: 'j-1004',
    jobNumber: '1004',
    primary: '#1004 · Summit General',
    secondary: '2210 Goforth Rd',
    notInPipeline: false,
    subNames: ['Behar Kraja'],
    subName: 'Behar Kraja',
    personId: 'p-behar',
    agreed: 12465,
    paid: 0,
    open: 12465,
    unpriced: false,
    sheetDate: null,
    coverage: { kind: 'none' },
    rail: { position: 3, group: 'signed' } as WorkOrderBoardRow['rail'],
    next: { label: '', hint: null, button: null, buttonLabel: null } as WorkOrderBoardRow['next'],
    group: 'signed',
    ...over,
  }) as WorkOrderBoardRow

describe('buildSubsTabGroups', () => {
  const board = [
    row({ key: 'sheet:s-rough', sheetId: 's-rough', commitmentId: 'c-rough', recordId: 'WO-1004-1', group: 'signed', rail: { position: 4, group: 'signed' } as WorkOrderBoardRow['rail'] }),
    row({ key: 'sheet:s-1009', sheetId: 's-1009', jobId: 'j-1009', jobNumber: '1009', primary: '#1009 · Mission Hills LLC', secondary: '88 Mission Hills Dr', group: 'no_agreement', rail: { position: 0, group: 'no_agreement' } as WorkOrderBoardRow['rail'], open: 4200, agreed: 4200 }),
    row({ key: 'order:c-loose', jobId: null, jobNumber: '', primary: 'Water heater · Kyle', secondary: null, commitmentId: 'c-loose', group: 'sent', rail: { position: 2, group: 'sent' } as WorkOrderBoardRow['rail'] }),
  ]
  const out = buildSubsTabGroups({ board, windows: WIN, windowIdByCommitmentId: new Map([['c-rough', 'w-rough']]), fixtures: FIX, jobs: JOBS })

  it('groups by job, attention first, unlinked last', () => {
    // every job owes one move, so newest job number first; unlinked orders last
    expect(out.groups.map((g) => g.key)).toEqual(['j-1017', 'j-1009', 'j-1004', 'unlinked:order:c-loose'])
    expect(out.groups[2]!.primary).toBe('#1004 · Summit General')
    expect(out.groups[2]!.attention).toBe(1) // Top-out stage row, no order yet
    expect(out.groups[1]!.attention).toBe(1) // 1009 sheet on a handshake
    expect(out.groups[3]!.primary).toBe('Water heater · Kyle')
  })

  it('puts stage rows above sheet rows and rides a claimed window on its sheet', () => {
    const g = out.groups[2]!
    expect(g.rows.map((r) => `${r.kind}:${r.stage?.name ?? '-'}`)).toEqual(['stage:Top-out', 'sheet:Rough-in'])
    const top = g.rows[0]!
    expect(top.kind).toBe('stage')
    expect(top.span).toEqual({ start: '2026-09-22', end: '2026-09-27' })
    expect(top.stage?.amount).toBe(12465)
    const rough = g.rows[1]!
    expect(rough.kind).toBe('sheet')
    expect(rough.window?.id).toBe('w-rough')
    expect(rough.board?.recordId).toBe('WO-1004-1')
  })

  it('lists the line items still free to become stages', () => {
    expect(out.groups[2]!.freeFixtures.map((f) => f.name)).toEqual(['Trim & final'])
    expect(out.groups[2]!.freeFixtures[0]!.amount).toBe(16620)
    expect(out.groups[1]!.freeFixtures.map((f) => f.name)).toEqual(['Trim'])
  })

  it('tolerates a window whose line item is gone and counts the strip', () => {
    const g = out.groups[0]!
    expect(g.rows[0]!.stage?.name).toBe('Line item')
    expect(g.rows[0]!.span).toBeNull()
    expect(out.counts).toEqual({ stagesOpen: 2, sheetsWithoutWindow: 2, offersOut: 1, signed: 1 })
  })

  it('searches job, sub, stage and WO number', () => {
    const g = out.groups[2]!
    expect(subsGroupMatches(g, 'summit')).toBe(true)
    expect(subsGroupMatches(g, 'top-out')).toBe(true)
    expect(subsGroupMatches(g, 'behar')).toBe(true)
    expect(subsGroupMatches(g, 'WO-1004')).toBe(true)
    expect(subsGroupMatches(g, 'mission')).toBe(false)
    expect(subsGroupMatches(g, '')).toBe(true)
  })

  it('prices a line item from count × unit price', () => {
    expect(fixtureAmount({ count: 2, line_unit_price: 8310 })).toBe(16620)
    expect(fixtureAmount({ count: 1, line_unit_price: null })).toBe(0)
  })
})
