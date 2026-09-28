/**
 * The jobs filed under a project, for the Workflow page's Jobs strip.
 *
 * The page calls this itself rather than the strip, so the read starts as
 * soon as the project is known — while the page is still loading its steps —
 * and the chips are there on the first paint.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProjectJobChip } from '../lib/workflow/projectJobs'

async function fetchProjectJobs(projectId: string): Promise<ProjectJobChip[]> {
  const { data, error } = await supabase
    .from('jobs_ledger')
    .select('id, hcp_number, job_name, status')
    .eq('project_id', projectId)
  if (error) {
    console.error('Error loading project jobs:', error)
    return []
  }
  return (data ?? []) as ProjectJobChip[]
}

/** Empty without a project; a failed read logs and leaves the list empty. */
export function useProjectJobs(projectId: string | undefined): ProjectJobChip[] {
  const [projectJobs, setProjectJobs] = useState<ProjectJobChip[]>([])

  useEffect(() => {
    if (projectId) {
      void fetchProjectJobs(projectId).then(setProjectJobs)
    } else {
      setProjectJobs([])
    }
  }, [projectId])

  return projectJobs
}
