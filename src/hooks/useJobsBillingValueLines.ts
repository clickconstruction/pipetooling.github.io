/**
 * The live values on Settings → Jobs & billing's folded Billing and money cards (punch list #261, PR 3). One select of
 * the `app_settings` keys the role's cards read, and the Job Book's line count when the role sees that card, turned
 * into one line each by `lib/settings/jobsBillingValueLines.ts`. Reads on mount and again on `refresh`, which the page
 * wires to a card's fold, so the value saved inside a card is on its row the moment the card closes. A read that fails
 * leaves the lines as they were (the fold header keeps its static line), since the card itself names the failure when
 * it is opened. Nothing here writes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserRole } from './useAuth'
import { supabase } from '../lib/supabase'
import { jobsBillingGroupsFor } from '../lib/settings/jobsBillingGroups'
import { isJobsBillingValueSlug, jobsBillingValueKeysFor, jobsBillingValueLines, type AppSettingValueRow, type JobsBillingValueLines, type JobsBillingValueSlug } from '../lib/settings/jobsBillingValueLines'

/** Pure: the money cards the role is shown, in order. */
export function jobsBillingValueSlugsFor(role: UserRole | null | undefined): JobsBillingValueSlug[] {
  return jobsBillingGroupsFor(role)
    .flatMap((g) => g.cards)
    .map((c) => c.slug as string)
    .filter(isJobsBillingValueSlug)
}

export function useJobsBillingValueLines(role: UserRole | null | undefined): { lines: JobsBillingValueLines; refresh: () => void } {
  const [lines, setLines] = useState<JobsBillingValueLines>({})
  const [tick, setTick] = useState(0)
  const alive = useRef(true)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    alive.current = true
    const slugs = jobsBillingValueSlugsFor(role)
    if (slugs.length === 0) {
      setLines({})
      return
    }
    const keys = jobsBillingValueKeysFor(slugs)
    void (async () => {
      const [settings, jobBook] = await Promise.all([
        keys.length ? supabase.from('app_settings').select('key, value_num, value_text').in('key', keys) : Promise.resolve({ data: [] as AppSettingValueRow[], error: null }),
        slugs.includes('job-book') ? supabase.from('job_book_entries').select('id', { count: 'exact', head: true }) : Promise.resolve(null),
      ])
      if (!alive.current) return
      if (settings.error) return
      const jobBookLines = jobBook && !jobBook.error && typeof jobBook.count === 'number' ? jobBook.count : null
      setLines(jobsBillingValueLines({ settings: (settings.data ?? []) as AppSettingValueRow[], jobBookLines }, slugs))
    })()
    return () => {
      alive.current = false
    }
  }, [role, tick])

  return { lines, refresh }
}
