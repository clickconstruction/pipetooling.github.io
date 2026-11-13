import { useCallback, useEffect, useState } from 'react'
import type { PartTie, TieVerdict } from '../lib/materials/partTies'
import { deletePartTie, fetchPartTies, insertPartTie, type TieScope } from '../lib/materials/partTiesIo'

export type PartTiesState = {
  ties: PartTie[]
  /** The answers were read. False while reading and when the read was refused: the screen then asks nothing and folds only the same words. */
  available: boolean
  /** Write one answer; the list holds it once the table has. Throws the table's refusal. */
  answer: (tie: { aKey: string; bKey: string; aName: string; bName: string; verdict: TieVerdict }, byName: string) => Promise<void>
  /** Take one answer back. Throws the table's refusal. */
  undo: (id: string) => Promise<void>
}

/**
 * A site's part-name answers (punch list #330, PR 3): read once per site, then kept in step with
 * each answer and each Undo. A read that fails leaves the screen as it is without ties.
 */
export function usePartTies(scope: TieScope | null, io: { fetch: typeof fetchPartTies; insert: typeof insertPartTie; remove: typeof deletePartTie } = { fetch: fetchPartTies, insert: insertPartTie, remove: deletePartTie }): PartTiesState {
  const [ties, setTies] = useState<PartTie[]>([])
  const [available, setAvailable] = useState(false)
  const scopeKey = scope ? ('developmentId' in scope ? `d:${scope.developmentId}` : `j:${scope.jobId}`) : ''

  useEffect(() => {
    setTies([])
    setAvailable(false)
    if (!scope) return
    let live = true
    io.fetch(scope)
      .then((rows) => {
        if (!live) return
        setTies(rows)
        setAvailable(true)
      })
      .catch(() => {
        // The screen keeps its same-words rows and asks nothing.
      })
    return () => {
      live = false
    }
    // The scope is read through its key; `io` is the module's own functions unless a test hands in others.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey])

  const answer = useCallback<PartTiesState['answer']>(
    async (tie, byName) => {
      if (!scope) return
      const row = await io.insert(scope, tie, byName)
      setTies((prev) => [...prev.filter((t) => t.id !== row.id), row])
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey],
  )
  const undo = useCallback<PartTiesState['undo']>(
    async (id) => {
      await io.remove(id)
      setTies((prev) => prev.filter((t) => t.id !== id))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return { ties, available, answer, undo }
}
