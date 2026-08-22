import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { buildRoadmapTaskContext, type RoadmapTaskContextView } from '../../lib/roadmapTaskContext'

/**
 * "Where this task fits" (v2.2087): opened by tapping a ⛰ roadmap chip on the
 * Review tab. Whole-road segmented bar (same visual language as the Goals
 * strip) with a pin on this task's stage, the stage's task list with the
 * clicked task highlighted, and what finishing the stage unlocks. Fetches its
 * own graph on open so the chip can open it from anywhere.
 */
export default function RoadmapTaskContextModal({
  roadmapGroupTaskId,
  onClose,
  onOpenRoadmap,
}: {
  roadmapGroupTaskId: string
  onClose: () => void
  onOpenRoadmap?: (roadmapId: string) => void
}) {
  const [view, setView] = useState<RoadmapTaskContextView | null>(null)
  const [roadmapMeta, setRoadmapMeta] = useState<{ id: string; title: string } | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: focus } = await supabase
          .from('checklist_tech_tree_group_tasks')
          .select('id, group_id, title, checklist_tech_tree_groups(roadmap_id, checklist_tech_tree_roadmaps(id, title))')
          .eq('id', roadmapGroupTaskId)
          .maybeSingle()
        const grp = focus?.checklist_tech_tree_groups as
          | { roadmap_id: string; checklist_tech_tree_roadmaps: { id: string; title: string } | null }
          | null
        if (cancelled || !focus || !grp) return
        setTaskTitle(focus.title)
        setRoadmapMeta(grp.checklist_tech_tree_roadmaps ?? { id: grp.roadmap_id, title: 'goal' })
        const { data: groups } = await supabase
          .from('checklist_tech_tree_groups')
          .select('id, title, sort_index')
          .eq('roadmap_id', grp.roadmap_id)
        if (cancelled || !groups || groups.length === 0) return
        const groupIds = groups.map((g) => g.id)
        const [{ data: edges }, { data: tasks }] = await Promise.all([
          supabase.from('checklist_tech_tree_edges').select('from_group_id, to_group_id'),
          supabase
            .from('checklist_tech_tree_group_tasks')
            .select('id, group_id, title, sort_index, completed_at, checklist_tech_tree_task_assignees(user_id)')
            .in('group_id', groupIds),
        ])
        if (cancelled) return
        setView(
          buildRoadmapTaskContext({
            groups,
            edges: (edges ?? []).map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id })),
            tasks: (tasks ?? []).map((t) => ({
              id: t.id,
              group_id: t.group_id,
              title: t.title,
              sort_index: t.sort_index,
              completed_at: t.completed_at,
              assigneeCount: ((t as { checklist_tech_tree_task_assignees?: Array<{ user_id: string }> | null }).checklist_tech_tree_task_assignees ?? []).length,
            })),
            focusTaskId: roadmapGroupTaskId,
          }),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roadmapGroupTaskId])

  const stageStateLabel =
    view?.focusStage.state === 'complete' ? 'done' : view?.focusStage.state === 'current' ? 'in progress' : 'locked'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Where this task fits in the roadmap"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 14, width: 'min(34rem, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.9rem 1.2rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.16rem 0.6rem', borderRadius: 8, background: 'var(--bg-purple-tint, var(--bg-blue-tint))', color: 'var(--text-purple-800, var(--text-blue-800))', whiteSpace: 'nowrap' }}>
            ⛰ {roadmapMeta?.title ?? '…'}
          </span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-strong)' }}>Where this task fits</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', font: 'inherit', fontSize: '1.05rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem 0.3rem' }}>
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '1rem 1.2rem 1.1rem' }}>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : !view ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Couldn’t load this task’s roadmap — it may have been removed, or the roadmap isn’t visible to you.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 0.9rem', fontSize: '0.9rem', color: 'var(--text-strong)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-blue-700)' }}>{view.focusTaskNumber}</span> · {taskTitle}
              </p>

              <p style={{ margin: '0 0 0.3rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                THE WHOLE ROAD — {view.stages.length} STAGE{view.stages.length === 1 ? '' : 'S'}, {view.stagesDone} DONE
              </p>
              <div style={{ position: 'relative', paddingTop: 15 }}>
                <span
                  aria-hidden="true"
                  style={{ position: 'absolute', top: -3, left: `${((view.focusStageIndex + 0.5) / view.stages.length) * 100}%`, transform: 'translateX(-50%)', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-blue-700)', whiteSpace: 'nowrap' }}
                >
                  ▼
                </span>
                <div style={{ display: 'flex', gap: 2, height: 16 }}>
                  {view.stages.map((s, i) => {
                    const isFocus = i === view.focusStageIndex
                    return (
                      <span
                        key={s.groupId}
                        title={`${i + 1} · ${s.title} — ${s.total > 0 ? `${s.done} of ${s.total}` : 'milestone'}`}
                        style={{
                          flex: 1,
                          minWidth: 5,
                          borderRadius: 3,
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: s.state === 'complete' ? '#16a34a' : 'var(--bg-muted)',
                          ...(isFocus
                            ? { outline: '2.5px solid #2563eb', outlineOffset: 1 }
                            : s.state === 'current'
                              ? { outline: '1.5px solid #d97706', outlineOffset: 1 }
                              : {}),
                        }}
                      >
                        {s.state === 'current' && s.total > 0 && s.done > 0 ? (
                          <span style={{ position: 'absolute', inset: 0, display: 'block', width: `${Math.round((s.done / s.total) * 100)}%`, background: '#2563eb' }} />
                        ) : null}
                        {view.stages.length <= 40 ? (
                          <span style={{ position: 'relative', fontSize: '0.58rem', fontWeight: 700, lineHeight: 1, pointerEvents: 'none', color: s.state === 'complete' ? 'white' : s.state === 'current' || isFocus ? 'var(--text-700)' : 'var(--text-faint)' }}>
                            {i + 1}
                          </span>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {(
                  [
                    ['done', { background: '#16a34a' }],
                    ['in progress', { background: 'var(--surface)', outline: '1.5px solid #d97706', outlineOffset: -1 }],
                    ['locked', { background: 'var(--bg-muted)' }],
                    ["this task's stage", { background: 'var(--surface)', outline: '2px solid #2563eb', outlineOffset: -1 }],
                  ] as const
                ).map(([label, sw]) => (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', ...sw }} />
                    {label}
                  </span>
                ))}
              </div>

              <div style={{ border: '1px solid var(--border-strong)', borderRadius: 10, marginTop: '1rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', padding: '0.55rem 0.85rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-blue-700)' }}>STAGE {view.focusStageNumber}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>{view.focusStage.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {view.focusStage.total > 0 ? `${view.focusStage.done} of ${view.focusStage.total} done · ` : ''}
                    {stageStateLabel}
                  </span>
                </div>
                {view.stageTasks.length === 0 ? (
                  <p style={{ margin: 0, padding: '0.5rem 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Milestone stage — no tasks of its own.</p>
                ) : (
                  view.stageTasks.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: t.isFocus ? '0.45rem 0.85rem 0.45rem calc(0.85rem - 3px)' : '0.45rem 0.85rem',
                        fontSize: '0.85rem',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        background: t.isFocus ? 'var(--bg-blue-tint)' : undefined,
                        borderLeft: t.isFocus ? '3px solid #2563eb' : undefined,
                        color: t.done ? 'var(--text-muted)' : 'var(--text-strong)',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', width: '2.2rem', flexShrink: 0 }}>
                        {view.focusStageNumber}.{i + 1}
                      </span>
                      <span style={{ minWidth: 0, fontWeight: t.isFocus ? 700 : 400, textDecoration: t.done ? 'line-through' : undefined }}>{t.title}</span>
                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.7rem', fontWeight: 600, color: t.done ? 'var(--text-green-600)' : t.isFocus ? 'var(--text-blue-800)' : 'var(--text-amber-800)' }}>
                        {t.done ? '✓ done' : t.isFocus ? 'this task' : 'open'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {view.focusStage.state === 'locked' && view.focusStage.blockedBy.length > 0 ? (
                <p style={{ margin: '0.85rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>Waiting on:</span> {view.focusStage.blockedBy.join(' · ')}
                </p>
              ) : null}
              {view.unlocksNext.length > 0 ? (
                <p style={{ margin: '0.85rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>Finishing this stage unlocks:</span> {view.unlocksNext.join(' · ')}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '0.7rem 1.2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          {onOpenRoadmap && roadmapMeta ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenRoadmap(roadmapMeta.id)
              }}
              style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}
            >
              Open full roadmap →
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
