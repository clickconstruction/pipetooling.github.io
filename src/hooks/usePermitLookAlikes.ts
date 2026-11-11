import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { builderName, type BuilderRow } from '../lib/research/permitBuilders'
import { permitsOnSite, readBidAddress } from '../lib/research/bidSite'
import { numbersToAsk } from '../lib/research/bidSitePanel'
import { loadAllNameAnswers, loadCustomerNames, loadPermitsByHouseNumber, loadRecentBidsWithCustomer, recordNameAnswer } from '../lib/research/bidSiteIo'
import { foldNameAnswers } from '../lib/research/nameAnswers'
import { lookAlikePairs, type LookAlike, type PermitName } from '../lib/research/nameLikeness'
import { ROBOT_BID_RE } from '../lib/bids/bidPursuit'

type Ground = { customers: Array<{ id: string; name: string }>; siteCounts: Map<string, Map<string, number>>; settled: Map<string, Set<string>> }

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
    const answers = await loadAllNameAnswers()
    if (answers == null) {
      setAbsent(true)
      return
    }
    const [customers, bids] = await Promise.all([loadCustomerNames(), loadRecentBidsWithCustomer()])
    // What each customer has settled, either way.
    const settled = new Map<string, Set<string>>()
    for (const id of new Set(answers.rows.map((r) => r.customer_id))) {
      const keys = [...foldNameAnswers(answers.rows, [id]).values()].filter((s) => s.all || s.someoneElse).map((s) => s.key)
      if (keys.length > 0) settled.set(id, new Set(keys))
    }
    // The names on permits that sit on addresses we bid to each customer, in this city.
    const siteCounts = new Map<string, Map<string, number>>()
    const ours = bids.filter((b) => !ROBOT_BID_RE.test(b.project_name ?? ''))
    const numbers = numbersToAsk(ours, [city]).get(city) ?? []
    const permits = numbers.length > 0 ? ((await loadPermitsByHouseNumber(city, numbers)) ?? []) : []
    const seen = new Set<string>()
    for (const bid of ours) {
      const site = readBidAddress(bid.address, [city])
      if (site.kind !== 'site') continue
      for (const p of permitsOnSite(site, permits)) {
        if (!p.builder_key || seen.has(`${bid.customer_id}|${p.id}`)) continue
        seen.add(`${bid.customer_id}|${p.id}`)
        const m = siteCounts.get(bid.customer_id) ?? new Map<string, number>()
        m.set(p.builder_key, (m.get(p.builder_key) ?? 0) + 1)
        siteCounts.set(bid.customer_id, m)
      }
    }
    setGround({ customers, siteCounts, settled })
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

  const names = useMemo<PermitName[]>(() => builders.map((r) => ({ key: r.key, name: builderName(r), permits: r.permits, lastOn: r.last_permit_on, kind: r.kind })), [builders])
  const pairs = useMemo(() => (absent || !ground ? null : lookAlikePairs(ground.customers, names, ground.siteCounts, ground.settled)), [absent, ground, names])

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
