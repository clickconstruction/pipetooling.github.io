// @vitest-environment jsdom
/**
 * Bill day for one job (`useBillDay`, Messages cut 9): its four reads laid through the kernels over the prototype's demo
 * draws, and each press read again after it. The reads are mocked; the kernels are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../../lib/gc/billDay/billDayIo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/billDay/billDayIo')>()
  return {
    ...real,
    loadLineChecks: vi.fn(),
    loadBillDayNothing: vi.fn(),
    loadWhereOnSite: vi.fn(),
    loadBillDayCutoff: vi.fn(),
    recordLineCheck: vi.fn(),
    sayNothingThisPeriod: vi.fn(),
    putBackNothing: vi.fn(),
    setBillDayCutoff: vi.fn(),
  }
})

import {
  loadBillDayCutoff,
  loadBillDayNothing,
  loadLineChecks,
  loadWhereOnSite,
  putBackNothing,
  recordLineCheck,
  sayNothingThisPeriod,
  type LineCheckRow,
  type NothingRow,
} from '../../lib/gc/billDay/billDayIo'
import { NO_DRAWS, type DrawTables } from '../../lib/gc/drawRows'
import { billDayJob, billDayState, WENDI_WALK, WHERE_ON_SITE } from '../../test/fixtures/billDayDemo'
import { billDayIds, useBillDay } from './useBillDay'

const state = billDayState('2026-10-22')
const project = billDayJob(state, 'stoneoak')
// The demo's lines carry their own ids as the kernels' ids, so each row is its own line.
const drawTables: DrawTables = {
  ...NO_DRAWS,
  sowLines: project.packages.flatMap((p) => (p.sow?.sov ?? []).map((l, i) => ({ id: l.id, sow_id: p.sow?.id ?? '', position: i, scope_item_id: null }))),
}
const walkRows: LineCheckRow[] = WENDI_WALK.map((c, i) => ({
  id: `c${i}`,
  draw_id: c.drawId,
  sow_line_id: c.sovId,
  we_see_pct: c.weSee,
  stored_on_site: c.onSite,
  photo_url: c.photo ? 'https://drive.example.test/photo' : null,
  note: c.note,
  checked_by: c.by,
  checked_at: c.at,
  seq: i + 1,
}))
const whereRows = Object.entries(WHERE_ON_SITE).map(([id, where]) => ({ id, scope_item_id: null, where_on_site: where }))

beforeEach(() => {
  vi.mocked(loadLineChecks).mockResolvedValue(walkRows)
  vi.mocked(loadBillDayNothing).mockResolvedValue([])
  vi.mocked(loadWhereOnSite).mockResolvedValue(whereRows)
  vi.mocked(loadBillDayCutoff).mockResolvedValue(6)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useBillDay (Messages cut 9)', () => {
  it('reads every draw of the job’s trades, the ones sent back too, and their statements of work', () => {
    const { drawIds, sowIds } = billDayIds(project)
    expect(drawIds).toContain('rio-2')
    expect(drawIds).toContain('ls-2')
    expect(sowIds).toEqual(['sow-rio', 'sow-hillside', 'sow-kerr', 'sow-alamo', 'sow-lonestar', 'sow-tejas'])
  })

  it('lays the reads through the kernels: Wendi’s walk in walking order, and the ring at 3 of 7', async () => {
    const { result } = renderHook(() => useBillDay(state, project, drawTables, 'Wendi'))
    expect(result.current.read).toBeNull()
    await waitFor(() => expect(result.current.read).not.toBeNull())
    const read = result.current.read!
    expect(read.dates.billDay).toBe('2026-10-25')
    expect(read.items.map((i) => [i.where, i.label, i.weSee, i.onSite])).toEqual([
      ['Yard', 'Equipment', null, true],
      ['Level 1', 'Rough-in, level 1', 75, null],
      ['Level 2', 'Rough-in, level 2', 10, null],
    ])
    expect(read.gates.filter((g) => g.ok).length).toBe(3)
    expect(read.photos.get('ls-2:ls-l1')).toBe('https://drive.example.test/photo')
    expect(read.river.draws).toBe(6)
    expect(result.current.problem).toBeNull()
  })

  it('keeps a tap, then reads the walk again', async () => {
    vi.mocked(recordLineCheck).mockResolvedValue('c9')
    const { result } = renderHook(() => useBillDay(state, project, drawTables, 'Wendi'))
    await waitFor(() => expect(result.current.read).not.toBeNull())
    let ok = false
    await act(async () => {
      ok = await result.current.writes.tap({ drawId: 'ls-2', sovId: 'ls-l1', weSee: 80, onSite: null, note: 'Most of it hung' })
    })
    expect(ok).toBe(true)
    expect(recordLineCheck).toHaveBeenCalledWith({ drawId: 'ls-2', sovId: 'ls-l1', weSee: 80, onSite: null, note: 'Most of it hung' })
    expect(loadLineChecks).toHaveBeenCalledTimes(2)
  })

  it('records nothing this period for the bill day, reads it back, and puts it back by its row', async () => {
    const said: NothingRow = { id: 'n1', sow_id: 'sow-kerr', period_to: '2026-10-25', said_by: 'Dana Kerr, by phone', recorded_by: 'u1', said_at: '2026-10-22T15:00:00Z' }
    vi.mocked(sayNothingThisPeriod).mockResolvedValue('n1')
    const { result } = renderHook(() => useBillDay(state, project, drawTables, 'Wendi'))
    await waitFor(() => expect(result.current.read).not.toBeNull())
    const kerr = result.current.read!.rows.find((r) => r.company === 'Kerr Electric')!
    vi.mocked(loadBillDayNothing).mockResolvedValue([said])
    await act(async () => {
      await result.current.writes.sayNothing(kerr, 'Dana Kerr, by phone')
    })
    expect(sayNothingThisPeriod).toHaveBeenCalledWith('sow-kerr', '2026-10-25', 'Dana Kerr, by phone')
    const marked = result.current.read!.rows.find((r) => r.company === 'Kerr Electric')!
    expect(marked.nothing?.saidBy).toBe('Dana Kerr, by phone')
    await act(async () => {
      await result.current.writes.putBack(marked)
    })
    expect(putBackNothing).toHaveBeenCalledWith('n1')
  })

  it('says a failed read in words', async () => {
    vi.mocked(loadBillDayNothing).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useBillDay(state, project, drawTables, 'Wendi'))
    await waitFor(() => expect(result.current.problem).not.toBeNull())
    expect(result.current.read).toBeNull()
  })

  it('says a refused press in its words, and keeps the read', async () => {
    vi.mocked(recordLineCheck).mockRejectedValueOnce(new Error('Only a dev records a check while Bill day is built.'))
    const { result } = renderHook(() => useBillDay(state, project, drawTables, 'Wendi'))
    await waitFor(() => expect(result.current.read).not.toBeNull())
    let ok = true
    await act(async () => {
      ok = await result.current.writes.tap({ drawId: 'ls-2', sovId: 'ls-l1', weSee: 80, onSite: null })
    })
    expect(ok).toBe(false)
    expect(result.current.problem).toContain('Only a dev records a check')
    expect(result.current.read).not.toBeNull()
    expect(result.current.busy).toBe(false)
  })
})
