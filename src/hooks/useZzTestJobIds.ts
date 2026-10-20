import { useCallback, useEffect, useState } from 'react'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'

export type ZzTestJobIdsStatus = 'off' | 'loading' | 'ready' | 'failed'

export type ZzTestJobIdsState = {
  /** The ids once `ready`; null otherwise. */
  ids: ReadonlySet<string> | null
  status: ZzTestJobIdsStatus
  /** Start again after `failed` (a "Try again" button). */
  retry: () => void
}

/** The waits before the second and third tries, in ms. After the third failure the status is `failed`. */
export const ZZ_TEST_JOB_IDS_RETRY_DELAYS_MS = [1_000, 3_000] as const

/**
 * The shared ZZ test job ids (punch list #61, `zzTestJobRows.ts`) for a screen whose rows carry only a
 * job id or no customer name. `off` when the role sees ZZ jobs. A screen holds such rows until `ready`
 * and fails closed on `failed` (review on #5241): a ZZ customer's job must not show while the ids load,
 * nor for the rest of the session after a read that failed.
 */
export function useZzTestJobIds(enabled: boolean, userId: string | null | undefined): ZzTestJobIdsState {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null)
  const [status, setStatus] = useState<ZzTestJobIdsStatus>(enabled ? 'loading' : 'off')
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setIds(null)
      setStatus('off')
      return
    }
    let cancelled = false
    setIds(null)
    setStatus('loading')
    const timers: number[] = []
    const attempt = (n: number) => {
      loadZzTestJobIds(userId).then(
        (next) => {
          if (cancelled) return
          setIds(next)
          setStatus('ready')
        },
        () => {
          if (cancelled) return
          const wait = ZZ_TEST_JOB_IDS_RETRY_DELAYS_MS[n]
          if (wait == null) setStatus('failed')
          else timers.push(window.setTimeout(() => attempt(n + 1), wait))
        },
      )
    }
    attempt(0)
    return () => {
      cancelled = true
      for (const t of timers) window.clearTimeout(t)
    }
  }, [enabled, userId, nonce])

  return { ids, status, retry }
}
