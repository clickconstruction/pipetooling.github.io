import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { activeUsersQuery } from '../../lib/people/fetchActiveUsers'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { GoalsStageStrip } from './GoalsStageStrip'
import RoadmapTaskContextModal from './RoadmapTaskContextModal'
import { ChecklistTechTreeOrderStagesModal } from './ChecklistTechTreeOrderStagesModal'
import { ChecklistCostButton } from './ChecklistCostButton'
import { useChecklistCostEstimates } from '../../hooks/useChecklistCostEstimates'
import { goalsStageRows, goalsStripRows, lockedStageHint, lockedStagePrerequisiteChain, type BridgeState, type GoalsStageRow, type GoalsStripRow } from '../../lib/roadmapBridge'
import { computeStageOrderUpdates, computeTaskOrderUpdates } from '../../lib/roadmapStageNumbers'
import { goalsLedgerTaskRows, type GoalsLedgerTaskRow } from '../../lib/roadmapGoalsLedger'
import { recentStageUnlockEvents, stageUnlockPreviewFor, type StageUnlockEvent } from '../../lib/roadmapStageReview'
import { formatOpenCostSummary, summarizeOpenTaskCosts } from '../../lib/checklistCostEstimate'

/**
 * GOALS (v2.1876 → v2.2167 ledger → v2.2278 strip): one progress row per
 * roadmap the viewer can read — segmented stage bar, stages that unfold to
 * their tasks, the 🔒 prerequisite-chain sheet, ⇅ Reorder, per-stage 🔔
 * reminders, and the Where-this-fits sheet for a tapped task.
 *
 * Moved verbatim out of the Review tab (`ChecklistOutstandingTab`) onto the
 * Roadmap page in journey-map Tier-2 #41: it is roadmap product, and on Review
 * it had no role gate at all — a master or assistant saw progress pips for
 * roadmaps they had no door to. The Roadmap page is that door now, and the
 * strip lives there for the same set of roles (`canOpenRoadmap`).
 *
 * Self-contained: own loader (five small reads), own `goalsReloadTick`, own
 * Where-this-fits mount. The host supplies only the lenses and the two
 * callbacks.
 */
