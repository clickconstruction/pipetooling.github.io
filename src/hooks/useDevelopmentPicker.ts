import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { resolveCompanyOwnerUserId } from '../lib/companyOwner'
import { validateNewDevelopmentName, type JobFormDevelopmentRow } from '../lib/jobs/jobDevelopments'
import { formatErrorMessage } from '../utils/errorHandling'

/**
 * The developments list and the inline create for a form's Development picker (punch list
 * #208, v2.6019). Edit Job owns its own copy inside `JobFormModal` (`createDevelopmentFromPicker`);
 * the Bid form, whose engine lives in `Bids.tsx`, takes this hook instead of threading two more
 * props through the page. The list loads once each time `enabled` turns on (the form opening),
 * so a development made on Edit Job is in the list the next time a bid is opened. The create
 * writes a name-only row under the company owner, the account every new customer, project and
 * job is stamped with, then prepends it and resolves its id; a refused or failed insert is
 * toasted with its reason and resolves null, and the picker stays where it was.
 */
export function useDevelopmentPicker(enabled: boolean): {
  developments: JobFormDevelopmentRow[]
  createDevelopment: (name: string) => Promise<string | null>
} {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [developments, setDevelopments] = useState<JobFormDevelopmentRow[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.from('developments').select('id, name, master_user_id, archived_at').order('name')
      if (cancelled || error) return
      setDevelopments((data as JobFormDevelopmentRow[] | null) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  const createDevelopment = useCallback(
    async (rawName: string): Promise<string | null> => {
      if (!user?.id) return null
      const check = validateNewDevelopmentName(rawName, developments)
      if (!check.ok) {
        showToast(check.error, 'error')
        return null
      }
      try {
        const masterId = await resolveCompanyOwnerUserId(supabase, user.id)
        const { data: inserted, error: insErr } = await supabase
          .from('developments')
          .insert({ master_user_id: masterId, name: check.name })
          .select('id, name, master_user_id, archived_at')
          .single()
        if (insErr) throw insErr
        const row = inserted as JobFormDevelopmentRow
        setDevelopments((prev) => [row, ...prev])
        showToast(`Development "${check.name}" created.`, 'success')
        return row.id
      } catch (e) {
        showToast(`Could not create development: ${formatErrorMessage(e)}`, 'error')
        return null
      }
    },
    [developments, showToast, user?.id],
  )

  return { developments, createDevelopment }
}
