/**
 * The Bid window's own state on the Bids page: whether it is open and on which face, the bid
 * it holds, the focus a door asked for, the save in flight, the close guard's state, the
 * refresh key its Bid face re-reads on, and the delete window.
 *
 * Punch list #51, PR 4a — a state container, nothing else: the page declared these as eleven
 * `useState`s (and one ref) in `src/pages/Bids.tsx`; it calls this where they stood and reads
 * the same names. `useBidEditController` (PR 4b) takes it as one input.
 */
import { useRef, useState } from 'react'
import type { BidFormFocus } from '../lib/bids/bidFormFocus'
import type { BidWithBuilder } from '../types/bidWithBuilder'

export type BidCloseFlushState = 'idle' | 'saving' | 'error'

export function useBidWindowState() {
  const [bidFormOpen, setBidFormOpen] = useState(false)
  // v2.2390 (Wendi): which face the Bid window opens on — Edit for every Edit-bid
  // button (the default), Bid for bid-name clicks (they used to open the old
  // standalone preview on this page).
  const [bidWindowInitialTab, setBidWindowInitialTab] = useState<'bid' | 'edit'>('edit')
  const [pendingBidFormFocus, setPendingBidFormFocus] = useState<BidFormFocus | null>(null)
  const [editingBid, setEditingBid] = useState<BidWithBuilder | null>(null)
  const [savingBid, setSavingBid] = useState(false)
  // Edit Bid autosave (v2.3130): the Bid window's Edit tab writes each change on its own; the
  // close guard flushes a pending write and holds the window open when that fails.
  const [bidCloseFlushState, setBidCloseFlushState] = useState<BidCloseFlushState>('idle')
  const bidCloseFlushStateRef = useRef(bidCloseFlushState)
  bidCloseFlushStateRef.current = bidCloseFlushState
  /** Bumped after every autosave so the window's Bid tab re-reads the row. */
  const [bidWindowRefreshKey, setBidWindowRefreshKey] = useState(0)
  const [deleteConfirmProjectName, setDeleteConfirmProjectName] = useState('')
  const [deletingBid, setDeletingBid] = useState(false)
  const [deleteBidModalOpen, setDeleteBidModalOpen] = useState(false)

  return {
    bidFormOpen,
    setBidFormOpen,
    bidWindowInitialTab,
    setBidWindowInitialTab,
    pendingBidFormFocus,
    setPendingBidFormFocus,
    editingBid,
    setEditingBid,
    savingBid,
    setSavingBid,
    bidCloseFlushState,
    setBidCloseFlushState,
    bidCloseFlushStateRef,
    bidWindowRefreshKey,
    setBidWindowRefreshKey,
    deleteConfirmProjectName,
    setDeleteConfirmProjectName,
    deletingBid,
    setDeletingBid,
    deleteBidModalOpen,
    setDeleteBidModalOpen,
  }
}

export type BidWindowState = ReturnType<typeof useBidWindowState>
