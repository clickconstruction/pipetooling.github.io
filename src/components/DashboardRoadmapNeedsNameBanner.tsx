import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFarmModeEnabled } from '../hooks/useFarmModeEnabled'
import { canSeeRoadmapTab } from '../lib/roadmapVisibility'
import { buildRoadmapNudges, type RoadmapNudge } from '../lib/dashboardRoadmapNudge'
import type { UserRole } from '../hooks/useAuth'

/**
 * Dashboard nudge into the roadmap's "Needs a person" lane (v2.2138, Next-up
 * phase 2): "Farm 1 · 84 roadmap tasks need a person — next: 13.1 …". Self-gating:
 * renders nothing unless the viewer can see the Roadmap tab (same gate as the
 * tab itself) and a roadmap clears ROADMAP_NUDGE_MIN_COUNT. One card lists up
 * to three roadmaps; tapping a row opens that roadmap's Plan view.
 */
export default function DashboardRoadmapNeedsNameBanner({ authUserId, role }: { authUserId: string | undefined; role: UserRole | null }) {
  const navigate = useNavigate()
  const [farmModeEnabled] = useFarmModeEnabled(authUserId ?? null)
  const allowed = Boolean(authUserId) && canSeeRoadmapTab(role, farmModeEnabled)
  const [nudges, setNudges] = useState<RoadmapNudge[]>([])

  useEffect(() => {
    if (!allowed) {
      setNudges([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [{ data: rms }, { data: grps }, { data: edgs }] = await Promise.all([
          supabase.from('checklist_tech_tree_roadmaps').select('id, title').order('sort_index'),
          supabase.from('checklist_tech_tree_groups').select('id, roadmap_id, title, sort_index'),
          supabase.from('checklist_tech_tree_edges').select('from_group_id, to_group_id'),
        ])
        if (cancelled || !rms || rms.length === 0 || !grps || grps.length === 0) return
        const { data: tsks } = await supabase
          .from('checklist_tech_tree_group_tasks')
          .select('id, group_id, title, sort_index, completed_at, checklist_tech_tree_task_assignees(user_id)')
          .in('group_id', grps.map((g) => g.id))
        if (cancelled) return
        const tasks = (tsks ?? []).map((t) => ({
          id: t.id,
          group_id: t.group_id,
          title: t.title,
          sort_index: t.sort_index,
          completed_at: t.completed_at,
          assigneeIds: ((t as { checklist_tech_tree_task_assignees?: Array<{ user_id: string }> | null }).checklist_tech_tree_task_assignees ?? []).map((a) => a.user_id),
        }))
        setNudges(
          buildRoadmapNudges({
            roadmaps: rms,
            groups: grps,
            tasks,
            edges: (edgs ?? []).map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id })),
          }),
        )
      } catch {
        if (!cancelled) setNudges([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed])

  if (!allowed || nudges.length === 0) return null
  const shown = nudges.slice(0, 3)
  const total = nudges.reduce((a, n) => a + n.needsName, 0)
  const open = (n: RoadmapNudge) => navigate(`/checklist?tab=roadmap&roadmap=${encodeURIComponent(n.roadmapId)}&view=plan`)

  return (
    <div
      role="group"
      aria-label="Roadmap tasks that need a person"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-amber)',
        borderRadius: 8,
        background: 'var(--bg-amber-100)',
        marginBottom: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <span
        aria-hidden
        style={{ display: 'inline-flex', minWidth: '2.25rem', height: '2.25rem', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#d97706', color: '#fff', fontSize: '0.9375rem', fontWeight: 700 }}
      >
        {total > 99 ? '99+' : total}
      </span>
      <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-amber-800)' }}>
          {shown.length === 1
            ? `${shown[0]!.title} · ${shown[0]!.needsName} roadmap task${shown[0]!.needsName === 1 ? '' : 's'} need${shown[0]!.needsName === 1 ? 's' : ''} a person`
            : `${total} roadmap tasks need a person`}
        </div>
        {shown.map((n) => (
          <button
            key={n.roadmapId}
            type="button"
            onClick={() => open(n)}
            aria-label={`Open ${n.title} on the roadmap Plan`}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem 0.6rem', padding: 0, border: 'none', background: 'none', textAlign: 'left', font: 'inherit', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            {shown.length > 1 ? (
              <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>
                ⛰ {n.title} · {n.needsName}
              </span>
            ) : null}
            {n.next ? (
              <span>
                next: <span style={{ color: 'var(--text-700)' }}>{n.next.label}</span>
              </span>
            ) : null}
            <span style={{ color: 'var(--text-link)', fontWeight: 700, whiteSpace: 'nowrap' }}>Open Plan →</span>
          </button>
        ))}
      </div>
    </div>
  )
}