export function ChecklistGoalsSection({
  authUserId,
  canSeeCosts,
  canEditRoadmapTasks,
  onOpenRoadmap,
  setError,
}: {
  authUserId: string | null
  /** Cost lens (dev or controller — mirrors checklist_item_costs RLS). */
  canSeeCosts: boolean
  /** Roadmap structure editors (v2.2182) — may reorder stages and edit tasks from the Where-this-fits sheet. */
  canEditRoadmapTasks: boolean
  /** "Open roadmap →" on an expanded goal; omitted = no link (the host IS the roadmap). */
  onOpenRoadmap?: (roadmapId: string) => void
  setError: (s: string | null) => void
}) {
  const { showToast } = useToastContext()
  const costEstimates = useChecklistCostEstimates(canSeeCosts)
  const [remindingStageId, setRemindingStageId] = useState<string | null>(null)
  /** The task whose Where-this-fits sheet is open (tapped from an unfolded stage). */
  const [roadmapContextTaskId, setRoadmapContextTaskId] = useState<string | null>(null)

  /** Goals strip (v2.1876): one progress row per roadmap the viewer can read. */
  const [goalRows, setGoalRows] = useState<GoalsStripRow[]>([])
  /** Per-stage rows behind each goal's segmented bar + ledger (v2.2021). */
  const [goalStageRows, setGoalStageRows] = useState<Map<string, GoalsStageRow[]>>(new Map())
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  /** "N more locked stages" fold, reset each time a goal expands. */
  const [showAllLockedStages, setShowAllLockedStages] = useState(false)
  /** Per-roadmap → per-stage task rows behind the ledger's unfold (v2.2167). */
  const [goalTaskRows, setGoalTaskRows] = useState<Map<string, Map<string, GoalsLedgerTaskRow[]>>>(new Map())
  /** The one stage row currently unfolded to its tasks (v2.2167). */
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null)
  /** Per-roadmap "stage finished → unlocked X" events (stage review prototype). */
  const [goalUnlockEvents, setGoalUnlockEvents] = useState<Map<string, StageUnlockEvent[]>>(new Map())
  /** Bumped after edits made from the Where-this-fits sheet (v2.2182) so the ledger refetches. */
  const [goalsReloadTick, setGoalsReloadTick] = useState(0)
  /** Raw stage/task sort_index per roadmap — the ⇅ Reorder modal's save baseline (v2.NNNN). */
  const [goalGroupOrder, setGoalGroupOrder] = useState<Map<string, Array<{ id: string; sort_index: number }>>>(new Map())
  const [goalRawTasks, setGoalRawTasks] = useState<Array<{ id: string; group_id: string; sort_index: number }>>([])
  /** Which roadmap's stages the ⇅ Reorder modal is editing; null = closed. */
  const [orderStagesRoadmapId, setOrderStagesRoadmapId] = useState<string | null>(null)
  /** Roadmap edges (v2.NNNN) — the 🔒-chip modal walks them for the unlock chain. */
  const [goalEdges, setGoalEdges] = useState<Array<{ fromGroupId: string; toGroupId: string }>>([])
  /** The locked stage whose prerequisite-chain modal is open; null = closed. */
  const [lockedChainStage, setLockedChainStage] = useState<{ roadmapId: string; groupId: string } | null>(null)
  /** Stage briefly flashed blue after a jump from the chain modal. */
  const [highlightStageId, setHighlightStageId] = useState<string | null>(null)
  const jumpToStage = (roadmapId: string, groupId: string) => {
    setLockedChainStage(null)
    setExpandedGoalId(roadmapId)
    setShowAllLockedStages(true)
    setExpandedStageId(null)
    setHighlightStageId(groupId)
    window.setTimeout(() => setHighlightStageId((prev) => (prev === groupId ? null : prev)), 2600)
  }
  // Scroll AFTER the unfolded rows render (the jump may reveal a folded locked
  // tail). Instant, not smooth — the flash orients the eye, and smooth
  // scrolling stalls in rAF-less webviews.
  useEffect(() => {
    if (!highlightStageId) return
    document.getElementById(`goal-stage-${highlightStageId}`)?.scrollIntoView({ block: 'center' })
  }, [highlightStageId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ data: rms }, { data: grps }, { data: edgs }] = await Promise.all([
        supabase.from('checklist_tech_tree_roadmaps').select('id, title').order('sort_index'),
        supabase.from('checklist_tech_tree_groups').select('id, roadmap_id, title, sort_index'),
        supabase.from('checklist_tech_tree_edges').select('from_group_id, to_group_id'),
      ])
      if (cancelled || !rms || rms.length === 0 || !grps || grps.length === 0) return
      // v2.2167: title / order / pin / assignee ids ride along so a stage row can
      // unfold to its tasks; names + bridge rows are two small extra reads.
      const [{ data: tsks }, { data: usrs }] = await Promise.all([
        supabase
          .from('checklist_tech_tree_group_tasks')
          .select('id, group_id, title, sort_index, completed_at, pinned_at, checklist_tech_tree_task_assignees(user_id)')
          .in('group_id', grps.map((g) => g.id)),
        activeUsersQuery<{ id: string; name: string; email: string }>('id, name, email', { includeDev: true, orderByName: false }),
      ])
      if (cancelled) return
      const taskIds = (tsks ?? []).map((t) => t.id)
      const { data: bridgeRows } = taskIds.length
        ? await supabase
            .from('checklist_items')
            .select('roadmap_group_task_id, checklist_instances(id, completed_at, reviewed_at)')
            .in('roadmap_group_task_id', taskIds)
        : { data: [] as unknown[] }
      if (cancelled) return
      const bridgeByTaskId = new Map<string, BridgeState>()
      for (const row of (bridgeRows ?? []) as Array<{ roadmap_group_task_id: string | null; checklist_instances: Array<{ id: string; completed_at: string | null; reviewed_at: string | null }> | null }>) {
        const inst = (row.checklist_instances ?? [])[0]
        if (row.roadmap_group_task_id && inst) bridgeByTaskId.set(row.roadmap_group_task_id, { instanceCompletedAt: inst.completed_at, reviewedAt: inst.reviewed_at, instanceId: inst.id })
      }
      const nameById = new Map((usrs ?? []).map((u) => [u.id, (u.name ?? '').trim() || u.email]))
      const fullTasks = (tsks ?? []).map((t) => ({
        id: t.id,
        group_id: t.group_id,
        title: t.title,
        sort_index: t.sort_index,
        completed_at: t.completed_at,
        pinned_at: (t as { pinned_at?: string | null }).pinned_at ?? null,
        assigneeIds: ((t as { checklist_tech_tree_task_assignees?: Array<{ user_id: string }> | null }).checklist_tech_tree_task_assignees ?? []).map((a) => a.user_id),
      }))
      const mappedTasks = fullTasks.map((t) => ({ id: t.id, group_id: t.group_id, completed_at: t.completed_at, assigneeCount: t.assigneeIds.length }))
      const mappedEdges = (edgs ?? []).map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id }))
      setGoalRows(goalsStripRows({ roadmaps: rms, groups: grps, tasks: mappedTasks, edges: mappedEdges }))
      const stageMap = new Map<string, GoalsStageRow[]>()
      const taskMap = new Map<string, Map<string, GoalsLedgerTaskRow[]>>()
      const eventsMap = new Map<string, StageUnlockEvent[]>()
      for (const rm of rms) {
        const rmGroups = grps.filter((g) => g.roadmap_id === rm.id)
        if (rmGroups.length === 0) continue
        const rows = goalsStageRows({ groups: rmGroups, tasks: mappedTasks, edges: mappedEdges })
        stageMap.set(rm.id, rows)
        taskMap.set(rm.id, goalsLedgerTaskRows({ groups: rmGroups, tasks: fullTasks, edges: mappedEdges, nameById, bridgeByTaskId }))
        eventsMap.set(rm.id, recentStageUnlockEvents({ stageRows: rows, tasks: mappedTasks, edges: mappedEdges, nowMs: Date.now() }))
      }
      setGoalStageRows(stageMap)
      setGoalTaskRows(taskMap)
      setGoalUnlockEvents(eventsMap)
      // Raw sort_index baselines for the ⇅ Reorder modal's diff-only saves.
      const orderMap = new Map<string, Array<{ id: string; sort_index: number }>>()
      for (const g of grps) {
        if (!orderMap.has(g.roadmap_id)) orderMap.set(g.roadmap_id, [])
        orderMap.get(g.roadmap_id)!.push({ id: g.id, sort_index: g.sort_index })
      }
      setGoalGroupOrder(orderMap)
      setGoalRawTasks(fullTasks.map((t) => ({ id: t.id, group_id: t.group_id, sort_index: t.sort_index })))
      setGoalEdges(mappedEdges)
    })()
    return () => {
      cancelled = true
    }
  }, [goalsReloadTick])

  /** Stage-scoped reminder: one push per assignee with THEIR open tasks in the stage. */
  async function sendStageReminder(
    stageGroupId: string,
    stageNumber: number,
    stageTitle: string,
    openTasks: GoalsLedgerTaskRow[],
  ) {
    setRemindingStageId(stageGroupId)
    try {
      const titlesByUser = new Map<string, string[]>()
      for (const t of openTasks) {
        for (const uid of t.assigneeIds) titlesByUser.set(uid, [...(titlesByUser.get(uid) ?? []), t.title])
      }
      let sentTotal = 0
      for (const [uid, titles] of titlesByUser) {
        const n = titles.length
        const body =
          n === 1
            ? `Stage ${stageNumber} “${stageTitle}”: ${titles[0]}`
            : n <= 3
              ? `Stage ${stageNumber} “${stageTitle}” — ${n} open tasks: ${titles.join(', ')}`
              : `Stage ${stageNumber} “${stageTitle}” — ${n} open tasks: ${titles.slice(0, 3).join(', ')} and ${n - 3} more`
        const { data, error: fnError } = await supabase.functions.invoke('send-checklist-notification', {
          body: {
            recipient_user_id: uid,
            push_title: 'Stage reminder',
            push_body: body,
            push_url: '/checklist?tab=today',
            tag: 'stage-reminder',
          },
        })
        if (fnError) throw fnError
        sentTotal += (data as { push_sent?: number } | null)?.push_sent ?? 0
      }
      if (sentTotal > 0) {
        showToast(
          `Stage reminder sent to ${titlesByUser.size} ${titlesByUser.size === 1 ? 'person' : 'people'} (${sentTotal} device${sentTotal === 1 ? '' : 's'}).`,
          'success',
        )
      } else {
        showToast('No notification-enabled devices among this stage’s assignees — the reminder had nowhere to land.', 'error')
      }
    } catch {
      showToast('Couldn’t send the stage reminder — try again.', 'error')
    } finally {
      setRemindingStageId(null)
    }
  }

  return (
    <>
      {goalRows.length > 0 ? (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text-muted)' }}>GOALS</p>
          {goalRows.map((g) => {
            const stages = goalStageRows.get(g.roadmapId) ?? []
            const unlockEvents = goalUnlockEvents.get(g.roadmapId) ?? []
            const expanded = expandedGoalId === g.roadmapId
            const lockedCount = stages.filter((s) => s.state === 'locked').length
            // Fold the locked tail behind "N more" — but never fold a single row.
            const foldLocked = !showAllLockedStages && lockedCount > 3
            const hiddenLocked = lockedCount - 2
            const visibleStages: Array<{ row: GoalsStageRow; index: number }> = []
            let lockedSeen = 0
            stages.forEach((row, index) => {
              if (row.state === 'locked') {
                lockedSeen += 1
                if (foldLocked && lockedSeen > 2) return
              }
              visibleStages.push({ row, index })
            })
            const toggleGoal = () => {
              setExpandedGoalId((prev) => (prev === g.roadmapId ? null : g.roadmapId))
              setShowAllLockedStages(false)
              setExpandedStageId(null)
            }
            return (
              <div
                key={g.roadmapId}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Hide' : 'Show'} stages for ${g.title}`}
                onClick={toggleGoal}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleGoal()
                  }
                }}
                style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 0.75rem', marginBottom: '0.5rem', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>⛰ {g.title}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{expanded ? '▾' : '▸'}</span>
                  </span>
                </div>
                {stages.length > 0 ? (
                  /* Segmented bar (v2.2021) — extracted to GoalsStageStrip (v2.2278):
                     wraps on phones instead of bleeding off-screen; the component's
                     render test pins the wrap so a stale-checkout merge can't
                     silently revert it again (that happened once: v2.2263 → v2.2264). */
                  <GoalsStageStrip stages={stages} />
                ) : (
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${g.pct}%`, height: '100%', background: '#2563eb' }} />
                  </div>
                )}
                {expanded && stages.length > 0 ? (
                  <div onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid var(--border)', marginTop: '0.55rem', paddingTop: '0.35rem', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.1rem 0 0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>STAGES</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.8rem' }}>
                        {canEditRoadmapTasks && stages.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setOrderStagesRoadmapId(g.roadmapId)}
                            title="Hold and drag stage cards into a new order"
                            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)' }}
                          >
                            ⇅ Reorder
                          </button>
                        ) : null}
                        {onOpenRoadmap ? (
                          <button
                            type="button"
                            onClick={() => onOpenRoadmap(g.roadmapId)}
                            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)' }}
                          >
                            Open roadmap →
                          </button>
                        ) : null}
                      </span>
                    </div>
                    {unlockEvents.length > 0 ? (
                      <div style={{ margin: '0.1rem 0 0.5rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {unlockEvents.map((ev) => (
                          <div
                            key={ev.stage.groupId}
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 6,
                              flexWrap: 'wrap',
                              fontSize: '0.8125rem',
                              lineHeight: 1.4,
                              padding: '0.45rem 0.6rem',
                              borderRadius: 10,
                              background: 'var(--bg-green-100)',
                              border: '1px solid #16a34a',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>
                              ✓ Stage {ev.stage.number} finished
                            </span>
                            <span style={{ color: 'var(--text-700)', minWidth: 0 }}>{ev.stage.title}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {new Date(ev.completedAtMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            {ev.unlocked.length > 0 ? (
                              <span style={{ fontWeight: 600, color: 'var(--text-green-700)', minWidth: 0 }}>
                                → unlocked {ev.unlocked.map((u) => `stage ${u.number} “${u.title}”`).join(', ')}
                              </span>
                            ) : null}
                            {ev.advanced.length > 0 ? (
                              <span style={{ color: 'var(--text-muted)', minWidth: 0 }}>
                                · moved {ev.advanced.map((u) => `stage ${u.number}`).join(', ')} closer
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {visibleStages.map(({ row: s, index }) => {
                      // v2.2167: rows wrap on phones (title never collapses) and unfold in
                      // place to their tasks; a task opens the "Where this task fits" sheet.
                      const stageTasks = goalTaskRows.get(g.roadmapId)?.get(s.groupId) ?? []
                      const canOpen = stageTasks.length > 0
                      const stageOpen = canOpen && expandedStageId === s.groupId
                      const stageCost = canSeeCosts
                        ? summarizeOpenTaskCosts(stageTasks.filter((t) => !t.done).map((t) => t.id), costEstimates)
                        : null
                      return (
                        <div
                          key={s.groupId}
                          id={`goal-stage-${s.groupId}`}
                          className={`goal-stage${stageOpen ? ' goal-stage--open' : ''}`}
                          style={
                            highlightStageId === s.groupId
                              ? { outline: '2px solid #2563eb', outlineOffset: -1, borderRadius: 8, background: 'var(--bg-blue-tint)', transition: 'background 0.4s' }
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            className="goal-stage-row"
                            disabled={!canOpen && s.state !== 'locked'}
                            aria-expanded={canOpen ? stageOpen : undefined}
                            aria-label={`Stage ${index + 1}: ${s.title}${canOpen ? (stageOpen ? ' — hide tasks' : ' — show tasks') : s.state === 'locked' ? ' — see what unlocks it' : ''}`}
                            onClick={() => {
                              if (canOpen) setExpandedStageId(stageOpen ? null : s.groupId)
                              else if (s.state === 'locked') setLockedChainStage({ roadmapId: g.roadmapId, groupId: s.groupId })
                            }}
                          >
                            <span className="goal-stage-n">{index + 1}</span>
                            <span className="goal-stage-title" style={{ color: s.state === 'locked' ? 'var(--text-faint)' : s.state === 'unplanned' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{s.title}</span>
                            <span className="goal-stage-count">
                              {s.total > 0 ? `${s.done}/${s.total}` : '\u2014'}
                              {canOpen ? <span aria-hidden className="goal-stage-car">{stageOpen ? '▾' : '▸'}</span> : null}
                            </span>
                            <span className="goal-stage-meta">
                              {stageCost && stageCost.dollars > 0 ? (
                                <span
                                  title={`Estimated cost of open tasks — ${stageCost.costed} of ${stageCost.total} costed`}
                                  style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: '#fbbf24', border: '1px solid #d97706', color: '#451a03' }}
                                >
                                  {formatOpenCostSummary(stageCost)}
                                </span>
                              ) : null}
                              {s.state === 'complete' ? (
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: '#16a34a', color: 'white' }}>✓ done</span>
                              ) : s.state === 'current' ? (
                                <>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>current</span>
                                  {s.openAssigned > 0 ? (
                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
                                      {s.openAssigned} on {s.openAssigned === 1 ? 'list' : 'lists'}
                                    </span>
                                  ) : null}
                                </>
                              ) : s.state === 'unplanned' ? (
                                <span
                                  title="No tasks and nothing leading into it — add tasks on the roadmap, or link a stage into it"
                                  style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' }}
                                >
                                  not planned yet
                                </span>
                              ) : (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  title={`${lockedStageHint(s.blockedBy, s.openAssigned > 0) ?? 'Locked'} — tap to see every stage that has to finish first`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setLockedChainStage({ roadmapId: g.roadmapId, groupId: s.groupId })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setLockedChainStage({ roadmapId: g.roadmapId, groupId: s.groupId })
                                    }
                                  }}
                                  style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-muted)', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
                                >
                                  🔒{s.blockedBy[0] ? ` after “${s.blockedBy[0]}”` : ''}
                                </span>
                              )}
                              {s.total > 0 || s.state === 'complete' ? (
                                <span className="goal-stage-bar">
                                  {s.total > 0 ? (
                                    <span style={{ display: 'block', height: '100%', width: `${Math.round((s.done / s.total) * 100)}%`, background: s.state === 'complete' ? '#16a34a' : '#2563eb' }} />
                                  ) : (
                                    <span style={{ display: 'block', height: '100%', width: '100%', background: '#16a34a' }} />
                                  )}
                                </span>
                              ) : null}
                            </span>
                          </button>
                          {stageOpen ? (
                            <>
                            <ul className="goal-stage-tasks" aria-label={`Tasks in stage ${index + 1}`}>
                              {stageTasks.map((t) => (
                                <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    type="button"
                                    className={`goal-task${t.done ? ' goal-task--done' : ''}`}
                                    onClick={() => setRoadmapContextTaskId(t.id)}
                                    aria-label={`Open task ${t.number} ${t.title}`}
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    <span className="goal-task-num">{t.number}</span>
                                    <span className={`goal-task-g${t.done ? ' goal-task-g--done' : ''}`} aria-hidden>{t.done ? '✓' : '○'}</span>
                                    <span style={{ minWidth: 0 }}>
                                      <span className="goal-task-title">{t.title}</span>
                                      {!t.done && (t.pinned || t.nextUp || t.assigneeNames.length > 0 || t.chip) ? (
                                        <span className="goal-task-sub">
                                          {t.pinned ? <span className="goal-task-mark">★ pinned</span> : t.nextUp ? <span className="goal-task-mark">⚡ next up</span> : null}
                                          {t.assigneeNames.length > 0 ? <span>{t.assigneeNames.join(', ')}</span> : <span>unassigned</span>}
                                          {t.chip ? (
                                            <span
                                              className="goal-task-chip"
                                              style={
                                                t.chip === 'in_review'
                                                  ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', borderColor: 'transparent' }
                                                  : t.chip === 'signed_off'
                                                    ? { background: '#16a34a', color: 'white', borderColor: 'transparent' }
                                                    : undefined
                                              }
                                            >
                                              {t.chip === 'in_review' ? 'in review' : t.chip === 'signed_off' ? 'signed off' : 'on list'}
                                            </span>
                                          ) : null}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                  {canSeeCosts && !t.done ? (
                                    <ChecklistCostButton costKey={t.id} taskTitle={t.title} />
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                            {(() => {
                              if (s.state !== 'current') return null
                              const preview = stageUnlockPreviewFor(s, stages)
                              const openAssignees = Array.from(
                                new Set(stageTasks.filter((t) => !t.done).flatMap((t) => t.assigneeNames)),
                              )
                              if (preview.unlocks.length === 0 && preview.helps.length === 0 && openAssignees.length === 0) return null
                              return (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    padding: '0.35rem 0.35rem 0.5rem 2rem',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-muted)',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {preview.unlocks.length > 0 ? (
                                    <span style={{ minWidth: 0 }}>
                                      <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>⚡ Finishing unlocks</span>{' '}
                                      {preview.unlocks.map((u) => `stage ${u.number} “${u.title}”`).join(', ')}
                                    </span>
                                  ) : null}
                                  {preview.helps.length > 0 ? (
                                    <span style={{ minWidth: 0 }}>
                                      {preview.unlocks.length > 0 ? 'and ' : ''}helps unlock{' '}
                                      {preview.helps.map((u) => `stage ${u.number}`).join(', ')}
                                    </span>
                                  ) : null}
                                  {openAssignees.length > 0 ? (
                                    <button
                                      type="button"
                                      disabled={remindingStageId === s.groupId}
                                      onClick={() =>
                                        void sendStageReminder(
                                          s.groupId,
                                          index + 1,
                                          s.title,
                                          stageTasks.filter((t) => !t.done && t.assigneeIds.length > 0),
                                        )
                                      }
                                      style={{
                                        marginLeft: 'auto',
                                        minHeight: 32,
                                        padding: '0 0.6rem',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        border: '1px solid var(--border-strong)',
                                        borderRadius: 8,
                                        background: 'var(--surface)',
                                        color: 'var(--text-700)',
                                        cursor: remindingStageId === s.groupId ? 'not-allowed' : 'pointer',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {remindingStageId === s.groupId ? 'Sending…' : `🔔 Remind ${openAssignees.length}`}
                                    </button>
                                  ) : null}
                                </div>
                              )
                            })()}
                            </>
                          ) : null}
                        </div>
                      )
                    })}
                    {foldLocked ? (
                      <button
                        type="button"
                        onClick={() => setShowAllLockedStages(true)}
                        style={{ padding: '0.3rem 0 0.1rem 2rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}
                      >
                        ▸ {hiddenLocked} more locked {hiddenLocked === 1 ? 'stage' : 'stages'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {/* 🔒 chip (v2.NNNN): which unfinished stages stand between a locked stage and unlocking. */}
      {lockedChainStage ? (() => {
        const chainStages = goalStageRows.get(lockedChainStage.roadmapId) ?? []
        const target = chainStages.find((s) => s.groupId === lockedChainStage.groupId)
        const targetNumber = chainStages.findIndex((s) => s.groupId === lockedChainStage.groupId) + 1
        const chain = lockedStagePrerequisiteChain({ groupId: lockedChainStage.groupId, stageRows: chainStages, edges: goalEdges })
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}
            onClick={() => setLockedChainStage(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`What unlocks ${target?.title ?? 'this stage'}`}
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', width: 'min(440px, 100%)', maxHeight: '82vh', overflowY: 'auto', padding: '1rem 1rem 0.75rem' }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)', display: 'flex', gap: '0.45rem', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{targetNumber > 0 ? targetNumber : ''}</span>
                <span style={{ minWidth: 0 }}>{target?.title ?? 'Locked stage'}</span>
              </h3>
              <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                🔒 Locked — these stages have to finish first:
              </p>
              {chain.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  No unfinished prerequisites found — it should unlock on the next sync.
                </p>
              ) : (
                chain.map((entry) => (
                  <button
                    key={entry.row.groupId}
                    type="button"
                    onClick={() => jumpToStage(lockedChainStage.roadmapId, entry.row.groupId)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', padding: '0.5rem 0.4rem', border: 'none', borderTop: '1px solid var(--border)', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-base)' }}
                  >
                    <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', width: '1.4rem', textAlign: 'right', flexShrink: 0 }}>{entry.number}</span>
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>{entry.row.title}</span>
                    {entry.direct ? (
                      <span title="Finishing this stage is what unlocks it" style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.06rem 0.35rem', borderRadius: 5, background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        unlocks it
                      </span>
                    ) : null}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {entry.row.total > 0 ? `${entry.row.done}/${entry.row.total}` : '—'}
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--text-link)', fontSize: '0.8rem' }}>→</span>
                  </button>
                ))
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Tap a stage to jump to it in the list.</span>
                <button
                  type="button"
                  onClick={() => setLockedChainStage(null)}
                  style={{ padding: '0.4rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
      {/* ⇅ Reorder (v2.NNNN): the roadmap's hold-and-drag Order-stages modal, opened from Goals. */}
      <ChecklistTechTreeOrderStagesModal
        open={orderStagesRoadmapId !== null}
        onClose={() => setOrderStagesRoadmapId(null)}
        groups={(orderStagesRoadmapId ? goalStageRows.get(orderStagesRoadmapId) ?? [] : []).map((s) => {
          const stageTasks = orderStagesRoadmapId ? goalTaskRows.get(orderStagesRoadmapId)?.get(s.groupId) ?? [] : []
          const meta = s.state === 'complete' ? '✓ done' : s.state === 'locked' ? '🔒' : s.total > 0 ? `${s.done} of ${s.total}` : null
          return {
            id: s.groupId,
            title: s.title,
            meta,
            tasks: stageTasks.map((t) => ({ id: t.id, title: t.title, done: t.done })),
          }
        })}
        onSave={async (orderedStageIds, taskOrdersByGroup) => {
          const current = orderStagesRoadmapId ? goalGroupOrder.get(orderStagesRoadmapId) ?? [] : []
          const stageUpdates = computeStageOrderUpdates(orderedStageIds, current)
          const taskUpdates = computeTaskOrderUpdates(taskOrdersByGroup, goalRawTasks)
          if (stageUpdates.length === 0 && taskUpdates.length === 0) return true
          setError(null)
          try {
            await Promise.all([
              ...stageUpdates.map((u) =>
                withSupabaseRetry(
                  () => supabase.from('checklist_tech_tree_groups').update({ sort_index: u.sort_index }).eq('id', u.id),
                  'reorder goal stage',
                ),
              ),
              ...taskUpdates.map((u) =>
                withSupabaseRetry(
                  () => supabase.from('checklist_tech_tree_group_tasks').update({ sort_index: u.sort_index }).eq('id', u.id),
                  'reorder goal stage task',
                ),
              ),
            ])
            setGoalsReloadTick((t) => t + 1)
            return true
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save the order')
            setGoalsReloadTick((t) => t + 1)
            return false
          }
        }}
      />
      {roadmapContextTaskId && (
        <RoadmapTaskContextModal
          roadmapGroupTaskId={roadmapContextTaskId}
          onClose={() => setRoadmapContextTaskId(null)}
          onOpenRoadmap={onOpenRoadmap}
          canEditStructure={canEditRoadmapTasks}
          currentUserId={authUserId}
          onChanged={() => setGoalsReloadTick((t) => t + 1)}
        />
      )}
    </>
  )
}
