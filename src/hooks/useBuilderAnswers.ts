import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { loadBuilderAnswersGround, type BuilderAnswersGround } from '../lib/research/builderAnswersIo'

/**
 * The answers on names for Builders (punch list #307): read once for the list, and again when
 * `reload` is called after an answer. `ground` is null while it reads, when the answers table is
 * not on the database yet, and when the read fails; `error` says why it failed, so the list
 * still draws with the same-name count alone.
 */
export function useBuilderAnswers(): { ground: BuilderAnswersGround | null; error: string | null; reload: () => void } {
  const [ground, setGround] = useState<BuilderAnswersGround | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asked, setAsked] = useState(0)

  useEffect(() => {
    let live = true
    loadBuilderAnswersGround()
      .then((g) => {
        if (!live) return
        setGround(g)
        setError(null)
      })
      .catch((e) => {
        if (live) setError(formatErrorMessage(e))
      })
    return () => {
      live = false
    }
  }, [asked])

  const reload = useCallback(() => setAsked((n) => n + 1), [])
  return { ground, error, reload }
}
