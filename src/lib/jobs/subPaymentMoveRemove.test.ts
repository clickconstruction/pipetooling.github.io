import { describe, it, expect } from 'vitest'
import {
  SUB_PAYMENT_REMOVE_REASONS,
  canUndoSubPaymentRemoval,
  planSubPaymentMove,
  rankSubPaymentMoveDestinations,
  sheetLabel,
  sheetMoney,
  subPaymentRemoveReasonText,
  subPaymentTraceLines,
} from './subPaymentMoveRemove'
import type { LaborJob, LaborJobPaymentEvent } from '../../types/laborJob'

const sheet = (p: Partial<LaborJob> & { id: string }): LaborJob => ({
  assigned_to_name: 'Airfordable Heating & Air Conditioning',
  address: '150 E Sonterra Blvd',
  job_number: '880',
  job_ledger_id: 'j880',
  labor_rate: 100,
  job_date: '2026-09-10',
  created_at: '2026-09-01T00:00:00Z',
  items: [{ fixture: 'HVAC rough', count: 42, hrs_per_unit: 1 }],
  payments: [],
  ...p,
})
const names = { j880: 'Reliant Health-HVAC', j922: 'Michael Palmer', j1001: 'Prospect Park Ph 2' }
const pay = (id: string, amount: number, memo: string | null = null) => ({ id, amount, memo, created_at: '2026-09-17T15:00:00Z', payment_date: '2026-09-17' })

const s880 = sheet({ id: 's880', payments: [pay('p1', 2000, 'ck#0401')] })
const s922 = sheet({ id: 's922', job_number: '922', job_ledger_id: 'j922', address: '4218 Ridgecrest Dr', items: [{ fixture: 'x', count: 20, hrs_per_unit: 1 }], payments: [] })
const s1001 = sheet({ id: 's1001', job_number: '1001', job_ledger_id: 'j1001', address: '200 Prospect Ave', job_date: '2026-09-12', items: [{ fixture: 'x', count: 64, hrs_per_unit: 1 }], payments: [pay('p9', 1000)] })
const behar = sheet({ id: 'sB', assigned_to_name: 'Behar Kraja', job_number: '901', job_ledger_id: null, address: '9 Oak Ln', items: [{ fixture: 'x', count: 10, hrs_per_unit: 1 }] })

describe('sheetMoney / sheetLabel', () => {
  it('reads the sheet the way the modal does', () => {
    expect(sheetMoney(s880)).toEqual({ totalCost: 4200, paid: 2000, backcharges: 0, balance: 2200 })
    expect(sheetMoney(sheet({ id: 'x', items: [], payments: [pay('a', 500), pay('b', -50)] }))).toEqual({ totalCost: 550, paid: 500, backcharges: 50, balance: 0 })
  })
  it('labels a sheet by number and job name, else address', () => {
    expect(sheetLabel(s880, names)).toBe('880 Reliant Health-HVAC')
    expect(sheetLabel(behar, names)).toBe('901 9 Oak Ln')
    expect(sheetLabel(sheet({ id: 'y', job_number: null, job_ledger_id: null, address: '1 Elm' }), names)).toBe('1 Elm')
  })
})

describe('planSubPaymentMove', () => {
  it('reads both sheets before and after, and flags a destination paid in full', () => {
    const plan = planSubPaymentMove(s880.payments![0]!, s880, s922, names)
    expect(plan.from).toEqual({ label: '880 Reliant Health-HVAC', paidBefore: 2000, paidAfter: 0, owedBefore: 2200, owedAfter: 4200 })
    expect(plan.to).toEqual({ label: '922 Michael Palmer', paidBefore: 0, paidAfter: 2000, owedBefore: 2000, owedAfter: 0 })
    expect(plan.toPaidInFull).toBe(true)
    expect(plan.isBackcharge).toBe(false)
  })
  it('a backcharge moves as a backcharge; owed never reads below zero', () => {
    const src = sheet({ id: 'src', payments: [pay('bc', -150, 'Cleanup')] })
    const plan = planSubPaymentMove(src.payments![0]!, src, s1001, names)
    expect(plan.isBackcharge).toBe(true)
    expect(plan.from.owedAfter).toBe(4200)
    expect(plan.to.paidAfter).toBe(1000)
    expect(plan.to.owedAfter).toBe(6400 - 1000 - 150)
    expect(plan.toPaidInFull).toBe(false)
  })
})

