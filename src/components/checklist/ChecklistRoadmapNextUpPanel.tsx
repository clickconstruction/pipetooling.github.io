import { useState } from 'react'
import { nextUpReasonLabel, type NextUpLanes, type NextUpPick } from '../../lib/roadmapNextUp'
import { RoadmapTaskNumber } from './RoadmapStageNumberBadge'

type TaskLike = { id: string; title: string; assigneeIds: string[] }

type Props = {
  lanes: NextUpLanes
  tasksById: ReadonlyMap<string, TaskLike>
  taskNumbers: ReadonlyMap<string, string>
  nameById: ReadonlyMap<string, string>
  /** Opens the task card — staffing happens there (the card's chip picker). */
  onOpenTask: (taskId: string) => void
}

/**
 * "Next up" (v2.2129): the pick-don't-sort shortlist at the top of the Plan
 * view. Two lanes — tasks someone can start today, and tasks that still need a
 * person — at most five each, every row wearing the reasons it was picked.
 * Nothing below it is re-ordered; stage numbers never move.
 */
export function ChecklistRoadmapNextUpPanel({ lanes, tasksById, taskNumbers, nameById, onOpenTask }: Props) {
  const [why, setWhy] = useState(false)
  if (lanes.ready.length === 0 && lanes.needsName.length === 0) return null

  const reasonChip = (label: string, key: string) => (
    <span
      key={key}
      style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: '1px 7px',
        borderRadius: 999,
        background: 'var(--bg-amber-100)',
        color: 'var(--text-amber-800)',
        border: '1px solid var(--border-amber)',
        whiteSpace: 'nowrap',
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </span>
  )
  const personChip = (label: string, key: string) => (
    <span
      key={key}
      style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', whiteSpace: 'nowrap' }}
    >
      {label}
    </span>
  )

  const row = (p: NextUpPick, i: number, lane: 'ready' | 'needsName') => {
    const task = tasksById.get(p.taskId)
    if (!task) return null
    const num = taskNumbers.get(p.taskId)
    const shown = p.reasons.slice(0, 2)
    return (
      <li key={p.taskId} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => onOpenTask(p.taskId)}
          aria-label={`Open task ${num ?? ''} ${task.title}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4rem 1fr',
            gap: 6,
            width: '100%',
            padding: '0.4rem 0',
            border: 'none',
            background: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          <span
            style={{
              alignSelf: 'start',
              textAlign: 'center',
              borderRadius: 4,
              padding: '1px 0',
              ...(i === 0 ? { background: 'var(--bg-amber-100)', outline: '1px solid var(--border-amber)' } : {}),
            }}
          >
            {num ? <RoadmapTaskNumber label={num} /> : null}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-strong)', lineHeight: 1.3 }}>{task.title}</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3, alignItems: 'center' }}>
              {lane === 'ready'
                ? task.assigneeIds.map((id) => personChip(nameById.get(id) ?? '…', `${p.taskId}-${id}`))
                : null}
              {shown.map((r, ri) => reasonChip(nextUpReasonLabel(r), `${p.taskId}-r${ri}`))}
              {lane === 'needsName' ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-link)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>Assign →</span>
              ) : null}
            </span>
          </span>
        </button>
      </li>
    )
  }

  const laneTitle = (label: string, note: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 2px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--text-faint)' }}>· {note}</span>
    </div>
  )

  return (
    <section
      aria-label="Next up"
      style={{ border: '1px solid var(--border-amber)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden', marginBottom: '0.9rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.8rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', fontWeight: 700, fontSize: '0.85rem' }}>
        <span>⚡ Next up</span>
        <button
          type="button"
          onClick={() => setWhy((w) => !w)}
          aria-expanded={why}
          style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.72rem', fontWeight: 500, color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3, padding: 0 }}
        >
          why this order?
        </button>
      </div>
      {why ? (
        <p style={{ margin: 0, padding: '0.5rem 0.8rem', fontSize: '0.78rem', color: 'var(--text-700)', borderBottom: '1px solid var(--border)' }}>
          Only tasks in unlocked stages are eligible. They're ordered by: <b>closes a stage</b> (two or fewer tasks left in its stage, fewest first) → <b>unlocks the most</b> (work waiting behind the stage's arrows) → <b>your stage order</b> → task order. At most two per stage. Your stage numbers never move — this list just points.
        </p>
      ) : null}
      <div style={{ padding: '0.2rem 0.8rem 0.3rem' }}>
        {lanes.ready.length > 0 ? (
          <>
            {laneTitle('Ready to go', `staffed · ${lanes.openReady} open`)}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{lanes.ready.map((p, i) => row(p, i, 'ready'))}</ul>
          </>
        ) : null}
        {lanes.needsName.length > 0 ? (
          <>
            {laneTitle('Needs a person', `${lanes.openNeedsName} open`)}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{lanes.needsName.map((p, i) => row(p, i, 'needsName'))}</ul>
          </>
        ) : null}
      </div>
      <p style={{ margin: 0, padding: '0.4rem 0.8rem 0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-strong)' }}>
        Order: closes a stage → unlocks the most → your stage order. Stage numbers never move. Refreshes as tasks finish.
      </p>
    </section>
  )
}
