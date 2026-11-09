import { useEffect, useMemo, useState } from 'react'
import { deskLoadState, jobIdsWithData, jobLoadState, loadDesk } from '../lib/materials/onSiteStore'
import { jobMaterialsSummaryFor } from '../lib/materials/onSiteSummary'
import { materialsNeeds, type MaterialsNeeds } from '../lib/needsYou/materialsOnSite'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'
import { useOnSiteStoreVersion } from './useOnSiteStore'

/**
 * Materials on site for the Needs you card (punch list #209, v2.6728): every job with a live box,
 * read through the on-site store's desk load — the same cache Jobs → Materials, the Job window's
 * tab and the ⋯ menu's count read, so the card's figures are the desk's by construction. Null until
 * the desk has loaded and on a refused read, so the card stays quiet; a press on the phone or the
 * office page lands in the store and the line moves with it. ZZ test jobs drop out by id when the
 * viewer hides them.
 */
export function useMaterialsOnSiteNeeds(enabled: boolean, opts: { hideZzTestJobs: boolean; userId: string | null | undefined }): { needs: MaterialsNeeds | null } {
  const version = useOnSiteStoreVersion()
  const [zzIds, setZzIds] = useState<Set<string> | null>(null)
  const { hideZzTestJobs, userId } = opts

  useEffect(() => {
    if (enabled) void loadDesk()
  }, [enabled])

  useEffect(() => {
    if (!enabled || !hideZzTestJobs) {
      setZzIds(null)
      return
    }
    let cancelled = false
    void loadZzTestJobIds(userId)
      .then((ids) => {
        if (!cancelled) setZzIds(ids)
      })
      .catch(() => {
        if (!cancelled) setZzIds(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [enabled, hideZzTestJobs, userId])

  const needs = useMemo(() => {
    void version
    if (!enabled) return null
    const desk = deskLoadState()
    if (!desk.loaded || desk.error) return null
    if (hideZzTestJobs && zzIds == null) return null
    const now = new Date()
    const facts = jobIdsWithData()
      .filter((id) => jobLoadState(id).loaded && !(zzIds?.has(id) ?? false))
      .map((id) => {
        const s = jobMaterialsSummaryFor(id, now)
        return { jobId: id, stale: s.stale.length, missingLines: s.missingLines, missingMoneyWeek: s.missingMoneyWeek }
      })
    return materialsNeeds(facts)
  }, [enabled, hideZzTestJobs, version, zzIds])

  return { needs }
}
