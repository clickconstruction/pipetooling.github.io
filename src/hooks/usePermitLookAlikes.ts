import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import type { BuilderRow } from '../lib/research/permitBuilders'
import { recordNameAnswer } from '../lib/research/bidSiteIo'
import type { LookAlike } from '../lib/research/nameLikeness'
import { loadCitySiteCounts, loadLookAlikeShared } from '../lib/research/lookAlikeIo'
import { cityLookAlikes, settledNames } from '../lib/research/lookAlikeWorklist'

type Ground = { customers: ReadonlyArray<{ id: string; name: string }>; siteCounts: Map<string, Map<string, number>>; settled: Map<string, Set<string>> }

/**
 * Looks like a customer (punch list #307, PR 10): every name on a city's permits that may be one
 * of our customers, for the worklist on Builders. `null` pairs mean the answers table is not on
 * the database yet, and the chip is not drawn. An answer drops its pair and reads the answers
 * again. Site evidence comes from the newest thousand bids with a customer on them.
 */
export function usePermitLookAlikes(city: string, builders: readonly BuilderRow[]): { pairs: LookAlike[] | null; error: string | null; busy: boolean; answer: (pair: LookAlike, tie: boolean) => Promise<void> } {
  const [ground, setGround] = useState<Ground | null>(null)
  const [absent, setAbsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const shared = await loadLookAlikeShared()
    if (shared == null) {
      setAbsent(true)
      return
    }
    setGround({ customers: shared.customers, siteCounts: await loadCitySiteCounts(city, shared.bids), settled: settledNames(shared.answers) })
  }, [city])

  useEffect(() => {
    let live = true
    setGround(null)
    setAbsent(false)
    load().catch((e) => {
      if (live) setError(formatErrorMessage(e))
    })
    return () => {
      live = false
    }
  }, [load])

  const pairs = useMemo(() => (absent || !ground ? null : cityLookAlikes(ground, builders, ground.siteCounts, ground.settled)), [absent, ground, builders])

  const answer = useCallback(
    async (pair: LookAlike, tie: boolean) => {
      setBusy(true)
      setError(null)
      try {
        await recordNameAnswer({ builderKey: pair.suggestion.key, customerId: pair.customerId, answer: tie ? 'works_for' : 'someone_else', scope: tie ? 'all' : null, permitId: null, name: pair.suggestion.name })
        await load()
      } catch (e) {
        setError(formatErrorMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  return { pairs, error, busy, answer }
}
