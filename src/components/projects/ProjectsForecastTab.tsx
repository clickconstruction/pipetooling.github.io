/**
 * Projects → Forecast tab (parent).
 *
 * Owns the shared data layer for the two sub-tabs:
 *   - `jobs` and `prefixMap` from `fetchForecastJobs` (jobs_ledger with `project_id` + project name).
 *   - `stagesByWorkflow` from `fetchForecastStages` for those workflows.
 *
 * Renders a small sub-tab strip (Specific / All Stages) and dispatches to the right child.
 * The two sub-tabs read the same upstream data but keep their own UI state (range, search,
 * toggles, selected job) — see each sub-tab for localStorage / URL keys.
 *
 * Realtime: one channel scoped to `project_workflow_steps` + `jobs_ledger` with a
 * 280 ms debounce and document-visibility gate, mirroring `ProjectsJobHistoryTab`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentVisibility } from '../../hooks/useDocumentVisibility'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { buildLedgerPrefixMap, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import {
  fetchForecastJobs,
  fetchForecastStages,
  groupStagesByWorkflow,
  type ForecastJob,
  type ForecastStage,
  type ForecastWorkflowMap,
} from '../../lib/projectsForecastData'
import { pageUnderlineTabStyle } from '../../lib/pageUnderlineTabStyle'
import { ProjectsForecastSpecificTab } from './ProjectsForecastSpecificTab'
import { ProjectsForecastAllStagesTab } from './ProjectsForecastAllStagesTab'

type Props = {
  customerId: string | null
  /** Current user's role. Forwarded only to the Specific sub-tab — its stage detail
   *  modal uses this to gate the date edit controls behind the same role set that the
   *  `project_workflow_steps` UPDATE RLS policy allows. The All Stages sub-tab is
   *  read-only today and does not consume this prop. */
  myRole?: string | null
}

type ServiceTypeRow = { id: string; ledger_job_prefix: string | null; ledger_bid_prefix: string | null }

const MAX_REALTIME_IN_IDS = 80
const REALTIME_DEBOUNCE_MS = 280

export type ForecastSubTab = 'specific' | 'all-stages'

export function parseForecastSubTab(value: string | null): ForecastSubTab {
  return value === 'all-stages' ? 'all-stages' : 'specific'
}

