import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { buildSubBoardLanes, type SubBoardCommitmentInput } from '../../lib/projects/subBoardLanes'

/**
 * Sub Board (RUN_SUBS_PLAN Phase 4, PR 4.5 — Option C of the Sub Dispatch
 * mockups): one lane per sub, bars = their work orders positioned by the
 * step's expected dates (else the offer's proposed window). Offered =
 * ghosted with a "?", overlapping bookings get the red outline. Read-only
 * v1 — bars link into the workflow.
 */

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days))
  return dt.toISOString().slice(0, 10)
}

export function ProjectsForecastSubsTab() {
  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])
  const [windowStart, setWindowStart] = useState(() => addDaysYmd(todayYmd, -7))
  const [windowEnd, setWindowEnd] = useState(() => addDaysYmd(todayYmd, 45))
  const [commitments, setCommitments] = useState<SubBoardCommitmentInput[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: cErr } = await supabase
        .from('step_commitments')
        .select('id, person_id, display_name, status, amount, proposed_start, proposed_end, step_id')
        .in('status', ['offered', 'accepted', 'approved'])
      if (cancelled) return
      if (cErr) {
        setError(cErr.message)
        setCommitments([])
        return
      }
      const rows = (data ?? []) as Array<{ id: string; person_id: string; display_name: string; status: string; amount: number; proposed_start: string | null; proposed_end: string | null; step_id: string }>
      const stepIds = [...new Set(rows.map((r) => r.step_id))]
      const stepInfo = new Map<string, { start: string | null; end: string | null; name: string; projectId: string | null; projectName: string | null }>()
      if (stepIds.length > 0) {
        const { data: stepRows } = await supabase
          .from('project_workflow_steps')
          .select('id, name, scheduled_start_date, scheduled_end_date, project_workflows(project_id, projects(name))')
          .in('id', stepIds)
        if (cancelled) return
        for (const s of (stepRows ?? []) as Array<{ id: string; name: string; scheduled_start_date: string | null; scheduled_end_date: string | null; project_workflows: { project_id: string; projects: { name: string } | { name: string }[] | null } | { project_id: string; projects: { name: string } | { name: string }[] | null }[] | null }>) {
          const wf = Array.isArray(s.project_workflows) ? s.project_workflows[0] : s.project_workflows
          const proj = wf ? (Array.isArray(wf.projects) ? wf.projects[0] : wf.projects) : null
          stepInfo.set(s.id, {
            start: s.scheduled_start_date,
            end: s.scheduled_end_date,
            name: s.name,
            projectId: wf?.project_id ?? null,
            projectName: proj?.name ?? null,
          })
        }
      }
      setCommitments(
        rows.map((r) => {
          const info = stepInfo.get(r.step_id)
          return {
            id: r.id,
            person_id: r.person_id,
            display_name: r.display_name,
            status: r.status,
            amount: Number(r.amount),
            proposed_start: r.proposed_start,
            proposed_end: r.proposed_end,
            stepStart: info?.start ?? null,
            stepEnd: info?.end ?? null,
            stepName: info?.name ?? null,
            projectId: info?.projectId ?? null,
            projectName: info?.projectName ?? null,
          }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const board = useMemo(
    () => buildSubBoardLanes(commitments ?? [], windowStart, windowEnd),
    [commitments, windowStart, windowEnd],
  )

  const dayLabels = useMemo(() => {
    const labels: string[] = []
    for (let i = 0; i < 7; i++) {
      const ymd = addDaysYmd(windowStart, Math.round((i * daysInWindow(windowStart, windowEnd)) / 6))
      const [y, m, d] = ymd.split('-').map(Number)
      labels.push(new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))
    }
    return labels
  }, [windowStart, windowEnd])

  if (error) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
  if (commitments === null) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
          From
          <input type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
          To
          <input type="date" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)' }} />
        </label>
        <span style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#059669', marginRight: 4, verticalAlign: -1 }} />accepted</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#2563eb', opacity: 0.6, marginRight: 4, verticalAlign: -1 }} />offered · awaiting answer</span>
          <span style={{ color: 'var(--text-red-700)', fontWeight: 650 }}>red outline = overlapping bookings</span>
        </span>
      </div>

      {board.lanes.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No dated work orders in this window. Offers made with a proposed window (or steps with expected dates) show here.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '10rem 1fr', gap: '0.6rem', marginBottom: 4 }}>
              <span />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-faint)' }}>
                {dayLabels.map((l, i) => (
                  <span key={i}>{l}</span>
                ))}
              </div>
            </div>
            {board.lanes.map((lane) => (
              <div key={lane.key} style={{ display: 'grid', gridTemplateColumns: '10rem 1fr', gap: '0.6rem', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lane.name}>
                  {lane.name}
                </div>
                <div style={{ position: 'relative', height: 26, background: 'var(--bg-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                  {lane.bars.map((bar) => (
                    <Link
                      key={bar.commitmentId}
                      to={bar.projectId ? `/workflows/${bar.projectId}` : '/projects'}
                      title={bar.title}
                      style={{
                        position: 'absolute',
                        top: 3,
                        bottom: 3,
                        left: `${bar.startPct}%`,
                        width: `${bar.widthPct}%`,
                        borderRadius: 5,
                        background: bar.ghost ? '#2563eb' : '#059669',
                        opacity: bar.ghost ? 0.6 : 1,
                        outline: bar.overlapping ? '2px solid #dc2626' : 'none',
                        color: 'white',
                        fontSize: '0.66rem',
                        fontWeight: 650,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 0.4rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textDecoration: 'none',
                      }}
                    >
                      {bar.label}
                      {bar.ghost ? ' ?' : ''}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {board.undatedCount > 0 && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {board.undatedCount} work order{board.undatedCount === 1 ? '' : 's'} with no dates yet — offer them with a proposed window (or set the step's expected dates) to see them here.
        </p>
      )}
    </div>
  )
}

function daysInWindow(startYmd: string, endYmd: string): number {
  const [sy, sm, sd] = startYmd.split('-').map(Number)
  const [ey, em, ed] = endYmd.split('-').map(Number)
  if (!sy || !ey) return 1
  return Math.max(1, Math.round((Date.UTC(ey, em! - 1, ed!) - Date.UTC(sy, sm! - 1, sd!)) / 86_400_000))
}
