/**
 * Store for dev-only checklist cost estimates (`checklist_item_costs`).
 *
 * Keys are "cost keys": the roadmap task id for bridged roadmap tasks (so
 * Review rows and the roadmap Plan view share one estimate per task), the
 * checklist_items id otherwise. RLS is dev-only in both directions — other
 * roles read an empty set, so callers gate loading on the dev role rather
 * than firing a query that RLS will blank anyway.
 *
 * A module-level cache keeps chips synchronous; the window event
 * CHECKLIST_COST_CHANGED_EVENT fans writes out to every mounted consumer
 * (same pattern as the `checklist-item-saved` cross-surface refresh).
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { ChecklistCostEstimate } from './checklistCostEstimate'

/** Fired on window whenever the estimate cache changes (detail: costKey | null). */
export const CHECKLIST_COST_CHANGED_EVENT = 'checklist-cost-changed'

let cache: Record<string, ChecklistCostEstimate> = {}
let loadPromise: Promise<void> | null = null

type CostRow = {
  cost_key: string
  person_user_id: string | null
  person_name: string
  hours: number
  rate: number
  updated_at: string
  actual_hours: number | null
}

function notify(costKey: string | null) {
  window.dispatchEvent(new CustomEvent(CHECKLIST_COST_CHANGED_EVENT, { detail: costKey }))
}

/** Synchronous snapshot of the cache (empty until the first load resolves). */
export function cachedChecklistCostEstimates(): Record<string, ChecklistCostEstimate> {
  return cache
}

/** Load all estimates once; concurrent callers share the fetch. Failed loads retry on the next call. */
export function ensureChecklistCostEstimatesLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const rows = (await withSupabaseRetry(
        () => supabase.from('checklist_item_costs').select('cost_key, person_user_id, person_name, hours, rate, updated_at, actual_hours'),
        'load checklist cost estimates',
      )) as CostRow[] | null
      const next: Record<string, ChecklistCostEstimate> = {}
      for (const r of rows ?? []) {
        next[r.cost_key] = {
          userId: r.person_user_id,
          personName: r.person_name,
          hours: Number(r.hours),
          rate: Number(r.rate),
          updatedAt: r.updated_at,
          actualHours: r.actual_hours == null ? null : Number(r.actual_hours),
        }
      }
      cache = next
      notify(null)
    })().catch((e: unknown) => {
      loadPromise = null
      throw e instanceof Error ? e : new Error('Failed to load cost estimates')
    })
  }
  return loadPromise
}

export async function writeChecklistCostEstimate(
  costKey: string,
  estimate: ChecklistCostEstimate | null,
): Promise<void> {
  if (estimate) {
    const { data: sessionData } = await supabase.auth.getSession()
    await withSupabaseRetry(
      () =>
        supabase.from('checklist_item_costs').upsert({
          cost_key: costKey,
          person_user_id: estimate.userId,
          person_name: estimate.personName,
          hours: estimate.hours,
          rate: estimate.rate,
          created_by_user_id: sessionData.session?.user.id ?? null,
          updated_at: new Date().toISOString(),
        }),
      'save checklist cost estimate',
    )
    cache = { ...cache, [costKey]: { ...estimate, actualHours: estimate.actualHours ?? cache[costKey]?.actualHours ?? null } }
  } else {
    await withSupabaseRetry(
      () => supabase.from('checklist_item_costs').delete().eq('cost_key', costKey),
      'remove checklist cost estimate',
    )
    const { [costKey]: _removed, ...rest } = cache
    cache = rest
  }
  notify(costKey)
}

/**
 * Record (or clear) how long a costed task really took. Independent of the
 * estimate write — sign-off taps and the modal's after-the-fact path both land
 * here. No-op if no estimate row exists for the key.
 */
export async function writeChecklistCostActual(costKey: string, actualHours: number | null): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  await withSupabaseRetry(
    () =>
      supabase
        .from('checklist_item_costs')
        .update({
          actual_hours: actualHours,
          actual_recorded_by_user_id: actualHours == null ? null : (sessionData.session?.user.id ?? null),
          actual_recorded_at: actualHours == null ? null : new Date().toISOString(),
        })
        .eq('cost_key', costKey),
    'record checklist cost actual',
  )
  const existing = cache[costKey]
  if (existing) cache = { ...cache, [costKey]: { ...existing, actualHours } }
  notify(costKey)
}
