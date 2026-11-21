/**
 * The party's own page (punch list #403, step 4): the read of a party's papers as a hook, for the list that draws it
 * (`PartyPapers.tsx`) and for a card that must know whether there is anything to show before it draws itself.
 */
import { useCallback, useEffect, useState } from 'react'
import type { PartyPaperRow, PartyRecord } from '../../lib/contracts/partyPapers'
import { readPartyPapers } from '../../lib/contracts/partyPapersIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'

/** What a party's papers read as: the rows once read, the failure when the read did not land, and the way to read again. */
export type PartyPapersRead = { rows: PartyPaperRow[] | null; failure: OfflineRecoveryLastError | null; reading: boolean; retry: () => void }

/** Read a party's papers. `party` null reads nothing, for a reader the list is not for. */
export function usePartyPapers(party: PartyRecord | null): PartyPapersRead {
  const kind = party?.kind ?? null
  const id = party?.id ?? null
  const [rows, setRows] = useState<PartyPaperRow[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!kind || !id) {
      setRows(null)
      setFailure(null)
      return
    }
    let cancelled = false
    setReading(true)
    void readPartyPapers({ kind, id })
      .then((read) => {
        if (cancelled) return
        setRows(read)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure(recoveryFailureFromError(e, 'The papers did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, id, tries])

  const retry = useCallback(() => setTries((n) => n + 1), [])
  return { rows, failure, reading, retry }
}

/** True while a read has nothing to show: not read yet, or read and empty, with no failure to say. */
export function partyPapersQuiet(read: PartyPapersRead): boolean {
  return read.failure == null && (read.rows == null || read.rows.length === 0)
}
