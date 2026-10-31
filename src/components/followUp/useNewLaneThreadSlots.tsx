/**
 * Messages, residential R7 (PR 3): the sort card above the lines (`threadSlots.tsx`'s `aboveLines`), while the open
 * person waits in Follow up's New lane. The card reads that person once (`newLaneCardIo.ts`) and asks the lane's own
 * rule whether they need sorting (`laneRowFor`), so it shows what Follow up's New row says. Each press writes through
 * the spine's `name_contact` and `tie_message` or cut 2's `take_it` and `hand_to`, says what it did, reads the card
 * again and asks the window to read the thread again (`useMessagesReread`). *Someone else* opens the window's own *Who
 * is this?*. A fold that keeps the thread on another contact moves the window there.
 */
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact } from '../../lib/contacts/kernel'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { supabaseNewLaneCardIo, type NewLaneCardIo } from '../../lib/followUp/newLaneCardIo'
import { canOpenMessages } from '../../lib/gc/access'
import type { AboveLinesActs, ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { NewLaneSlot, type Say } from './NewLaneSlot'

const DEFAULT_IO = supabaseNewLaneCardIo()

/** Where *Start a bid* lands (v2.6222): the Bid Board, scrolled to the new bid, the way a bid's deep link opens it. */
export const bidHref = (bidId: string): string => `/bids?tab=bid-board&bidId=${encodeURIComponent(bidId)}`

export function useNewLaneThreadSlots(io: NewLaneCardIo = DEFAULT_IO): Pick<ThreadSlots, 'aboveLines'> {
  // Optional, so a window drawn without the app's providers (another cut's smoke) draws no card.
  const auth = useOptionalAuth()
  const toasts = useOptionalToastContext()
  const reread = useMessagesReread()
  const navigate = useNavigate()
  const { closeThread } = useThreadWindow()
  const on = canOpenMessages(auth?.role ?? null) && toasts !== null
  const meId = auth?.user?.id ?? ''
  const meName = auth?.profileName?.trim() || 'You'
  const say = useCallback<Say>((words, tone) => toasts?.showToast(words, tone), [toasts])
  // Start a bid (v2.6222): the thread closes and the Bid Board opens on the new bid, the lead doors' pattern.
  const openBid = useCallback(
    (bidId: string) => {
      closeThread()
      navigate(bidHref(bidId))
    },
    [closeThread, navigate],
  )
  return useMemo(
    () =>
      on
        ? { aboveLines: (c: Contact, acts: AboveLinesActs) => <NewLaneSlot key={`new-lane:${c.id}`} contact={c} acts={acts} io={io} say={say} reread={reread} me={{ id: meId, name: meName }} openBid={openBid} /> }
        : {},
    [on, io, say, reread, meId, meName, openBid],
  )
}
