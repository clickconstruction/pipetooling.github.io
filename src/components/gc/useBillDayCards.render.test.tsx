// @vitest-environment jsdom
/**
 * Bill day on each building job's card (Messages cut 9, wave 2): the facts the pill and the line read, by the same
 * kernels as From the trades over the prototype's demo draws, and the hook that reads them for the money team only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/gc/billDay/billDayIo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/billDay/billDayIo')>()
  return { ...real, loadLineChecks: vi.fn(), loadBillDayNothing: vi.fn(), loadBillDayCutoff: vi.fn() }
})
vi.mock('../../lib/gc/gcIo', () => ({ loadGcBillingRows: vi.fn() }))

import { loadBillDayCutoff, loadBillDayNothing, loadLineChecks, type LineCheckRow } from '../../lib/gc/billDay/billDayIo'
import { NO_DRAWS, type DrawTables } from '../../lib/gc/drawRows'
import { loadGcBillingRows } from '../../lib/gc/gcIo'
import { billDayJob, billDayState, WENDI_WALK } from '../../test/fixtures/billDayDemo'
import { BillDayCardLine } from './GcBillDayCardLine'
import { billDayCardFacts, billDayJobs, useBillDayCards } from './useBillDayCards'

const drawTablesOf = (state: ReturnType<typeof billDayState>): DrawTables => ({
  ...NO_DRAWS,
  sowLines: state.projects.flatMap((p) => p.packages.flatMap((k) => (k.sow?.sov ?? []).map((l, i) => ({ id: l.id, sow_id: k.sow?.id ?? '', position: i, scope_item_id: null })))),
})
const walkRows: LineCheckRow[] = WENDI_WALK.map((c, i) => ({
  id: `c${i}`,
  draw_id: c.drawId,
  sow_line_id: c.sovId,
  we_see_pct: c.weSee,
  stored_on_site: c.onSite,
  photo_url: null,
  note: c.note,
  checked_by: c.by,
  checked_at: c.at,
  seq: i + 1,
}))

beforeEach(() => {
  vi.mocked(loadLineChecks).mockResolvedValue([])
  vi.mocked(loadBillDayNothing).mockResolvedValue([])
  vi.mocked(loadBillDayCutoff).mockResolvedValue(6)
  // No bills read: each job reads as its first pay application, whose certificate gate is clear.
  vi.mocked(loadGcBillingRows).mockResolvedValue({ terms: [], contract: [], billing: new Map(), names: {}, payDays: {} })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('billDayCardFacts', () => {
  it('reads Stone Oak on the Friday: 3 of 6 trades in, 2 of 7 gates', () => {
    const state = billDayState()
    const facts = billDayCardFacts(state, billDayJob(state, 'stoneoak'), drawTablesOf(state), [], [], 6)
    expect(facts).toEqual({ billDay: '2026-10-25', number: 4, cutoff: '2026-10-19', inN: 3, of: 6, ok: 2, gates: 7 })
  })

  it('reads 3 of 7 once Wendi walked, and counts a trade said to send nothing as in', () => {
    const state = billDayState('2026-10-22')
    const nothing = [{ id: 'n1', sow_id: 'sow-kerr', period_to: '2026-10-25', said_by: 'Dana Kerr', recorded_by: null, said_at: '2026-10-22T15:00:00Z' }]
    const facts = billDayCardFacts(state, billDayJob(state, 'stoneoak'), drawTablesOf(state), walkRows, nothing, 8)
    expect(facts).toMatchObject({ cutoff: '2026-10-17', inN: 4, of: 6, ok: 3 })
  })

  it('lists the jobs being built with a signed trade', () => {
    expect(billDayJobs(billDayState()).map((p) => p.id)).toEqual(['stoneoak', 'helotes'])
    expect(billDayJobs(null)).toEqual([])
  })
})

describe('useBillDayCards', () => {
  it('reads every building job at once for the money team', async () => {
    const state = billDayState()
    const { result } = renderHook(() => useBillDayCards(state, drawTablesOf(state), true))
    await waitFor(() => expect(result.current.size).toBe(2))
    expect(result.current.get('stoneoak')).toMatchObject({ ok: 2, gates: 7, inN: 3, of: 6 })
    expect(loadGcBillingRows).toHaveBeenCalledWith(['stoneoak', 'helotes'])
    expect(loadLineChecks).toHaveBeenCalledTimes(1)
  })

  it('reads nothing for anyone else', () => {
    const state = billDayState()
    const { result } = renderHook(() => useBillDayCards(state, drawTablesOf(state), false))
    expect(result.current.size).toBe(0)
    expect(loadGcBillingRows).not.toHaveBeenCalled()
  })
})

describe('BillDayCardLine', () => {
  it('says the bill day, the pay application, the cut-off, who is in and the gates, and opens From the trades', () => {
    const onOpen = vi.fn()
    render(<BillDayCardLine facts={{ billDay: '2026-10-25', number: 4, cutoff: '2026-10-19', inN: 3, of: 6, ok: 2, gates: 7 }} onOpen={onOpen} />)
    expect(document.querySelector('[data-bill-day-card-line]')?.textContent).toBe('Bill day Oct 25pay application 4 · trades by Mon Oct 19 · 3 of 6 in · gates 2 of 7From the trades ›')
    fireEvent.click(screen.getByRole('button', { name: 'From the trades ›' }))
    expect(onOpen).toHaveBeenCalled()
  })
})
