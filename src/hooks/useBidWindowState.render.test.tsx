// @vitest-environment jsdom
/** The Bid window's state container (punch list #51, PR 4a): where it starts, and the close guard's ref following its state. */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { useBidWindowState } from './useBidWindowState'

afterEach(() => cleanup())

describe('useBidWindowState', () => {
  it('starts closed, on the Edit face, with no bid, nothing saving and nothing pending', () => {
    const { result } = renderHook(() => useBidWindowState())
    const w = result.current
    expect(w.bidFormOpen).toBe(false)
    expect(w.bidWindowInitialTab).toBe('edit')
    expect(w.pendingBidFormFocus).toBeNull()
    expect(w.editingBid).toBeNull()
    expect(w.savingBid).toBe(false)
    expect(w.bidCloseFlushState).toBe('idle')
    expect(w.bidCloseFlushStateRef.current).toBe('idle')
    expect(w.bidWindowRefreshKey).toBe(0)
    expect(w.deleteConfirmProjectName).toBe('')
    expect(w.deletingBid).toBe(false)
    expect(w.deleteBidModalOpen).toBe(false)
  })

  it('the close guard’s ref reads the state as of the last render — what an async close reads mid-flight', () => {
    const { result } = renderHook(() => useBidWindowState())
    const ref = result.current.bidCloseFlushStateRef
    act(() => result.current.setBidCloseFlushState('saving'))
    expect(ref.current).toBe('saving')
    act(() => result.current.setBidCloseFlushState('error'))
    expect(ref.current).toBe('error')
    expect(result.current.bidCloseFlushStateRef).toBe(ref)
  })

  it('each setter moves its own value and nothing else', () => {
    const { result } = renderHook(() => useBidWindowState())
    const bid = { id: 'bid-1' } as BidWithBuilder
    act(() => {
      result.current.setBidFormOpen(true)
      result.current.setEditingBid(bid)
      result.current.setBidWindowInitialTab('bid')
      result.current.setBidWindowRefreshKey((k) => k + 1)
    })
    expect(result.current.bidFormOpen).toBe(true)
    expect(result.current.editingBid).toBe(bid)
    expect(result.current.bidWindowInitialTab).toBe('bid')
    expect(result.current.bidWindowRefreshKey).toBe(1)
    expect(result.current.savingBid).toBe(false)
    expect(result.current.deleteBidModalOpen).toBe(false)
  })
})