export function ProjectsForecastTab({ customerId, myRole = null }: Props) {
  const { user: authUser } = useAuth()
  const authUserId = authUser?.id ?? null
  const isDocVisible = useDocumentVisibility()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSub = parseForecastSubTab(searchParams.get('forecastSub'))

  const setActiveSub = useCallback(
    (next: ForecastSubTab) => {
      const nextParams = new URLSearchParams(searchParams)
      if (next === 'specific') {
        nextParams.delete('forecastSub')
      } else {
        nextParams.set('forecastSub', next)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const [jobs, setJobs] = useState<ForecastJob[]>([])
  const [workflowByProject, setWorkflowByProject] = useState<ForecastWorkflowMap>(new Map())
  const [prefixMap, setPrefixMap] = useState<LedgerPrefixMap>({})
  const [stagesByWorkflow, setStagesByWorkflow] = useState<Map<string, ForecastStage[]>>(new Map())
  const [loadingJobs, setLoadingJobs] = useState<boolean>(true)
  const [loadingStages, setLoadingStages] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadGenRef = useRef(0)

  const loadJobs = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingJobs(true)
      setError(null)
      const gen = ++loadGenRef.current
      try {
        const [{ jobs: rows, workflowByProject: wfMap }, stData] = await Promise.all([
          fetchForecastJobs({ customerId }),
          withSupabaseRetry(
            async () =>
              supabase.from('service_types').select('id, ledger_job_prefix, ledger_bid_prefix'),
            'fetch service_types for projects forecast prefix map',
          ),
        ])
        if (gen !== loadGenRef.current) return
        setJobs(rows)
        setWorkflowByProject(wfMap)
        setPrefixMap(buildLedgerPrefixMap((stData as unknown as ServiceTypeRow[]) ?? []))
      } catch (e) {
        if (gen !== loadGenRef.current) return
        setError(formatErrorMessage(e, 'Failed to load forecast jobs'))
        setJobs([])
        setWorkflowByProject(new Map())
        setPrefixMap({})
      } finally {
        if (gen === loadGenRef.current) setLoadingJobs(false)
      }
    },
    [customerId],
  )

  const loadStages = useCallback(
    async (silent = false) => {
      const workflowIds = Array.from(workflowByProject.values())
      if (!silent) setLoadingStages(true)
      const gen = loadGenRef.current
      if (workflowIds.length === 0) {
        setStagesByWorkflow(new Map())
        setLoadingStages(false)
        return
      }
      try {
        const stages = await fetchForecastStages(workflowIds)
        if (gen !== loadGenRef.current) return
        setStagesByWorkflow(groupStagesByWorkflow(stages))
      } catch (e) {
        if (gen !== loadGenRef.current) return
        setError(formatErrorMessage(e, 'Failed to load forecast stages'))
        setStagesByWorkflow(new Map())
      } finally {
        if (gen === loadGenRef.current) setLoadingStages(false)
      }
    },
    [workflowByProject],
  )

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    void loadStages()
  }, [loadStages])

  // Realtime — refetch stages on `project_workflow_steps` changes (filtered by the visible
  // workflow IDs when we can) and refetch jobs on `jobs_ledger` changes (catches new jobs
  // gaining a project_id and existing jobs flipping status).
  useEffect(() => {
    if (!authUserId) return
    const workflowIds = Array.from(workflowByProject.values())
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const schedule = (kind: 'stages' | 'jobs') => {
      if (!isDocVisible) return
      if (debounceTimer != null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
        if (kind === 'jobs') {
          void loadJobs(true)
        } else {
          void loadStages(true)
        }
      }, REALTIME_DEBOUNCE_MS)
    }
    const channel = supabase.channel(`projects-forecast-${authUserId}`)
    const idsSorted = workflowIds.filter(Boolean).sort()
    const useIn = idsSorted.length > 0 && idsSorted.length <= MAX_REALTIME_IN_IDS
    if (useIn) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_workflow_steps',
          filter: `workflow_id=in.(${idsSorted.join(',')})`,
        },
        () => schedule('stages'),
      )
    } else {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_workflow_steps' },
        () => schedule('stages'),
      )
    }
    // Always listen unfiltered for jobs_ledger so we catch jobs gaining/losing project_id and
    // brand-new jobs. Volume is low compared to clock_sessions.
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jobs_ledger' },
      () => schedule('jobs'),
    )
    channel.subscribe()
    return () => {
      if (debounceTimer != null) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [authUserId, workflowByProject, isDocVisible, loadJobs, loadStages])

  const sharedProps = useMemo(
    () => ({
      jobs,
      workflowByProject,
      stagesByWorkflow,
      prefixMap,
      loading: loadingJobs || loadingStages,
      refreshStages: () => void loadStages(true),
    }),
    [jobs, workflowByProject, stagesByWorkflow, prefixMap, loadingJobs, loadingStages, loadStages],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          style={pageUnderlineTabStyle(activeSub === 'specific')}
          onClick={() => setActiveSub('specific')}
        >
          Specific
        </button>
        <button
          type="button"
          style={pageUnderlineTabStyle(activeSub === 'all-stages')}
          onClick={() => setActiveSub('all-stages')}
        >
          All Stages
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-red-tint)',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: 'var(--text-red-800)',
            fontSize: '0.8125rem',
          }}
        >
          {error}
        </div>
      ) : null}

      {activeSub === 'specific' ? (
        <ProjectsForecastSpecificTab {...sharedProps} myRole={myRole} />
      ) : (
        <ProjectsForecastAllStagesTab {...sharedProps} />
      )}
    </div>
  )
}
