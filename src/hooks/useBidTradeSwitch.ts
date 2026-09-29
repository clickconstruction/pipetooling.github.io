/**
 * The Bid window's trade switch (Edit Bid → Service Type): the same customer's bids for the
 * same project in other trades, copying this bid into another trade (`duplicate_bid_to_service_type`),
 * and opening a sibling that already exists.
 *
 * Punch list #51, PR 3 — moved out of `src/pages/Bids.tsx` verbatim. The grouping is
 * `lib/bids/tradeSwitchSiblings` (tested). The page keeps the Bid window, its form and its
 * autosave, and hands in the doors this needs: flush the pending autosave, close the window,
 * open a bid on it, reload the bids, pick a trade.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupTradeSwitchSiblings, type TradeSwitchSibling, type TradeSwitchSiblingRow } from '../lib/bids/tradeSwitchSiblings'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export function useBidTradeSwitch(input: {
  /** The bid open on the Bid window; null for New Bid or a closed window. */
  editingBid: BidWithBuilder | null
  /** The bids the page holds — a sibling already in hand opens without a reload. */
  bids: BidWithBuilder[]
  authUserId: string | null | undefined
  /** Save what is pending on the Edit face before leaving it. */
  flushAutosave: () => Promise<void>
  setSavingBid: (saving: boolean) => void
  setError: (message: string | null) => void
  showToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
  loadBids: () => Promise<BidWithBuilder[]>
  setSelectedServiceTypeId: (id: string) => void
  closeBidForm: () => void
  openEditBid: (bid: BidWithBuilder) => void
}) {
  const {
    editingBid,
    bids,
    authUserId,
    flushAutosave,
    setSavingBid,
    setError,
    showToast,
    loadBids,
    setSelectedServiceTypeId,
    closeBidForm,
    openEditBid,
  } = input
  const [siblings, setSiblings] = useState<Record<string, TradeSwitchSibling[]>>({})

  async function refreshSiblings() {
    const source = editingBid
    const customerId = source?.customer_id
    if (!source || !customerId) {
      setSiblings({})
      return
    }
    const pn = (source.project_name ?? '').trim().toLowerCase()
    if (!pn) {
      setSiblings({})
      return
    }
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase
            .from('bids')
            .select('id, bid_number, service_type_id, project_name')
            .eq('customer_id', customerId)
            .neq('id', source.id),
        'list sibling bids for service type switch',
      )
      setSiblings(groupTradeSwitchSiblings((data ?? []) as TradeSwitchSiblingRow[], source.project_name))
    } catch {
      setSiblings({})
    }
  }

  async function duplicateToTrade(targetServiceTypeId: string) {
    await flushAutosave()
    if (!editingBid || !authUserId) return
    setSavingBid(true)
    setError(null)
    try {
      const newId = await withSupabaseRetry(
        () =>
          supabase.rpc('duplicate_bid_to_service_type', {
            p_source_bid_id: editingBid.id,
            p_target_service_type_id: targetServiceTypeId,
          }),
        'duplicate bid to service type',
      )
      if (typeof newId !== 'string' || !newId) {
        const msg = 'Duplicate did not return a new bid id.'
        setError(msg)
        showToast(msg, 'error')
        return
      }
      const rows = await loadBids()
      setSelectedServiceTypeId(targetServiceTypeId)
      const fresh = rows.find((b) => b.id === newId)
      const sameTrade = targetServiceTypeId === editingBid.service_type_id
      if (fresh) {
        closeBidForm()
        openEditBid(fresh)
        showToast(sameTrade ? 'Bid duplicated.' : 'Bid copied to the new trade.', 'success')
      } else {
        closeBidForm()
        showToast('Bid copied. Refresh the page if it does not appear.', 'success')
      }
    } catch (e) {
      const msg = formatErrorMessage(e)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSavingBid(false)
    }
  }

  async function openExistingSibling(bidId: string) {
    await flushAutosave()
    const fresh = bids.find((b) => b.id === bidId)
    if (fresh) {
      setSelectedServiceTypeId(fresh.service_type_id)
      closeBidForm()
      openEditBid(fresh)
      return
    }
    void loadBids().then((rows) => {
      const b = rows.find((x) => x.id === bidId)
      if (b) {
        setSelectedServiceTypeId(b.service_type_id)
        closeBidForm()
        openEditBid(b)
      } else {
        showToast('Bid not found or no access.', 'error')
      }
    })
  }

  return {
    /** Trade id → the sibling bids in it; empty until the switch window asks. */
    siblings,
    /** The Bid window closed: forget the siblings. */
    clearSiblings: () => setSiblings({}),
    refreshSiblings,
    duplicateToTrade,
    openExistingSibling,
  }
}
