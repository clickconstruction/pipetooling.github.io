import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import type { UserRole } from './useAuth'

export type ScopeMasterChoice = { id: string; label: string }

/**
 * The scope-leader accounts a viewer may schedule digests for (v2.3570 — lifted out of
 * `JobsReportsTab` so the Dashboard's Recent Reports door can open the same Email reports
 * modal): a master is their own; an assistant-like role gets the masters who adopted them;
 * a dev gets every active master. Everyone else gets none, which the Digests tab reads as
 * "could not resolve a scope leader".
 */
export function useRecurringReportScopeMasters(input: {
  authUserId: string | null | undefined
  authUserEmail: string | null | undefined
  authRole: UserRole | null
  authProfileName: string | null | undefined
}): readonly ScopeMasterChoice[] {
  const { authUserId, authUserEmail, authRole, authProfileName } = input
  const [choices, setChoices] = useState<readonly ScopeMasterChoice[]>([])

  useEffect(() => {
    if (!authUserId) {
      setChoices([])
      return
    }
    if (!(authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole))) {
      setChoices([])
      return
    }
    let cancelled = false

    if (authRole === 'master_technician') {
      const label = ((authProfileName ?? authUserEmail ?? authUserId) as string).trim()
      setChoices([{ id: authUserId, label }])
      return
    }

    async function load() {
      if (isAssistantLike(authRole)) {
        const { data: maps, error } = await supabase
          .from('master_assistants')
          .select('master_id')
          .eq('assistant_id', authUserId!)
        if (cancelled) return
        if (error || !maps?.length) {
          setChoices([])
          return
        }
        // master_assistants is a view since v2.2987; its ids are typed nullable.
        const mids = [...new Set(maps.map((r) => r.master_id).filter((id): id is string => !!id))]
        const { data: masters } = await supabase.from('users').select('id,name').in('id', mids)
        if (cancelled) return
        setChoices(
          ((masters ?? []) as Array<{ id: string; name: string }>).map((u) => ({
            id: u.id,
            label: (u.name ?? '').trim() || u.id,
          })),
        )
        return
      }

      if (authRole === 'dev') {
        const { data: masters } = await supabase
          .from('users')
          .select('id,name')
          .eq('role', 'master_technician')
          .is('archived_at', null)
          .order('name', { ascending: true })
          .limit(200)
        if (cancelled) return
        setChoices(
          ((masters ?? []) as Array<{ id: string; name: string }>).map((u) => ({
            id: u.id,
            label: (u.name ?? '').trim() || u.id,
          })),
        )
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authUserId, authUserEmail, authRole, authProfileName])

  return choices
}
