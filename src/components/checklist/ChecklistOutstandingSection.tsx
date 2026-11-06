import { useState, type ReactNode } from 'react'
import { type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { dueChipLabel } from '../../lib/checklistDueDates'
import { overdueAgeLabel, type LedgerInstance } from '../../lib/checklistHistoryLedger'
import type { LineState } from '../../lib/taskCriteria'
import type { RingState } from '../../lib/taskProgress'
import { ChecklistItemActivity, type ChecklistItemActivityItem } from './ChecklistItemActivity'
import { TaskLinesList } from './TaskLinesList'
import { TaskPercentSheet } from './TaskPercentSheet'
import { TaskRing } from './TaskRing'

/**
 * The Outstanding section at the bottom of the Today tab (v2.1864): overdue
 * tasks that still need doing — one-offs and show-until-completed items whose
 * date has passed. Rows are actionable: the same complete toggle as Today's
 * cards, plus tap-to-expand activity. Since v2.2017 the expanded panel is the
 * shared ChecklistItemActivity spine (full item history, all occurrences);
 * new notes still land on THIS overdue occurrence via `commentInstanceId`.
 * Renders nothing when the list is empty.
 *
 * Task cards (#273, PR 3): a one-off's box gives way to the ring (`ringFor`), whose press opens the % sheet; the open
 * panel draws the card's Done when… lines above the activity (`linesFor`, `onTickLine`).
 */
export function ChecklistOutstandingSection({
  instances,
  eventsByInstance,
  currentUserId,
  todayStr,
  titleFor,
  activityFor,
  onToggleComplete,
  onPosted,
  onCompleteForActivity,
  setError,
  nameById,
  ringFor,
  linesFor,
  onTickLine,
  onSetPercent,
}: {
  instances: LedgerInstance[]
  eventsByInstance: Map<string, ChecklistCardEvent[]>
  currentUserId: string | null
  todayStr: string
  titleFor: (inst: LedgerInstance) => ReactNode
  activityFor: (inst: LedgerInstance) => { item: ChecklistItemActivityItem; showInstanceDays: boolean }
  onToggleComplete: (inst: LedgerInstance) => void
  onPosted?: (instanceId: string, body: string) => void
  /** ✓ Complete / ✓ Post & complete in the row's activity panel (v2.2039). */
  onCompleteForActivity?: (inst: LedgerInstance) => Promise<boolean>
  setError: (s: string | null) => void
  nameById?: Record<string, string>
  /** The ring's state for a row that takes the ring, null for one that keeps the box. */
  ringFor?: (inst: LedgerInstance) => RingState | null
  linesFor?: (inst: LedgerInstance) => LineState[]
  onTickLine?: (inst: LedgerInstance, criterionId: string, ticked: boolean) => void | Promise<void>
  onSetPercent?: (inst: LedgerInstance, percent: number, words: string) => Promise<boolean>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sheetInst, setSheetInst] = useState<LedgerInstance | null>(null)

  if (instances.length === 0) return null

  const nameOf = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById?.[id] ?? 'Someone'
  }
  const sheetState = sheetInst ? ringFor?.(sheetInst) ?? null : null
  const sheetTitle = sheetInst ? sheetInst.checklist_items?.title ?? '' : ''

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Outstanding</h2>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.15rem 0.6rem',
            borderRadius: 999,
            background: 'var(--bg-red-100)',
            border: '1px solid #dc2626',
            color: 'var(--text-red-700)',
          }}
        >
          {instances.length} need{instances.length === 1 ? 's' : ''} doing
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          border: '1.5px solid #dc2626',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {instances.map((inst) => {
          const events = eventsByInstance.get(inst.id) ?? []
          const notes = events.filter((e) => e.event_type === 'comment').length
          const expanded = expandedId === inst.id
          const activity = activityFor(inst)
          const ring = ringFor?.(inst) ?? null
          const lines = linesFor?.(inst) ?? []
          return (
            <li key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem' }}>
                {ring ? (
                  <TaskRing state={ring} size={36} title={inst.checklist_items?.title ?? ''} onPress={() => (ring.done ? onToggleComplete(inst) : setSheetInst(inst))} />
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleComplete(inst)}
                    aria-label="Mark done"
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: 8,
                      border: '2.5px solid var(--text-600)',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : inst.id)}
                  aria-expanded={expanded}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-strong)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.9375rem' }}>{titleFor(inst)}</span>
                  {(() => {
                    // Due-aware line (v2.2351): red means LATE — a task inside
                    // its start→due window is calm, amber on the due day.
                    const due = inst.checklist_items?.due_date ?? null
                    const label = due ? dueChipLabel(due, todayStr) : overdueAgeLabel(inst.scheduled_date, todayStr)
                    const color = !due || label.includes('late')
                      ? 'var(--text-red-700)'
                      : label === 'due today'
                        ? 'var(--text-amber-800)'
                        : 'var(--text-muted)'
                    return (
                      <span style={{ display: 'block', fontSize: '0.78rem', color, marginTop: 2 }}>
                        {label}
                        {lines.length > 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}> · {lines.filter((l) => l.checked).length} of {lines.length} done when…</span>
                        ) : null}
                        {notes > 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}> · 💬 {notes} {notes === 1 ? 'note' : 'notes'}</span>
                        ) : null}
                      </span>
                    )
                  })()}
                </button>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {expanded ? '▾' : '▸'}
                </span>
              </div>
              {expanded ? (
                <div style={{ padding: '0 0.75rem 0.7rem 3.1rem' }}>
                  {lines.length > 0 ? (
                    <div style={{ marginBottom: '0.6rem' }}>
                      <TaskLinesList lines={lines} onTick={onTickLine ? (criterionId, ticked) => onTickLine(inst, criterionId, ticked) : undefined} readOnly={Boolean(inst.completed_at)} nameOf={nameOf} />
                    </div>
                  ) : null}
                  <ChecklistItemActivity
                    item={activity.item}
                    authUserId={currentUserId}
                    showInstanceDays={activity.showInstanceDays}
                    setError={setError}
                    commentInstanceId={inst.id}
                    onPosted={onPosted}
                    onComplete={onCompleteForActivity ? () => onCompleteForActivity(inst) : undefined}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      {sheetInst && sheetState ? (
        <TaskPercentSheet
          open
          title={sheetTitle}
          state={sheetState}
          onSet={async (p, w) => (onSetPercent ? onSetPercent(sheetInst, p, w) : false)}
          onDone={() => onToggleComplete(sheetInst)}
          onClose={() => setSheetInst(null)}
        />
      ) : null}
    </section>
  )
}
