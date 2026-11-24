import { useEffect, useState } from 'react'
import type { BankCheck } from '../lib/jobs/checkCleared'
import { readBankChecks } from '../lib/jobs/checkClearedIo'

/**
 * The bank's check deposits for a screen that asks whether a check has cleared (punch list #437, piece 1; the
 * rule is `checkCleared.ts`). `undefined` while they are being read and `null` when the read failed: the release
 * tab holds on either, so a slow or a failed read never lets a release out early. With `enabled` false nothing is
 * read and the answer is an empty list.
 */
export function useBankChecks(enabled: boolean, todayYmd: string, linkedIds: ReadonlyArray<string | null | undefined> = [], read: typeof readBankChecks = readBankChecks): ReadonlyArray<BankCheck> | null | undefined {
  const [checks, setChecks] = useState<ReadonlyArray<BankCheck> | null | undefined>(enabled ? undefined : NONE)
  const idsKey = linkedIds
    .filter((id): id is string => Boolean(id))
    .sort()
    .join(',')
  useEffect(() => {
    if (!enabled) {
      setChecks(NONE)
      return
    }
    let live = true
    setChecks(undefined)
    read(todayYmd, idsKey ? idsKey.split(',') : [])
      .then((rows) => {
        if (live) setChecks(rows)
      })
      .catch(() => {
        if (live) setChecks(null)
      })
    return () => {
      live = false
    }
  }, [enabled, todayYmd, idsKey, read])
  return checks
}

const NONE: ReadonlyArray<BankCheck> = []
