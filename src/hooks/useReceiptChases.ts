import { useCallback, useEffect, useState } from 'react'
import { RECEIPT_CHASE_CHANGED_EVENT, receiptChaseCounts, type ReceiptChaseCounts } from '../lib/needsYou/fillInReceipts'
import { receiptFillInIo, type ReceiptFillInIo } from '../lib/needsYou/fillInReceiptsIo'

/**
 * The card charges waiting on a receipt the text cannot get (punch list #299, the step after PR 2): the Needs you
 * line's count, the deck's own rows read by the same function, so the line and the deck agree. Null while it reads and
 * on a refused read (a database one step behind the app has no such function yet), so the card stays quiet. Reads again
 * when a Got it lands anywhere in the app.
 */
export function useReceiptChases(enabled: boolean, io: Pick<ReceiptFillInIo, 'fetchSources'> = receiptFillInIo): { chases: ReceiptChaseCounts | null } {
  const [chases, setChases] = useState<ReceiptChaseCounts | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setChases(null)
      return
    }
    try {
      setChases(receiptChaseCounts(await io.fetchSources()))
    } catch {
      setChases(null)
    }
  }, [enabled, io])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener(RECEIPT_CHASE_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(RECEIPT_CHASE_CHANGED_EVENT, onChanged)
  }, [load])

  return { chases }
}
