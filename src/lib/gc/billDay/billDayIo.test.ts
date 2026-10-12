/**
 * Bill day's reads and writes (`billDayIo.ts`): the rows mapped to the kernels' shapes, each read by its table and ids in
 * chunks, the cut-off read with its default, and each press carried to its function with its arguments, its refusal
 * thrown in its words. The client is a stub that records every call and answers what each test sets.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => ({
  from: [] as { table: string; ops: [string, unknown[]][] }[],
  rpc: [] as { fn: string; args: unknown }[],
  answer: { data: [] as unknown, error: null as unknown },
  /** Per table, when a test reads two tables. */
  byTable: {} as Record<string, { data: unknown; error: unknown }>,
  rpcAnswer: { data: null as unknown, error: null as unknown },
}))

vi.mock('../../supabase', () => {
  const builder = (rec: { table: string; ops: [string, unknown[]][] }): unknown =>
    new Proxy(
      {},
      {
        get: (_t, key) =>
          key === 'then'
            ? (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(seen.byTable[rec.table] ?? seen.answer).then(ok, bad)
            : (...args: unknown[]) => {
                rec.ops.push([String(key), args])
                return builder(rec)
              },
      },
    )
  return {
    supabase: {
      from: (table: string) => {
        const rec = { table, ops: [] as [string, unknown[]][] }
        seen.from.push(rec)
        return builder(rec)
      },
      rpc: (fn: string, args: unknown) => {
        seen.rpc.push({ fn, args })
        return Promise.resolve(seen.rpcAnswer)
      },
    },
  }
})

import {
  cutoffOf,
  lineChecksOf,
  loadBillDayCutoff,
  loadJobSuperintendent,
  loadLineChecks,
  nothingOf,
  photoLinksOf,
  putBackNothing,
  recordLineCheck,
  sayNothingThisPeriod,
  setBillDayCutoff,
  whereOnSiteOf,
  type LineCheckRow,
} from './billDayIo'

const sowLines = [
  { id: 'row-l1', sow_id: 'sow-1', position: 0, scope_item_id: 'scope-l1' },
  { id: 'row-co', sow_id: 'sow-1', position: 1, scope_item_id: null },
]

const tap = (over: Partial<LineCheckRow>): LineCheckRow => ({
  id: 'c',
  draw_id: 'd1',
  sow_line_id: 'row-l1',
  we_see_pct: null,
  stored_on_site: null,
  photo_url: null,
  note: '',
  checked_by: 'u1',
  checked_at: '2026-10-22T10:00:00Z',
  seq: 1,
  ...over,
})

beforeEach(() => {
  seen.from.length = 0
  seen.rpc.length = 0
  seen.answer = { data: [], error: null }
  seen.byTable = {}
  seen.rpcAnswer = { data: null, error: null }
})

describe('the rows as the kernels read them', () => {
  it('maps each tap to its line by the kernels’ id, oldest first, with the percent as a number', () => {
    const rows = [
      tap({ id: 'b', seq: 2, we_see_pct: '75', photo_url: ' https://drive.example.test/p1 ', note: 'East wing not hung', checked_at: '2026-10-22T10:05:00Z' }),
      tap({ id: 'a', seq: 1, sow_line_id: 'row-co', stored_on_site: true }),
    ]
    expect(lineChecksOf(rows, sowLines)).toEqual([
      { drawId: 'd1', sovId: 'row-co', weSee: null, onSite: true, photo: false, note: '', by: 'u1', at: '2026-10-22T10:00:00Z' },
      { drawId: 'd1', sovId: 'scope-l1', weSee: 75, onSite: null, photo: true, note: 'East wing not hung', by: 'u1', at: '2026-10-22T10:05:00Z' },
    ])
    expect([...photoLinksOf(rows, sowLines)]).toEqual([['d1:scope-l1', 'https://drive.example.test/p1']])
  })

  it('keeps the newest photo on a line', () => {
    const rows = [tap({ seq: 3, photo_url: 'https://drive.example.test/new' }), tap({ seq: 1, photo_url: 'https://drive.example.test/old' })]
    expect(photoLinksOf(rows, sowLines).get('d1:scope-l1')).toBe('https://drive.example.test/new')
  })

  it('reads nothing this period, where each line is, and the cut-off with its default', () => {
    expect(nothingOf([{ id: 'n1', sow_id: 'sow-1', period_to: '2026-10-25', said_by: 'Dana Kerr, by phone', recorded_by: 'u1', said_at: '2026-10-02T15:00:00Z' }])).toEqual([
      { id: 'n1', sowId: 'sow-1', periodTo: '2026-10-25', saidBy: 'Dana Kerr, by phone', at: '2026-10-02T15:00:00Z' },
    ])
    expect(
      whereOnSiteOf([
        { id: 'row-l1', scope_item_id: 'scope-l1', where_on_site: ' Level 1 ' },
        { id: 'row-co', scope_item_id: null, where_on_site: 'Yard' },
        { id: 'row-x', scope_item_id: 'scope-x', where_on_site: '  ' },
        { id: 'row-y', scope_item_id: 'scope-y', where_on_site: null },
      ]),
    ).toEqual({ 'scope-l1': 'Level 1', 'row-co': 'Yard' })
    expect([cutoffOf(8), cutoffOf('8'), cutoffOf(null), cutoffOf(1), cutoffOf(21), cutoffOf(7.5), cutoffOf(undefined)]).toEqual([8, 8, 6, 6, 6, 6, 6])
  })
})

describe('the reads', () => {
  it('reads nothing for no ids, and reads many ids a hundred at a time', async () => {
    expect(await loadLineChecks([])).toEqual([])
    expect(seen.from).toEqual([])
    const ids = Array.from({ length: 150 }, (_, i) => `d${i}`)
    await loadLineChecks(ids)
    expect(seen.from.map((f) => f.table)).toEqual(['gc_superintendent_checks', 'gc_superintendent_checks'])
    expect(seen.from.map((f) => (f.ops.find(([op]) => op === 'in')?.[1][1] as string[]).length)).toEqual([100, 50])
  })

  it('reads the cut-off, and the default when the read fails', async () => {
    seen.answer = { data: { value_num: 8 }, error: null }
    expect(await loadBillDayCutoff()).toBe(8)
    expect(seen.from[0]?.ops.find(([op]) => op === 'eq')?.[1]).toEqual(['key', 'gc_bill_day_cutoff_days'])
    seen.answer = { data: null, error: { message: 'boom' } }
    expect(await loadBillDayCutoff()).toBe(6)
  })
})

describe('the job’s superintendent', () => {
  it('reads the first one assigned, with a phone when on file, and none when nobody is', async () => {
    seen.byTable = {
      project_superintendents: { data: [{ superintendent_id: 'u9' }], error: null },
      users: { data: { name: ' Wendi ', phone: '(210) 555-0190' }, error: null },
    }
    expect(await loadJobSuperintendent('job-1')).toEqual({ name: 'Wendi', phone: '(210) 555-0190' })
    seen.byTable = { project_superintendents: { data: [], error: null } }
    expect(await loadJobSuperintendent('job-1')).toBeNull()
  })
})

describe('the presses', () => {
  it('keeps a tap through its function, the photo and the note trimmed', async () => {
    seen.rpcAnswer = { data: 'check-1', error: null }
    expect(await recordLineCheck({ drawId: 'd1', sovId: 'scope-l1', weSee: 75, onSite: null, photoUrl: '  ', note: ' East wing ' })).toBe('check-1')
    expect(seen.rpc).toEqual([
      { fn: 'gc_record_line_check', args: { p_draw_id: 'd1', p_line: 'scope-l1', p_we_see: 75, p_on_site: null, p_photo_url: null, p_note: 'East wing' } },
    ])
  })

  it('throws a refusal in its own words', async () => {
    seen.rpcAnswer = { data: null, error: { message: 'Only a dev records a check while Bill day is built.', code: '42501' } }
    await expect(recordLineCheck({ drawId: 'd1', sovId: 'scope-l1', weSee: 50, onSite: null })).rejects.toThrow(/Only a dev records a check while Bill day is built/)
  })

  it('records nothing this period, puts it back, and sets the cut-off', async () => {
    seen.rpcAnswer = { data: 'n1', error: null }
    expect(await sayNothingThisPeriod('sow-1', '2026-10-25', 'Dana Kerr, by phone')).toBe('n1')
    seen.rpcAnswer = { data: 8, error: null }
    expect(await setBillDayCutoff(8)).toBe(8)
    expect(seen.rpc).toEqual([
      { fn: 'gc_say_nothing_this_period', args: { p_sow_id: 'sow-1', p_period_to: '2026-10-25', p_said_by: 'Dana Kerr, by phone' } },
      { fn: 'gc_set_bill_day_cutoff', args: { p_days: 8 } },
    ])
    seen.answer = { data: null, error: null }
    await putBackNothing('n1')
    expect(seen.from.map((f) => [f.table, f.ops])).toEqual([['gc_bill_day_nothing', [['delete', []], ['eq', ['id', 'n1']]]]])
  })
})
