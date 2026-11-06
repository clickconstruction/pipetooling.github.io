/**
 * Equipment pre-use check (punch list #270): the fleet board's read of its machines, shared by whoever mounts a piece
 * of it. `reload` reads again after a write; a failure's words come from `formatErrorMessage`.
 */
import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { loadFleet, type Fleet } from '../lib/machines/machinesIo'

/** The board's own read, shared with whoever mounts it; `rev` bumps a read again. */
export function useFleet(): { fleet: Fleet | null; problem: string | null; reload: () => void } {
  const [fleet, setFleet] = useState<Fleet | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [rev, setRev] = useState(0)
  useEffect(() => {
    let live = true
    loadFleet()
      .then((f) => live && setFleet(f))
      .catch((e) => live && setProblem(formatErrorMessage(e, 'The machines did not read.')))
    return () => {
      live = false
    }
  }, [rev])
  const reload = useCallback(() => setRev((r) => r + 1), [])
  return { fleet, problem, reload }
}

