import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { rollupContractSigningStatusByPersonName, type ContractSigningTrafficLight, type PersonContractSigningRollupRow } from '../lib/contractSigningRollup'
import {
  groupActiveProjectsByPerson,
  type PersonActiveProject,
  type PersonActiveProjectRow,
  type PersonActiveProjectStepRow,
  type PersonActiveProjectWorkflowRow,
} from '../lib/people/personActiveProjects'

/** workflow steps → workflows → active projects, grouped by assigned name; `null` when a read fails (the last map stays). */
async function loadActiveProjectsByPerson(): Promise<Record<string, PersonActiveProject[]> | null> {
  // Get all steps with assigned people
  const { data: steps, error: stepsErr } = await supabase
    .from('project_workflow_steps')
    .select('workflow_id, assigned_to_name')
    .not('assigned_to_name', 'is', null)
  if (stepsErr) {
    console.error('Error loading steps:', stepsErr)
    return null
  }
  if (!steps || steps.length === 0) return {}

  const workflowIds = [...new Set((steps as Array<{ workflow_id: string }>).map((s) => s.workflow_id))]
  const { data: workflows, error: workflowsErr } = await supabase
    .from('project_workflows')
    .select('id, project_id')
    .in('id', workflowIds)
  if (workflowsErr) {
    console.error('Error loading workflows:', workflowsErr)
    return null
  }

  const projectIds = [...new Set((workflows as Array<{ project_id: string }>).map((w) => w.project_id))]
  const { data: projects, error: projectsErr } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds)
    .eq('status', 'active')
  if (projectsErr) {
    console.error('Error loading projects:', projectsErr)
    return null
  }

  if (!workflows || !projects) return {}
  return groupActiveProjectsByPerson(
    steps as PersonActiveProjectStepRow[],
    workflows as PersonActiveProjectWorkflowRow[],
    projects as PersonActiveProjectRow[],
  )
}

/**
 * What only the Users tab's rows read, loaded when the tab opens: who has push on, each
 * person's contract-signing light, and the active projects each name is assigned to.
 */
export function useUsersTabRowSignals(gates: { canSeePushStatus: boolean; canAccessContracts: boolean }): {
  pushEnabledUserIds: Set<string>
  contractSigningStatusByPersonName: Record<string, ContractSigningTrafficLight>
  personProjects: Record<string, PersonActiveProject[]>
} {
  const { canSeePushStatus, canAccessContracts } = gates
  const [pushEnabledUserIds, setPushEnabledUserIds] = useState<Set<string>>(new Set())
  const [contractSigningStatusByPersonName, setContractSigningStatusByPersonName] = useState<Record<string, ContractSigningTrafficLight>>({})
  const [personProjects, setPersonProjects] = useState<Record<string, PersonActiveProject[]>>({})

  useEffect(() => {
    if (!canSeePushStatus) return
    supabase
      .from('push_subscriptions')
      .select('user_id')
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
        setPushEnabledUserIds(ids)
      })
  }, [canSeePushStatus])

  useEffect(() => {
    if (!canAccessContracts) return
    supabase
      .from('person_contract_documents')
      .select('person_name, contract_lineage_id, lineage_version, status')
      .then(({ data }) => {
        setContractSigningStatusByPersonName(rollupContractSigningStatusByPersonName((data ?? []) as PersonContractSigningRollupRow[]))
      })
  }, [canAccessContracts])

  useEffect(() => {
    let cancelled = false
    void loadActiveProjectsByPerson().then((byPerson) => {
      if (!cancelled && byPerson) setPersonProjects(byPerson)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { pushEnabledUserIds, contractSigningStatusByPersonName, personProjects }
}
