import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import type { UserRow } from '../types/settingsRows'

type JobCountByMasterRow =
  Database['public']['Functions']['list_job_counts_by_master_for_dev_settings']['Returns'][number]

/**
 * Settings → Jobs & dispatch admin engine (dev only): job-creation owner
 * overrides (`app_settings` dynamic keys `job_owner_override_<userId>`,
 * delete-when-empty), bulk job re-assign (`jobs_ledger.master_user_id` with
 * optimistic count fix-up), and the default labor rate. Extracted verbatim
 * from Settings.tsx (v2.856); loads on mount when `enabled` (dev).
 * `setError` is the parent's shared error state (map quirk #4).
 */
export function useSettingsJobsAdmin({
  enabled,
  users,
  setError,
}: {
  enabled: boolean
  users: UserRow[]
  setError: (message: string | null) => void
}) {
  const { showToast } = useToastContext()

  const [jobOwnerOverridesSectionOpen, setJobOwnerOverridesSectionOpen] = useState(false)
  const [jobOwnerOverrideByUserId, setJobOwnerOverrideByUserId] = useState<Record<string, string>>({})
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
      const creators = users.filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role))
      for (const u of creators) {
        const key = `job_owner_override_${u.id}`
        const selected = jobOwnerOverrideByUserId[u.id]
        if (!selected || selected === '') {
          await supabase.from('app_settings').delete().eq('key', key)
        } else {
          await supabase.from('app_settings').upsert({ key, value_text: selected }, { onConflict: 'key' })
        }
      }
      showToast('Job creation overrides saved.', 'success')
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
        supabase.from('app_settings').select('key, value_text').like('key', 'job_owner_override_%'),
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

      const overrides: Record<string, string> = {}
      for (const row of jobOwnerResult.data ?? []) {
        const userId = row.key.replace(/^job_owner_override_/, '')
        if (userId && row.value_text) overrides[userId] = row.value_text
      }
      setJobOwnerOverrideByUserId(overrides)

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
    jobOwnerOverrideByUserId,
    setJobOwnerOverrideByUserId,
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