describe('rankSubPaymentMoveDestinations', () => {
  const sheets = [s880, s922, s1001, behar]
  const assignees = new Map<string, Array<{ personId: string }>>([
    ['s880', [{ personId: 'air' }]],
    ['s922', [{ personId: 'air' }]],
    ['sB', [{ personId: 'behar' }]],
  ])
  it('no search: the same sub only, newest first, by shared person or by name', () => {
    const out = rankSubPaymentMoveDestinations(sheets, 's880', assignees, names, '')
    expect(out.map((d) => d.sheet.id)).toEqual(['s1001', 's922'])
    expect(out.every((d) => d.sameSub)).toBe(true)
  })
  it('a search opens every sheet, same sub still first, never the current one', () => {
    const out = rankSubPaymentMoveDestinations(sheets, 's880', assignees, names, 'oak')
    expect(out.map((d) => [d.sheet.id, d.sameSub])).toEqual([['sB', false]])
    const byName = rankSubPaymentMoveDestinations(sheets, 's880', assignees, names, 'palmer')
    expect(byName.map((d) => d.sheet.id)).toEqual(['s922'])
    expect(rankSubPaymentMoveDestinations(sheets, 's880', assignees, names, '880')).toEqual([])
  })
  it('an unknown current sheet yields nothing', () => {
    expect(rankSubPaymentMoveDestinations(sheets, 'nope', assignees, names, '')).toEqual([])
  })
})

describe('reasons and undo', () => {
  it('three chips; the reason text joins chip and note', () => {
    expect(SUB_PAYMENT_REMOVE_REASONS.map((r) => r.key)).toEqual(['duplicate', 'wrong_amount', 'other'])
    expect(subPaymentRemoveReasonText('duplicate', '')).toBe('Duplicate entry')
    expect(subPaymentRemoveReasonText('other', ' typo ')).toBe('Something else — typo')
    expect(subPaymentRemoveReasonText(null, 'typo')).toBe('typo')
    expect(subPaymentRemoveReasonText(null, '')).toBeNull()
  })
  it('a removal is undoable for 30 days, once', () => {
    const ev = { kind: 'removed' as const, restored_event_id: null, created_at: '2026-09-17T15:00:00Z' }
    expect(canUndoSubPaymentRemoval(ev, '2026-10-16T15:00:00Z')).toBe(true)
    expect(canUndoSubPaymentRemoval(ev, '2026-10-17T15:00:01Z')).toBe(false)
    expect(canUndoSubPaymentRemoval({ ...ev, restored_event_id: 'r' }, '2026-09-18T00:00:00Z')).toBe(false)
    expect(canUndoSubPaymentRemoval({ ...ev, kind: 'moved' }, '2026-09-18T00:00:00Z')).toBe(false)
  })
})

describe('subPaymentTraceLines', () => {
  const ev = (p: Partial<LaborJobPaymentEvent> & { id: string; kind: LaborJobPaymentEvent['kind'] }): LaborJobPaymentEvent => ({
    payment_id: 'p1',
    from_job_id: 's880',
    to_job_id: null,
    amount: 2000,
    memo: null,
    payment_date: null,
    reason: 'wrong job',
    actor_name: 'Taunya',
    restored_event_id: null,
    created_at: '2026-09-17T15:00:00Z',
    ...p,
  })
  const sheetsById = new Map([s880, s922].map((s) => [s.id, s] as const))
  it('a move draws on both sheets; a removal on its sheet with undo; a restored removal draws nothing', () => {
    const events = [
      ev({ id: 'm1', kind: 'moved', to_job_id: 's922' }),
      ev({ id: 'r1', kind: 'removed', amount: 150, reason: 'Duplicate entry', created_at: '2026-09-10T15:00:00Z' }),
      ev({ id: 'r0', kind: 'removed', amount: 99, restored_event_id: 'x', created_at: '2026-09-01T15:00:00Z' }),
    ]
    const on880 = subPaymentTraceLines(events, 's880', sheetsById, names, '2026-09-18T00:00:00Z')
    expect(on880.map((l) => [l.kind, l.text, l.undoable])).toEqual([
      ['moved_out', 'Moved → 922 Michael Palmer · Taunya · wrong job', false],
      ['removed', 'Removed · Taunya · Duplicate entry', true],
    ])
    const on922 = subPaymentTraceLines(events, 's922', sheetsById, names, '2026-09-18T00:00:00Z')
    expect(on922.map((l) => [l.kind, l.text, l.otherSheetId])).toEqual([['moved_in', 'Moved here from 880 Reliant Health-HVAC · Taunya · wrong job', 's880']])
  })
  it('dates a line by the company calendar day, not the UTC day; same-day lines stay newest first', () => {
    // 8:50 PM Central on Sep 19 is already Sep 20 in UTC.
    const events = [
      ev({ id: 'm-eve', kind: 'moved', to_job_id: 's922', created_at: '2026-09-20T01:50:00Z' }),
      ev({ id: 'r-eve', kind: 'removed', amount: 5, created_at: '2026-09-20T01:55:00Z' }),
    ]
    const lines = subPaymentTraceLines(events, 's880', sheetsById, names, '2026-09-20T02:00:00Z')
    expect(lines.map((l) => [l.eventId, l.date])).toEqual([['r-eve', '2026-09-19'], ['m-eve', '2026-09-19']])
  })

  it('an unknown other sheet reads as another sheet; no actor or reason, no tail', () => {
    const lines = subPaymentTraceLines([ev({ id: 'm', kind: 'moved', to_job_id: 'gone', actor_name: null, reason: null })], 's880', sheetsById, names, '2026-09-18T00:00:00Z')
    expect(lines[0]?.text).toBe('Moved → another sheet')
  })
})
