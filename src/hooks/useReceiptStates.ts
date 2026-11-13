import { useEffect, useMemo, useState } from 'react'
import { receiptStatesOf, type ReceiptState } from '../lib/tickets/receiptState'
import { loadReceiptStateFacts } from '../lib/tickets/receiptStateIo'

const NONE: ReadonlyMap<string, ReceiptState> = new Map()

/**
 * The receipt's state for the charges a table shows (punch list #299, PR 3), by charge id. Empty while it reads and
 * when there is nothing to say; it reads again only when the list of charges changes. The caller hands in the ids
 * `receiptStateChargeIds` picked, so a long ledger asks about its recent card charges alone.
 */
export function useReceiptStates(chargeIds: readonly string[], load: typeof loadReceiptStateFacts = loadReceiptStateFacts): ReadonlyMap<string, ReceiptState> {
  // The ids as one word: a new array with the same charges must not read again.
  const key = useMemo(() => [...chargeIds].sort().join(','), [chargeIds])
  const [states, setStates] = useState<ReadonlyMap<string, ReceiptState>>(NONE)

  useEffect(() => {
    if (key === '') {
      setStates(NONE)
      return
    }
    let live = true
    void load(key.split(',')).then((facts) => {
      if (live) setStates(receiptStatesOf(facts, Date.now()))
    })
    return () => {
      live = false
    }
  }, [key, load])

  return states
}
