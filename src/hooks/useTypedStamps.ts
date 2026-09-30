import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTypedStamps } from '../lib/clock/loadTypedStamps'
import type { TypedStamp } from '../lib/clock/typedHours'

const EMPTY: ReadonlyMap<string, TypedStamp> = new Map()

/**
 * The typed-hours stamps for the sessions a list is showing (v2.4242): who typed hours onto each,
 * and whether the viewer is held from approving it. Reads again when the set of ids changes, when
 * `version` changes (pass `typedStampsVersion(rows)` so an edit to a row's times re-reads its
 * stamp), or when `reload()` is called. Keeps the last answer while the next one loads, so a list
 * does not flicker its stamps off and on.
 */
export function useTypedStamps(sessionIds: readonly string[], version = ''): {
  stamps: ReadonlyMap<string, TypedStamp>
  reload: () => void
} {
  const key = useMemo(() => Array.from(new Set(sessionIds)).sort().join(','), [sessionIds])
  const [stamps, setStamps] = useState<ReadonlyMap<string, TypedStamp>>(EMPTY)
  const [nonce, setNonce] = useState(0)
  const runRef = useRef(0)

  useEffect(() => {
    const run = ++runRef.current
    if (key === '') {
      setStamps(EMPTY)
      return
    }
    void loadTypedStamps(key.split(',')).then((next) => {
      if (runRef.current === run) setStamps(next)
    })
  }, [key, version, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { stamps, reload }
}
