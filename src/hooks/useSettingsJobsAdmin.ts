import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import type { UserRow } from '../types/settingsRows'
import { COMPANY_OWNER_USER_ID_KEY, JOB_OWNER_OVERRIDE_DEFAULT_KEY, invalidateCompanyOwnerCache } from '../lib/companyOwner'

type JobCountByMasterRow =
  Database['public']['Functions']['list_job_counts_by_master_for_dev_settings']['Returns'][number]

/**
 * Settings → Jobs & dispatch admin engine (dev only): the company owner account
 * (`app_settings.company_owner_user_id`, one company v2.2972 — replaces the
 * per-user `job_owner_override_<userId>` chain), bulk job re-assign
 * (`jobs_ledger.master_user_id` with optimistic count fix-up), and the default
 * labor rate. Extracted from Settings.tsx (v2.856); loads on mount when `enabled` (dev).
 * `setError` is the parent's shared error state (map quirk #4).
 */
export function useSettingsJobsAdmin({
  enabled,
  setError,
}: {
  enabled: boolean
  users: UserRow[]
  setError: (message: string | null) => void
}) {
  const { showToast } = useToastContext()

  const [jobOwnerOverridesSectionOpen, setJobOwnerOverridesSectionOpen] = useState(false)
  /** One company (v2.2972): the account every new customer / project / job / estimate is filed under. */
  const [companyOwnerUserId, setCompanyOwnerUserId] = useState('')
  const [jobOwnerOverridesSaving, setJobOwnerOverridesSaving] = useState(false)
  const [jobCountByUserId, setJobCountByUserId] = useState<Record<string, number>>({})
  const [reassignTargetByUserId, setReassignTargetByUserId] = useState<Record<string, string>>({})
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false)
  const [reassignSourceUserId, setReassignSourceUserId] = useState<string | null>(null)
  const [reassignTargetUserId, setReassignTargetUserId] = useState<string | null>(null)
  const [reassignSubmitting, setReassignSubmitting] = useState(false)
  const [defaultLaborRateSectionOpen, setDefaultLaborRateSectionOpen] = useState(false)
  const [defaultLaborRate, setDefaultLaborRate] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)

  async function saveJobOwnerOverrides(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setJobOwnerOverridesSaving(true)
    try {
      if (!companyOwnerUserId) {
        await supabase.from('app_settings').delete().eq('key', COMPANY_OWNER_USER_ID_KEY)
      } else {
        await supabase
          .from('app_settings')
          .upsert({ key: COMPANY_OWNER_USER_ID_KEY, value_text: companyOwnerUserId }, { onConflict: 'key' })
      }
      // The legacy org-wide fallback is superseded by the row above; clear it so the
      // SQL and client fallback chains cannot disagree.
      await supabase.from('app_settings').delete().eq('key', JOB_OWNER_OVERRIDE_DEFAULT_KEY)
      invalidateCompanyOwnerCache()
      showToast('Company owner account saved.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setJobOwnerOverridesSaving(false)
    }
  }

  async function confirmReassignJobs() {
    if (!reassignSourceUserId || !reassignTargetUserId) return
    setReassignSubmitting(true)
    try {
      const { error } = await supabase
        .from('jobs_ledger')
        .update({ master_user_id: reassignTargetUserId })
        .eq('master_user_id', reassignSourceUserId)
      setReassignConfirmOpen(false)
      setReassignSourceUserId(null)
      setReassignTargetUserId(null)
      if (error) setError(error.message)
      else {
        showToast('Jobs reassigned.', 'success')
        setJobCountByUserId((prev) => ({
          ...prev,
          [reassignSourceUserId]: 0,
          [reassignTargetUserId]: (prev[reassignTargetUserId] ?? 0) + (prev[reassignSourceUserId] ?? 0),
        }))
      }
    } finally {
      setReassignSubmitting(false)
    }
  }

  async function saveDefaultLaborRate(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setDefaultLaborRateSaving(true)
    const val = defaultLaborRate.trim() === '' ? null : parseFloat(defaultLaborRate) || null
    const { error } = await supabase.from('app_settings').upsert({ key: 'default_labor_rate', value_num: val }, { onConflict: 'key' })
    setDefaultLaborRateSaving(false)
    if (error) setError(error.message)
  }

  // Initial loads (were part of Settings.tsx loadData's dev branch)
  useEffect(() => {
    if (!enabled) return
    void (async () => {
      const [laborRes, jobOwnerResult, jobCountsResult] = await Promise.all([
        supabase.from('app_settings').select('value_num').eq('key', 'default_labor_rate').maybeSingle(),
        supabase.from('app_settings').select('key, value_text').in('key', [COMPANY_OWNER_USER_ID_KEY, JOB_OWNER_OVERRIDE_DEFAULT_KEY]),
        (async (): Promise<JobCountByMasterRow[]> => {
          try {
            const rows = await withSupabaseRetry(
              () => supabase.rpc('list_job_counts_by_master_for_dev_settings'),
              'list_job_counts_by_master_for_dev_settings',
            )
            return rows ?? []
          } catch {
            return []
          }
        })(),
      ])

      const laborVal = (laborRes.data as { value_num: number | null } | null)?.value_num
      setDefaultLaborRate(laborVal != null ? String(laborVal) : '')

      const settingRows = jobOwnerResult.data ?? []
      // The row wins; while it is unset the legacy org-wide default shows as the current value.
      const owner =
        settingRows.find((r) => r.key === COMPANY_OWNER_USER_ID_KEY)?.value_text?.trim() ||
        settingRows.find((r) => r.key === JOB_OWNER_OVERRIDE_DEFAULT_KEY)?.value_text?.trim() ||
        ''
      setCompanyOwnerUserId(owner)

      const counts: Record<string, number> = {}
      for (const row of jobCountsResult) {
        if (row.master_user_id) counts[row.master_user_id] = Number(row.job_count)
      }
      setJobCountByUserId(counts)
    })()
  }, [enabled])

  return {
    jobOwnerOverridesSectionOpen,
    setJobOwnerOverridesSectionOpen,
    companyOwnerUserId,
    setCompanyOwnerUserId,
    jobOwnerOverridesSaving,
    jobCountByUserId,
    reassignTargetByUserId,
    setReassignTargetByUserId,
    reassignConfirmOpen,
    setReassignConfirmOpen,
    reassignSourceUserId,
    setReassignSourceUserId,
    reassignTargetUserId,
    setReassignTargetUserId,
    reassignSubmitting,
    defaultLaborRateSectionOpen,
    setDefaultLaborRateSectionOpen,
    defaultLaborRate,
    setDefaultLaborRate,
    defaultLaborRateSaving,
    saveJobOwnerOverrides,
    confirmReassignJobs,
    saveDefaultLaborRate,
  }
}
