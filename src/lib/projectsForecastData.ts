/**
 * Projects → Forecast: types + Supabase loaders.
 *
 * Reads the same `project_workflow_steps` rows the Workflow page uses, but scoped to "all
 * jobs with `project_id IS NOT NULL`, any status". Two loaders:
 *
 *   1. `fetchForecastJobs({ customerId })` — loads `jobs_ledger` rows that have a project,
 *      joins each project's single `project_workflows` row (id only), and returns a slim job
 *      list plus a `Map<projectId, workflowId>` so the second loader can hit `project_workflow_steps`
 *      in one batched IN-clause.
 *
 *   2. `fetchForecastStages(workflowIds)` — loads every step for those workflows. RLS
 *      naturally scopes by role (dev / master see all, others see what the policies allow).
 *      Returns rows in `(workflow_id, sequence_order)` order.
 *
 * Both loaders return cancellation-safe data — they don't read mutable state and can be
 * called from `useEffect`s without their own generation token (the calling tab owns the
 * gen token, as is the pattern in `ProjectsJobHistoryTab`).
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'

// `jobs_ledger.status` is a plain `string` in the schema (not an enum) — values like
// 'working' / 'ready_to_bill' / 'billed' show up at runtime. Keeping it as `string` matches
// the generated Database type and means downstream UI can compare directly without casts.
export type ForecastJobStatus = string
export type ForecastStageStatus = Database['public']['Enums']['step_status']

export type ForecastJob = {
  id: string
  hcp_number: string
  click_number: string
  job_name: string
  job_address: string | null
  status: ForecastJobStatus
  service_type_id: string | null
  project_id: string
  project_name: string | null
}

export type ForecastWorkflowMap = Map<string, string>

export type ForecastStage = {
  id: string
  workflow_id: string
  sequence_order: number
  name: string
  status: ForecastStageStatus
  assigned_to_name: string | null
  scheduled_start_date: string | null
  scheduled_end_date: string | null
  started_at: string | null
  ended_at: string | null
  skipped_reason: string | null
  percent_complete: number | null
}

type JobsLedgerRow = {
  id: string
  hcp_number: string
  click_number: string
  job_name: string
  job_address: string | null
  status: ForecastJobStatus
  service_type_id: string | null
  project_id: string | null
  projects: { id: string; name: string | null } | null
}

type ProjectWorkflowsRow = {
  id: string
  project_id: string
}

export type FetchForecastJobsResult = {
  jobs: ForecastJob[]
  workflowByProject: ForecastWorkflowMap
}

/**
 * Load all jobs with a project, plus the project's name and its single workflow id.
 * Filters out jobs whose project does not yet have a workflow row (nothing to chart).
 *
 * @param opts.customerId Optional — when set, restrict to jobs for this customer.
 */
export async function fetchForecastJobs(opts: { customerId?: string | null } = {}): Promise<FetchForecastJobsResult> {
  const { customerId } = opts

  // Step 1: jobs_ledger rows with project_id, hydrating the project name in one shot.
  let jobsQuery = supabase
    .from('jobs_ledger')
    .select(
      'id, hcp_number, click_number, job_name, job_address, status, service_type_id, project_id, projects:project_id(id, name)',
    )
    .not('project_id', 'is', null)
    .order('hcp_number', { ascending: false })
  if (customerId) jobsQuery = jobsQuery.eq('customer_id', customerId)

  const jobsData = (await withSupabaseRetry(
    async () => jobsQuery,
    'fetch jobs_ledger with project for forecast',
  )) as unknown as JobsLedgerRow[] | null

  const jobRows = jobsData ?? []
  if (jobRows.length === 0) {
    return { jobs: [], workflowByProject: new Map() }
  }

  // Step 2: pull the single workflow id per project in one IN-clause. Most projects have
  // exactly one workflow; if a duplicate sneaks through we keep the first by id ASC so
  // results are deterministic across reloads.
  const projectIds = Array.from(new Set(jobRows.map((r) => r.project_id!).filter(Boolean)))
  let workflowByProject: ForecastWorkflowMap = new Map()
  if (projectIds.length > 0) {
    const wfData = (await withSupabaseRetry(
      async () =>
        supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('project_id', projectIds)
          .order('id', { ascending: true }),
      'fetch project_workflows for forecast',
    )) as unknown as ProjectWorkflowsRow[] | null

    workflowByProject = new Map()
    for (const wf of wfData ?? []) {
      // First write wins (deterministic with the `order: id ASC` above).
      if (!workflowByProject.has(wf.project_id)) {
        workflowByProject.set(wf.project_id, wf.id)
      }
    }
  }

  const jobs: ForecastJob[] = jobRows
    .filter((r) => r.project_id != null && workflowByProject.has(r.project_id))
    .map((r) => ({
      id: r.id,
      hcp_number: r.hcp_number,
      click_number: r.click_number,
      job_name: r.job_name,
      job_address: r.job_address ?? null,
      status: r.status,
      service_type_id: r.service_type_id ?? null,
      project_id: r.project_id as string,
      project_name: r.projects?.name ?? null,
    }))

  return { jobs, workflowByProject }
}

/**
 * Load every `project_workflow_steps` row for the given workflow IDs, sorted by
 * `(workflow_id, sequence_order)` so callers can group by `workflow_id` in one pass.
 *
 * Returns an empty array when `workflowIds` is empty (avoids a wasted round trip).
 */
export async function fetchForecastStages(workflowIds: readonly string[]): Promise<ForecastStage[]> {
  if (!workflowIds || workflowIds.length === 0) return []
  const uniq = Array.from(new Set(workflowIds))
  const data = (await withSupabaseRetry(
    async () =>
      supabase
        .from('project_workflow_steps')
        .select(
          'id, workflow_id, sequence_order, name, status, assigned_to_name, scheduled_start_date, scheduled_end_date, started_at, ended_at, skipped_reason, percent_complete',
        )
        .in('workflow_id', uniq)
        .order('workflow_id', { ascending: true })
        .order('sequence_order', { ascending: true }),
    'fetch project_workflow_steps for forecast',
  )) as unknown as ForecastStage[] | null
  return data ?? []
}

/** Group an unsorted array of stages by workflow_id, preserving per-workflow `sequence_order`
 *  ordering as long as the source array was sorted by `(workflow_id, sequence_order)` — which
 *  `fetchForecastStages` already guarantees. */
export function groupStagesByWorkflow(stages: readonly ForecastStage[]): Map<string, ForecastStage[]> {
  const m = new Map<string, ForecastStage[]>()
  for (const s of stages) {
    const arr = m.get(s.workflow_id)
    if (arr) {
      arr.push(s)
    } else {
      m.set(s.workflow_id, [s])
    }
  }
  return m
}
