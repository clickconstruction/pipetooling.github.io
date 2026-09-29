// @vitest-environment jsdom
/**
 * The Edit Bid controller through its hook (punch list #51, PR 4b), composed with the real
 * window state, form and sent-date checklist it takes — the doors in and out of the Bid window,
 * delete, and the lost-reason save. The saves and the autosave are guarded through the page
 * (`Bids.render.test.tsx` → *Edit Bid writes*); this pins what the page cannot reach: delete's
 * own name check (the page's button is disabled before it could fire) and the lost summary's
 * write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { useBidWindowState } from './useBidWindowState'
import { useBidDateSentAttestation } from './useBidDateSentAttestation'
import { useBidEditForm } from '../lib/bids/useBidEditForm'
import { useBidEditController } from './useBidEditController'
import { BID_UPDATE_NOT_APPLIED_MESSAGE } from '../lib/bids/updateGuard'

const db = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; op: string; payload?: unknown; eq: Array<[string, unknown]> }>,
  answer: { data: [{ id: 'bid-1' }] as unknown, error: null as { message: string; code: string } | null },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const w: { table: string; op: string; payload?: unknown; eq: Array<[string, unknown]> } = { table, op: 'select', eq: [] }
      const b: Record<string, unknown> = {}
      for (const op of ['update', 'delete', 'insert']) {
        b[op] = (payload?: unknown) => {
          w.op = op
          w.payload = payload
          db.writes.push(w)
          return b
        }
      }
      b.select = () => b
      b.neq = () => b
      b.eq = (col: string, v: unknown) => {
        w.eq.push([col, v])
        return b
      }
      b.then = (ok?: (v: unknown) => unknown, no?: (e: unknown) => unknown) =>
        Promise.resolve(w.op === 'select' ? { data: [], error: null } : db.answer).then(ok, no)
      return b
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}))

afterEach(() => cleanup())
beforeEach(() => {
  db.writes = []
  db.answer = { data: [{ id: 'bid-1' }], error: null }
})

const BID = {
  id: 'bid-1',
  bid_number: '482',
  project_name: 'Pondhill Building 2',
  customer_id: null,
  service_type_id: 'st-p',
  bid_date_sent: null,
} as unknown as BidWithBuilder

function setup() {
  const deps = {
    loadBids: vi.fn(async () => [BID]),
    setError: vi.fn(),
    showToast: vi.fn(),
    setSelectedServiceTypeId: vi.fn(),
    noteRobotReviewRevision: vi.fn(async () => {}),
    offerRobotEnvelope: vi.fn(async () => {}),
    syncFreshBidIntoSelections: vi.fn(),
    openCountsForBid: vi.fn(),
  }
  const hook = renderHook(() => {
    const bidWindow = useBidWindowState()
    const attestation = useBidDateSentAttestation({ serverBidDateSent: bidWindow.editingBid?.bid_date_sent ?? null, userId: 'user-1' })
    const bidForm = useBidEditForm()
    const controller = useBidEditController({
      bidWindow,
      bidForm,
      attestation,
      authUser: { id: 'user-1' } as never,
      profileName: 'Test Estimator',
      myRole: 'estimator',
      bids: [BID],
      selectedServiceTypeId: 'st-p',
      ...deps,
    })
    return { bidWindow, bidForm, controller }
  })
  return { ...hook, deps }
}

describe('useBidEditController — the doors', () => {
  it('Edit opens the window on that bid with its values, on the Edit face', () => {
    const { result } = setup()
    act(() => result.current.controller.openEditBid(BID))
    expect(result.current.bidWindow.bidFormOpen).toBe(true)
    expect(result.current.bidWindow.editingBid?.id).toBe('bid-1')
    expect(result.current.bidWindow.bidWindowInitialTab).toBe('edit')
    expect(result.current.bidForm.values.projectName).toBe('Pondhill Building 2')
  })

  it('New Bid opens an empty window in the page’s trade; close forgets the bid', () => {
    const { result } = setup()
    act(() => result.current.controller.openEditBid(BID))
    act(() => result.current.controller.openNewBid())
    expect(result.current.bidWindow.editingBid).toBeNull()
    expect(result.current.bidForm.values.projectName).toBe('')
    expect(result.current.bidForm.values.formServiceTypeId).toBe('st-p')
    act(() => result.current.controller.closeBidForm())
    expect(result.current.bidWindow.bidFormOpen).toBe(false)
    expect(db.writes).toEqual([])
  })
})

describe('useBidEditController — delete', () => {
  it('writes nothing until the project name is typed, then deletes that bid once and closes', async () => {
    const { result, deps } = setup()
    act(() => result.current.controller.openEditBid(BID))
    act(() => result.current.bidWindow.setDeleteConfirmProjectName('Pondhill'))
    await act(async () => { await result.current.controller.deleteBid() })
    expect(db.writes).toEqual([])
    expect(result.current.bidWindow.bidFormOpen).toBe(true)

    act(() => result.current.bidWindow.setDeleteConfirmProjectName('  Pondhill Building 2 '))
    await act(async () => { await result.current.controller.deleteBid() })
    expect(db.writes).toEqual([{ table: 'bids', op: 'delete', payload: undefined, eq: [['id', 'bid-1']] }])
    expect(deps.loadBids).toHaveBeenCalledTimes(1)
    expect(result.current.bidWindow.bidFormOpen).toBe(false)
    expect(result.current.bidWindow.deletingBid).toBe(false)
  })

  it('a refused delete says why and leaves the bid open', async () => {
    db.answer = { data: null, error: { message: 'permission denied', code: '42501' } }
    const { result, deps } = setup()
    act(() => result.current.controller.openEditBid(BID))
    act(() => result.current.bidWindow.setDeleteConfirmProjectName('Pondhill Building 2'))
    await act(async () => { await result.current.controller.deleteBid() })
    expect(deps.setError).toHaveBeenLastCalledWith('permission denied')
    expect(deps.loadBids).not.toHaveBeenCalled()
    expect(result.current.bidWindow.bidFormOpen).toBe(true)
    expect(result.current.bidWindow.deletingBid).toBe(false)
  })
})

describe('useBidEditController — the lost reason from the lost summary', () => {
  it('writes the trimmed reason and the category to that bid, then reloads', async () => {
    const { result, deps } = setup()
    await act(async () => { await result.current.controller.saveLossReasonFromLostSummaryModal('bid-9', '  price  ', 'price' as never) })
    expect(db.writes).toEqual([{ table: 'bids', op: 'update', payload: { loss_reason: 'price', loss_category: 'price' }, eq: [['id', 'bid-9']] }])
    expect(deps.showToast).not.toHaveBeenCalled()
    expect(deps.loadBids).toHaveBeenCalledTimes(1)
  })

  it('a blank reason is written as null; a write that changes no row says so', async () => {
    db.answer = { data: [], error: null }
    const { result, deps } = setup()
    await act(async () => { await result.current.controller.saveLossReasonFromLostSummaryModal('bid-9', '   ', null) })
    expect(db.writes[0]?.payload).toEqual({ loss_reason: null, loss_category: null })
    expect(deps.showToast).toHaveBeenCalledWith(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
    expect(deps.loadBids).toHaveBeenCalledTimes(1)
  })
})
