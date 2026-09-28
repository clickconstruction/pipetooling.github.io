/**
 * The superintendents on a project, for the Workflow page's strip: who is
 * assigned, who could be, and the add / remove writes.
 *
 * The page calls this itself rather than the strip, so the two reads start as
 * soon as the project and the viewer's role are known — while the page is
 * still loading its steps — and the chips are there on the first paint.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SuperintendentOption } from '../lib/workflow/projectSuperintendents'

async function fetchProjectSuperintendents(projectId: string): Promise<SuperintendentOption[]> {
  const { data: psData, error } = await supabase.from('project_superintendents').select('superintendent_id').eq('project_id', projectId)
  if (error) {
    console.error('Error loading project superintendents:', error)
    return []
  }
  const ids = (psData ?? []).map((r) => r.superintendent_id).filter(Boolean)
  if (ids.length === 0) {
    return []
  }
  const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', ids)
  return (usersData ?? []) as SuperintendentOption[]
}

async function fetchAllSuperintendents(): Promise<SuperintendentOption[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'superintendent')
    .is('archived_at', null)
    .order('name')
  if (error) {
    console.error('Error loading superintendents:', error)
    return []
  }
  return (data ?? []) as SuperintendentOption[]
}

export type ProjectSuperintendents = {
  /** Assigned to this project. */
  projectSuperintendents: SuperintendentOption[]
  /** Every active superintendent, assigned or not. */
  allSuperintendents: SuperintendentOption[]
  /** An add or a remove is in flight. */
  saving: boolean
  addProjectSuperintendent: (superintendentId: string) => Promise<void>
  removeProjectSuperintendent: (superintendentId: string) => Promise<void>
}

/**
 * Loads when there is a project and the viewer may assign; otherwise both
 * lists are empty. A failed read logs and leaves its list empty; a failed
 * write goes to `onError`. An add re-reads the project's list; a remove drops
 * the row from the list in hand.
 */
export function useProjectSuperintendents(
  projectId: string | undefined,
  canAssignSuperintendents: boolean,
  onError: (message: string) => void,
): ProjectSuperintendents {
  const [projectSuperintendents, setProjectSuperintendents] = useState<SuperintendentOption[]>([])
  const [allSuperintendents, setAllSuperintendents] = useState<SuperintendentOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (projectId && canAssignSuperintendents) {
      void fetchProjectSuperintendents(projectId).then(setProjectSuperintendents)
      void fetchAllSuperintendents().then(setAllSuperintendents)
    } else {
      setProjectSuperintendents([])
      setAllSuperintendents([])
    }
  }, [projectId, canAssignSuperintendents])

  async function addProjectSuperintendent(superintendentId: string) {
    if (!projectId) return
    setSaving(true)
    const { error } = await supabase.from('project_superintendents').insert({ project_id: projectId, superintendent_id: superintendentId })
    if (error) {
      onError(`Failed to assign superintendent: ${error.message}`)
    } else {
      setProjectSuperintendents(await fetchProjectSuperintendents(projectId))
    }
    setSaving(false)
  }

  async function removeProjectSuperintendent(superintendentId: string) {
    if (!projectId) return
    setSaving(true)
    const { error } = await supabase.from('project_superintendents').delete().eq('project_id', projectId).eq('superintendent_id', superintendentId)
    if (error) {
      onError(`Failed to remove superintendent: ${error.message}`)
    } else {
      setProjectSuperintendents((prev) => prev.filter((s) => s.id !== superintendentId))
    }
    setSaving(false)
  }

  return { projectSuperintendents, allSuperintendents, saving, addProjectSuperintendent, removeProjectSuperintendent }
}
