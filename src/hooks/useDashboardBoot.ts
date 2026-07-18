import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchDashboardPhase1 } from '../lib/dashboardBootQueries'
import { readDashboardBootCache, writeDashboardBootCache } from '../lib/dashboardBootCache'
import { toLocalDateString } from '../lib/dailyGoalsGate'
import type { AssignedStep, ChecklistInstance, Step, SubscribedStep } from '../lib/dashboardBootTypes'

export type UseDashboardBootInput = {
  authUserId: string | undefined
}

/**
 * Dashboard phase-1 boot seam (extraction-series refactor; no behavior change).
 *
 * Owns the boot effect (four-query `fetchDashboardPhase1` + day-scoped
 * sessionStorage cache hydrate/write via `dashboardBootCache`), the boot-derived
 * state (`userName`, `userNames`, today checklist seed, subscribed/assigned
 * steps, their loading flags, `userError`), and the `loadAssignedSteps` reload
 * used by the workflow-step action handlers.
 *
 * Boot-SEEDED state that section logic still mutates (today checklist via the
 * My Inbox toggle/forward handlers, `userError` via the forward flow) is
 * returned with its setter; as of v2.722 those handlers live in
 * `DashboardMyInboxCard`, which receives the setters as props from the parent.
 */
export function useDashboardBoot({ authUserId }: UseDashboardBootInput) {
  const [subscribedSteps, setSubscribedSteps] = useState<SubscribedStep[]>([])
  const [assignedSteps, setAssignedSteps] = useState<AssignedStep[]>([])
  const [todayChecklist, setTodayChecklist] = useState<ChecklistInstance[]>([])
  const [userError, setUserError] = useState<string | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [assignedLoading, setAssignedLoading] = useState(true)
  const [subscribedLoading, setSubscribedLoading] = useState(true)
  const [userNames, setUserNames] = useState<Set<string>>(new Set())
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    if (!authUserId) {
      setUserLoading(false)
      return
    }
    let cancelled = false
    setUserError(null)
    const today = toLocalDateString(new Date())
    const cached = readDashboardBootCache(authUserId, today)

    if (cached) {
      setTodayChecklist(cached.todayChecklist as ChecklistInstance[])
      setChecklistLoading(false)
      setUserNames(new Set(cached.userNamesLower))
      setUserName(cached.userName)
      setUserLoading(false)
    } else {
      setUserLoading(true)
      setChecklistLoading(true)
      setAssignedLoading(true)
      setSubscribedLoading(true)
    }

    // Phase 1: shared query module (see dashboardBootQueries.ts); stale cache hydrates above before this resolves.
    fetchDashboardPhase1(supabase, authUserId, today).then(([userRes, allUsersRes, subsRes, checklistRes]) => {
      if (cancelled) return

      const { data: userData, error: userErr } = userRes
      if (userErr) {
        setUserError(userErr.message)
        setUserLoading(false)
        setChecklistLoading(false)
        setAssignedLoading(false)
        setSubscribedLoading(false)
        return
      }

      const user = userData as { name: string | null } | null
      setUserLoading(false)
      setUserName(user?.name ?? null)

      const userNamesSet = new Set<string>()
      const allUsers = allUsersRes.data ?? []
      allUsers.forEach((u) => {
        if (u.name) userNamesSet.add(u.name.trim().toLowerCase())
      })
      setUserNames(userNamesSet)

      const checklistDataUnsorted = (checklistRes.data ?? []) as ChecklistInstance[]
      if (!cancelled) {
        setTodayChecklist(checklistDataUnsorted)
        setChecklistLoading(false)
      }

      const writeBootCache = (checklistForCache: ChecklistInstance[]) => {
        if (cancelled) return
        writeDashboardBootCache(authUserId, today, {
          userName: user?.name ?? null,
          userNamesLower: Array.from(userNamesSet),
          todayChecklist: checklistForCache,
        })
      }

      if (!cancelled && checklistDataUnsorted.length > 0) {
        void (async () => {
          const itemIds = [...new Set(checklistDataUnsorted.map((r) => r.checklist_item_id))]
          const { data: orderData } = await supabase
            .from('checklist_item_assignees')
            .select('checklist_item_id, display_order')
            .eq('user_id', authUserId)
            .in('checklist_item_id', itemIds)
          if (cancelled) return
          const orderMap = new Map<string, number>()
          for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; display_order: number | null }>) {
            orderMap.set(row.checklist_item_id, row.display_order ?? 999999)
          }
          const sorted = [...checklistDataUnsorted].sort((a, b) => {
            const orderA = orderMap.get(a.checklist_item_id) ?? 999999
            const orderB = orderMap.get(b.checklist_item_id) ?? 999999
            if (orderA !== orderB) return orderA - orderB
            return (a.created_at ?? '').localeCompare(b.created_at ?? '')
          })
          if (!cancelled) setTodayChecklist(sorted)
          writeBootCache(sorted)
        })()
      } else if (!cancelled) {
        writeBootCache(checklistDataUnsorted)
      }

      const subs = subsRes.data ?? []
      const name = user?.name ?? null

      // Phase 2: Load subscribed and assigned in parallel
      const loadSubscribed = async () => {
        if (!subs || subs.length === 0) {
          if (!cancelled) setSubscribedSteps([])
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const stepIds = subs.map((s) => s.step_id)
        const { data: steps } = await supabase
          .from('project_workflow_steps')
          .select('id, name, workflow_id')
          .in('id', stepIds)
        if (cancelled || !steps?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)
        if (cancelled || !workflows?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const projectIds = [...new Set(workflows.map((w) => w.project_id))]
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, project_number')
          .in('id', projectIds)
        if (cancelled || !projects?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const workflowToProject = new Map(workflows.map((w) => [w.id, w.project_id]))
        const projectMap = new Map(
          projects.map((p) => [
            p.id,
            { name: p.name, project_number: p.project_number ?? null },
          ]),
        )
        const subscribed: SubscribedStep[] = []
        steps.forEach((step) => {
          const sub = subs.find((s) => s.step_id === step.id)
          const projectId = workflowToProject.get(step.workflow_id)
          const projectInfo = projectId ? projectMap.get(projectId) : null
          if (sub && projectId && projectInfo) {
            subscribed.push({
              step_id: step.id,
              step_name: step.name,
              project_id: projectId,
              project_name: projectInfo.name,
              project_number: projectInfo.project_number,
              notify_when_started: sub.notify_when_started ?? false,
              notify_when_complete: sub.notify_when_complete ?? false,
              notify_when_reopened: sub.notify_when_reopened ?? false,
            })
          }
        })
        if (!cancelled) {
          setSubscribedSteps(subscribed)
          setSubscribedLoading(false)
        }
      }

      const loadAssigned = async () => {
        if (!name) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        let assigned: AssignedStep[] = []
        const withProjectsRes = await supabase.rpc('get_assigned_steps_with_projects_for_dashboard', { p_user_name: name })
        if (!withProjectsRes.error && Array.isArray(withProjectsRes.data)) {
          assigned = withProjectsRes.data as AssignedStep[]
        }
        if (assigned.length === 0 && (withProjectsRes.error?.message?.includes('Could not find the function') || withProjectsRes.error)) {
          let steps: Step[] = []
          const rpcRes = await supabase.rpc('get_assigned_steps_for_dashboard', { p_user_name: name })
          if (rpcRes.error?.message?.includes('Could not find the function')) {
            const { data } = await supabase.from('project_workflow_steps').select('*').eq('assigned_to_name', name).order('created_at', { ascending: false }).limit(100)
            steps = (data ?? []) as Step[]
          } else {
            steps = (rpcRes.data ?? []) as Step[]
          }
          if (cancelled || steps.length === 0) {
            if (!cancelled) setAssignedLoading(false)
            return
          }
          const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
          const { data: workflows } = await supabase.from('project_workflows').select('id, project_id').in('id', workflowIds)
          if (cancelled || !workflows?.length) {
            if (!cancelled) setAssignedLoading(false)
            return
          }
          const projectIds = [...new Set(workflows.map((w) => w.project_id))]
          const { data: projects } = await supabase.from('projects').select('id, name, address, plans_link').in('id', projectIds)
          if (cancelled || !projects?.length) {
            if (!cancelled) setAssignedLoading(false)
            return
          }
          const workflowToProject = new Map(workflows.map((w) => [w.id, w.project_id]))
          const projectMap = new Map(projects.map((p) => [p.id, { name: p.name, address: p.address, plans_link: p.plans_link }]))
          assigned = steps.map((step) => {
            const projectId = workflowToProject.get(step.workflow_id) ?? ''
            const project = projectId ? projectMap.get(projectId) : null
            return {
              ...step,
              project_id: projectId,
              project_name: project?.name ?? '',
              project_address: project?.address ?? null,
              project_plans_link: project?.plans_link ?? null,
              project_superintendent_names: null,
              workflow_id: step.workflow_id,
            }
          })
        }
        if (cancelled || assigned.length === 0) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        if (!cancelled) {
          setAssignedSteps(assigned)
          setAssignedLoading(false)
        }
      }

      void Promise.all([loadSubscribed(), loadAssigned()]).catch(() => {})
    })
    return () => { cancelled = true }
  }, [authUserId])

  /** Full reload of assigned steps; used by the workflow-step action handlers after start/complete/reject/skip. */
  const loadAssignedSteps = useCallback(async () => {
    if (!authUserId) return
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', authUserId)
      .single()
    const name = (userData as { name: string | null } | null)?.name ?? null

    if (!name) return

    const withProjectsRes = await supabase.rpc('get_assigned_steps_with_projects_for_dashboard', { p_user_name: name })
      if (!withProjectsRes.error && Array.isArray(withProjectsRes.data)) {
        const assigned = withProjectsRes.data as AssignedStep[]
        if (assigned.length > 0) {
          setAssignedSteps(assigned)
        } else {
          setAssignedSteps([])
        }
        return
      }
      const rpcRes = await supabase.rpc('get_assigned_steps_for_dashboard', { p_user_name: name })
      let steps: Step[] = []
      if (rpcRes.error?.message?.includes('Could not find the function')) {
        const { data } = await supabase
          .from('project_workflow_steps')
          .select('*')
          .eq('assigned_to_name', name)
          .order('created_at', { ascending: false })
          .limit(100)
        steps = (data ?? []) as Step[]
      } else {
        steps = (rpcRes.data ?? []) as Step[]
      }
      if (steps.length > 0) {
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)

        if (workflows) {
          const projectIds = [...new Set(workflows.map((w) => w.project_id))]
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name, address, plans_link')
            .in('id', projectIds)

          if (projects) {
            const workflowToProject = new Map<string, string>()
            workflows.forEach((w) => workflowToProject.set(w.id, w.project_id))
            const projectMap = new Map<string, { name: string; address: string | null; plans_link: string | null }>()
            projects.forEach((p) => projectMap.set(p.id, { name: p.name, address: p.address, plans_link: p.plans_link }))

            const assigned: AssignedStep[] = steps.map((step) => {
              const projectId = workflowToProject.get(step.workflow_id) ?? ''
              const project = projectId ? (projectMap.get(projectId) ?? null) : null
              return {
                ...step,
                project_id: projectId,
                project_name: project?.name ?? '',
                project_address: project?.address ?? null,
                project_plans_link: project?.plans_link ?? null,
                project_superintendent_names: null,
                workflow_id: step.workflow_id,
              }
            })
            setAssignedSteps(assigned)
          } else {
            setAssignedSteps([])
          }
        } else {
          setAssignedSteps([])
        }
      } else {
        setAssignedSteps([])
      }
  }, [authUserId])

  return {
    subscribedSteps,
    setSubscribedSteps,
    assignedSteps,
    setAssignedSteps,
    todayChecklist,
    setTodayChecklist,
    userError,
    setUserError,
    userLoading,
    checklistLoading,
    assignedLoading,
    subscribedLoading,
    userNames,
    userName,
    loadAssignedSteps,
  }
}
