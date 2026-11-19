import { describe, expect, it } from 'vitest'
import { withLienClosedDays } from './lienClosedDays'
import { buildLienBoard } from './lienBoard'
import { buildLienClosedWindow, lienClosedFacts } from './lienClosedEnd'
import type { LienDeskItemRow } from './lienDesk'
import { buildLienAffidavitQueue, type LienAffidavitRow } from './lienDeskAffidavits'
import { lienDeskKeepRows } from './lienDeskStarted'

/** A made-up affidavit row, as either reader hands it over. */
const row = (jobId: string, deadline: string, over: Partial<LienAffidavitRow> = {}): LienAffidavitRow => ({
  job_id: jobId,
  last_month: '2026-06',
  deadline,
  is_sub: true,
  noticed: true,
  filed: false,
  open_balance: 1200,
  customer_id: 'c1',
  gc_customer_id: 'gc1',
  property_kind: 'non_residential',
  has_owner: true,
  has_legal: true,
  homestead: false,
  desk_item_id: null,
  desk_status: null,
  ...over,
})

describe('withLienClosedDays · the desk’s one list of affidavit rows', () => {
  it('puts the closed days after the windows rows, each row as it came', () => {
    const windows = [row('A', '2026-11-16'), row('B', '2026-12-15')]
    const closed = [row('C', '2026-08-17'), row('D', '2026-09-15')]
    expect(withLienClosedDays(windows, closed)).toEqual([...windows, ...closed])
  })

  it('with no closed days read (the reader not pushed yet, or a failed read) the windows rows stand alone', () => {
    const windows = [row('A', '2026-11-16')]
    expect(withLienClosedDays(windows, [])).toEqual(windows)
    expect(withLienClosedDays(windows, null)).toEqual(windows)
    expect(withLienClosedDays(windows, undefined)).toEqual(windows)
  })

  it('never lists a job twice: the windows row wins, and a closed day named twice keeps its first', () => {
    const windows = [row('A', '2026-10-15')]
    const closed = [row('A', '2026-10-15', { open_balance: 1 }), row('C', '2026-08-17'), row('C', '2026-08-17', { open_balance: 2 })]
    const out = withLienClosedDays(windows, closed)
    expect(out.map((r) => r.job_id)).toEqual(['A', 'C'])
    expect(out.map((r) => r.open_balance)).toEqual([1200, 1200])
  })

  it('leaves both inputs as they were', () => {
    const windows = [row('A', '2026-11-16')]
    const closed = [row('C', '2026-08-17')]
    withLienClosedDays(windows, closed)
    expect(windows).toHaveLength(1)
    expect(closed).toHaveLength(1)
  })
})

describe('a closed day on the desk · long past its day, it is kept and stands in Missed', () => {
  const TODAY = '2026-11-18'

  it('the desk keeps a row months past its day, with no paper on the job', () => {
    const rows = withLienClosedDays([row('A', '2026-12-15')], [row('C', '2026-07-15')])
    expect(lienDeskKeepRows(rows, [], 'affidavit', TODAY).map((r) => r.job_id)).toEqual(['A', 'C'])
  })

  it('the queue puts it in Missed with its days past, not in a pile that asks for a draft', () => {
    const queue = buildLienAffidavitQueue(withLienClosedDays([row('A', '2026-12-15')], [row('C', '2026-07-15'), row('D', '2026-10-15', { has_owner: false, noticed: false })]), [], TODAY)
    expect(queue.piles.missed.map((e) => e.jobId)).toEqual(['C', 'D'])
    expect(queue.piles.missed.map((e) => e.daysLeft)).toEqual([-126, -34])
    expect(queue.counts.missed).toBe(2)
    expect(queue.piles.to_draft.map((e) => e.jobId)).toEqual(['A'])
    expect(queue.piles.needs_property).toEqual([])
  })

  it('with an approved affidavit on the job it still stands in Missed: the pile rule of v2.7796 reads the day before the paper', () => {
    const paper = { id: 'it-c', job_id: 'C', kind: 'affidavit', months: [], status: 'approved', fields: {}, created_at: '2026-07-01T14:00:00Z', voided_at: null, sent_at: null } as unknown as LienDeskItemRow
    const queue = buildLienAffidavitQueue(withLienClosedDays([], [row('C', '2026-07-15', { desk_item_id: 'it-c', desk_status: 'approved' })]), [paper], TODAY)
    expect(queue.piles.missed.map((e) => [e.jobId, e.item?.status])).toEqual([['C', 'approved']])
    expect(queue.piles.ready).toEqual([])
    expect(queue.piles.held).toEqual([])
  })

  it('the Board draws it in the closed bin at the affidavits’ foot, and its chip opens the closed window on a passed lien day', () => {
    const queue = buildLienAffidavitQueue(withLienClosedDays([row('A', '2026-12-15')], [row('C', '2026-07-15')]), [], TODAY)
    const board = buildLienBoard({ todayYmd: TODAY, notices: [], affidavits: queue.entries, retainage: [], jobNumber: (id) => `JP${id}`, jobName: () => '', gcName: () => '' })
    const bin = board.affidavits.find((b) => b.key === 'affidavit:missed')!
    expect([bin.closed, bin.label]).toEqual([true, 'Lien day passed · not filed'])
    expect(bin.chips.map((c) => [c.label, c.urgency, c.atRisk, c.destination])).toEqual([['JPC', 'later', false, { kind: 'closed', jobId: 'C' }]])
    // Months past its day it is still the window for a passed lien day, with the day it had.
    const entry = queue.piles.missed[0]!
    const win = buildLienClosedWindow(lienClosedFacts({ number: 'JPC', name: '', gcName: '', unpaid: entry.openBalance, notice: null, affidavit: entry, collectionsSince: null, status: 'billed', role: 'assistant', lastWorkDoor: true }))!
    expect(win.kind).toBe('gone')
    expect(win.closed[0]).toBe('The last day to file a lien on this job was Wednesday, Jul 15.')
    expect(win.from.note).toContain('commercial property')
  })
})
